<?php

namespace App\Console\Commands;

use App\Models\Alert;
use App\Models\Company;
use App\Models\Quarter;
use App\Models\RiskPrediction;
use App\Models\User;
use App\Models\UserCompanyWatchlist;
use App\Notifications\RiskAlertNotification;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ImportEpamData extends Command
{
    protected $signature   = 'epam:import {--force : Force re-import even if data is current}';
    protected $description = 'Fetch latest EPAM data, score it, update DB. Sends alerts on risk changes.';

    private string $fastApiUrl = 'http://localhost:8001';

    public function handle(): int
    {
        $this->info('Starting EPAM data import...');
        $start = now();

        // ── Call FastAPI ────────────────────────────────────────────────
        $this->line('  → Fetching EPAM data from FastAPI...');
        try {
            $response = Http::timeout(60)->post("{$this->fastApiUrl}/analyze", [
                'ticker' => config('app.primary_ticker', 'EPAM'),
            ]);
            if ($response->failed()) {
                $this->error('FastAPI error: ' . $response->body());
                return Command::FAILURE;
            }
        } catch (\Exception $e) {
            $this->error('Could not connect to FastAPI: ' . $e->getMessage());
            return Command::FAILURE;
        }

        $data     = $response->json();
        $company  = $data['company'];
        $quarters = $data['quarters'];
        $analysis = $data['analysis'];

        $this->line("  → Data quality: {$analysis['data_quality']}% ({$analysis['data_quality_note']})");
        $this->line("  → Quarters: {$analysis['total_quarters']}");

        // ── Upsert company ──────────────────────────────────────────────
        $companyModel = Company::updateOrCreate(
            ['ticker' => config('app.primary_ticker', 'EPAM')],
            [
                'name'        => config('app.primary_display_name', $company['name']),
                'sector'      => $company['sector'],
                'industry'    => $company['industry'] ?? null,
                'country'     => $company['country'] ?? null,
                'employees'   => $company['employees'] ?? null,
                'market_cap'  => $company['market_cap'] ?? null,
                'website'     => $company['website'] ?? null,
                'description' => $company['description'] ?? null,
                'fetched_at'  => now(),
            ]
        );

        $this->line("  → Company: {$companyModel->name} (ID: {$companyModel->id})");

        // ── Add to watchlists ───────────────────────────────────────────
        User::all()->each(function ($user) use ($companyModel) {
            UserCompanyWatchlist::firstOrCreate(
                ['user_id' => $user->id, 'company_id' => $companyModel->id],
                ['notify_on_high_risk' => true, 'notify_on_change' => true]
            );
        });

        // ── Get previous risk before importing ──────────────────────────
        $previousLabel    = $this->getPreviousRiskLabel($companyModel->id);
        $newQuarters      = 0;
        $updatedQuarters  = 0;
        $newAlerts        = 0;
        $riskChanged      = false;
        $latestQuarter    = null;
        $latestPrediction = null;

        // Identify latest quarter date to restrict alerts to latest only
        $latestDate = !empty($quarters) ? end($quarters)['date'] : null;

        // ── Import quarters loop ────────────────────────────────────────
        foreach ($quarters as $q) {

            $existing = Quarter::where('company_id', $companyModel->id)
                ->where('quarter_date', $q['date'])->first();

            if ($existing && !$this->option('force')) {
                continue;
            }

            // Upsert quarter
            $quarter = Quarter::updateOrCreate(
                ['company_id' => $companyModel->id, 'quarter_date' => $q['date']],
                [
                    'revenue'            => $q['revenue'],
                    'gross_profit'       => $q['gross_profit'],
                    'operating_income'   => $q['operating_income'],
                    'net_income'         => $q['net_income'],
                    'free_cash_flow'     => $q['free_cash_flow'],
                    'total_debt'         => $q['total_debt'],
                    'cash'               => $q['cash'],
                    'gross_margin'       => $q['gross_margin'],
                    'operating_margin'   => $q['operating_margin'],
                    'net_margin'         => $q['net_margin'],
                    'fcf_margin'         => $q['fcf_margin'] ?? null,
                    'roe'                => $q['roe'],
                    'roa'                => $q['roa'],
                    'debt_to_equity'     => $q['debt_to_equity'],
                    'current_ratio'      => $q['current_ratio'],
                    'interest_coverage'  => $q['interest_coverage'],
                    'asset_turnover'     => $q['asset_turnover'],
                    'revenue_growth_yoy' => $q['revenue_growth_yoy'],
                ]
            );

            $existing ? $updatedQuarters++ : $newQuarters++;

            // Upsert prediction
            $prediction = RiskPrediction::updateOrCreate(
                ['quarter_id' => $quarter->id, 'model_version' => '1.0.0'],
                [
                    'company_id'       => $companyModel->id,
                    'risk_label'       => $q['risk_label'],
                    'confidence'       => $q['confidence'],
                    'prob_high_risk'   => $q['probabilities']['high_risk'] ?? 0,
                    'prob_low_risk'    => $q['probabilities']['low_risk'] ?? 0,
                    'prob_medium_risk' => $q['probabilities']['medium_risk'] ?? 0,
                    'top_risk_drivers' => $q['top_risk_drivers'],
                    'predicted_at'     => now(),
                ]
            );

            $latestQuarter    = $quarter;
            $latestPrediction = $prediction;
            $currentLabel     = $q['risk_label'];
            $users            = User::all();
            $isLatestQuarter  = $q['date'] === $latestDate;

            // ── High risk alert — latest quarter only ──────────────────────
            if ($currentLabel === 'high_risk' && $isLatestQuarter) {
                foreach ($users as $user) {
                    Alert::where('company_id', $companyModel->id)
                        ->where('quarter_id', $quarter->id)
                        ->where('user_id', $user->id)
                        ->where('type', 'high_risk_detected')
                        ->delete();

                    Alert::create([
                        'company_id'   => $companyModel->id,
                        'quarter_id'   => $quarter->id,
                        'user_id'      => $user->id,
                        'type'         => 'high_risk_detected',
                        'severity'     => 'critical',
                        'message'      => "{$companyModel->name} flagged as HIGH RISK for {$q['date']}. Confidence: " . round($q['confidence'] * 100) . "%.",
                        'is_read'      => false,
                        'triggered_at' => now(),
                    ]);
                    $newAlerts++;
                }
            }

            // ── Risk change alert — latest quarter only ────────────────────
            if ($previousLabel && $previousLabel !== $currentLabel && $isLatestQuarter) {
                $riskLevels = ['low_risk' => 1, 'medium_risk' => 2, 'high_risk' => 3];
                $increased  = ($riskLevels[$currentLabel] ?? 0) > ($riskLevels[$previousLabel] ?? 0);
                $type       = $increased ? 'risk_increased' : 'risk_decreased';
                $severity   = $increased ? 'warning' : 'info';
                $message    = $increased
                    ? "{$companyModel->name} risk increased from {$previousLabel} to {$currentLabel} in {$q['date']}."
                    : "{$companyModel->name} risk improved from {$previousLabel} to {$currentLabel} in {$q['date']}.";

                foreach ($users as $user) {
                    Alert::where('company_id', $companyModel->id)
                        ->where('quarter_id', $quarter->id)
                        ->where('user_id', $user->id)
                        ->where('type', $type)
                        ->delete();

                    Alert::create([
                        'company_id'   => $companyModel->id,
                        'quarter_id'   => $quarter->id,
                        'user_id'      => $user->id,
                        'type'         => $type,
                        'severity'     => $severity,
                        'message'      => $message,
                        'is_read'      => false,
                        'triggered_at' => now(),
                    ]);
                    $newAlerts++;
                }

                $riskChanged = true;
            }

        }

        // ── Send email notification on risk change ──────────────────────

        if ($riskChanged && $latestQuarter && $latestPrediction) {
            $this->line('  → Risk changed — sending notifications...');

            $currentLabel = $latestPrediction->risk_label;
            $riskLevels   = ['low_risk' => 1, 'medium_risk' => 2, 'high_risk' => 3];
            $increased    = ($riskLevels[$currentLabel] ?? 0) > ($riskLevels[$previousLabel] ?? 0);
            $severity     = $currentLabel === 'high_risk' ? 'critical' : ($increased ? 'warning' : 'info');
            $message      = $increased
                ? "{$companyModel->name} risk increased from {$previousLabel} to {$currentLabel}."
                : "{$companyModel->name} risk improved from {$previousLabel} to {$currentLabel}.";

            $watchingUsers = User::where('role', 'admin')
                ->whereHas('watchlist', function ($q) use ($companyModel) {
                    $q->where('company_id', $companyModel->id)
                      ->where('notify_on_change', true);
                })->get();

            foreach ($watchingUsers as $index => $user) {
                try {
                    $user->notify(new RiskAlertNotification(
                        companyName:  $companyModel->name,
                        ticker:       config('app.primary_ticker', 'EPAM'),
                        previousRisk: $previousLabel,
                        currentRisk:  $currentLabel,
                        quarterDate:  $latestQuarter->quarter_date,
                        confidence:   (float) $latestPrediction->confidence,
                        topDrivers:   $latestPrediction->top_risk_drivers ?? [],
                        severity:     $severity,
                        message:      $message,
                    ));
                    $this->info("  → Email sent to {$user->email}");
                } catch (\Exception $e) {
                    $this->warn("  → Email failed for {$user->email}: " . $e->getMessage());
                    Log::warning('Risk alert email failed', [
                        'user'  => $user->email,
                        'error' => $e->getMessage(),
                    ]);
                }

                if ($index < $watchingUsers->count() - 1) {
                    sleep(3);
                }
            }

            $this->info("  → Notifications sent to {$watchingUsers->count()} users");
        }

        // ── Summary ─────────────────────────────────────────────────────
        $elapsed = abs(now()->diffInSeconds($start));
        $this->newLine();
        $this->info('✅ EPAM import complete!');
        $this->table(
            ['Metric', 'Value'],
            [
                ['New quarters',     $newQuarters],
                ['Updated quarters', $updatedQuarters],
                ['New alerts',       $newAlerts],
                ['Risk changed',     $riskChanged ? 'Yes — notifications sent' : 'No'],
                ['Latest risk',      $analysis['latest_risk']],
                ['Data quality',     $analysis['data_quality'] . '%'],
                ['Elapsed',          $elapsed . 's'],
            ]
        );

        return Command::SUCCESS;
    }

    private function getPreviousRiskLabel(int $companyId): ?string
    {
        return RiskPrediction::whereHas('quarter', fn($q) =>
            $q->where('company_id', $companyId)
        )->orderByDesc(
            Quarter::select('quarter_date')
                ->whereColumn('quarters.id', 'risk_predictions.quarter_id')
                ->limit(1)
        )->value('risk_label');
    }
}
