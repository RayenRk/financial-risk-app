<?php

namespace App\Console\Commands;

use App\Models\Alert;
use App\Models\Company;
use App\Models\Quarter;
use App\Models\RiskPrediction;
use App\Models\User;
use App\Models\UserCompanyWatchlist;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ImportEpamData extends Command
{
    protected $signature   = 'epam:import {--force : Force re-import even if data is current}';
    protected $description = 'Fetch latest EPAM financial data from FastAPI, score it, and update the database.';

    private string $fastApiUrl = 'http://localhost:8001';

    public function handle(): int
    {
        $this->info('Starting EPAM data import...');
        $start = now();

        // ── 1. Call FastAPI analyze endpoint ───────────────────────────────
        $this->line('  → Fetching EPAM data from FastAPI...');
        try {
            $response = Http::timeout(60)->post("{$this->fastApiUrl}/analyze", [
                'ticker' => config('app.primary_ticker'),
            ]);

            if ($response->failed()) {
                $this->error('FastAPI returned an error: ' . $response->body());
                return Command::FAILURE;
            }
        } catch (\Exception $e) {
            $this->error('Could not connect to FastAPI microservice: ' . $e->getMessage());
            $this->line('  Make sure FastAPI is running: uvicorn main:app --port 8001');
            return Command::FAILURE;
        }

        $data    = $response->json();
        $company = $data['company'];
        $quarters = $data['quarters'];
        $analysis = $data['analysis'];

        $this->line("  → Data quality: {$analysis['data_quality']}% ({$analysis['data_quality_note']})");
        $this->line("  → Quarters available: {$analysis['total_quarters']}");

        // ── 2. Upsert company ──────────────────────────────────────────────
        $companyModel = Company::updateOrCreate(
            ['ticker' => config('app.primary_ticker')],
            [
                'name' => config('app.primary_display_name'),
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

        // ── 3. Add to all user watchlists ──────────────────────────────────
        User::all()->each(function ($user) use ($companyModel) {
            UserCompanyWatchlist::firstOrCreate(
                ['user_id' => $user->id, 'company_id' => $companyModel->id],
                ['notify_on_high_risk' => true, 'notify_on_change' => true]
            );
        });

        // ── 4. Import quarters + predictions ──────────────────────────────
        $newQuarters    = 0;
        $updatedQuarters = 0;
        $newAlerts      = 0;
        $previousLabel  = $this->getPreviousRiskLabel($companyModel->id);

        foreach ($quarters as $q) {
            $quarterDate = $q['date'];

            // Check if quarter already exists
            $existing = Quarter::where('company_id', $companyModel->id)
                ->where('quarter_date', $quarterDate)
                ->first();

            if ($existing && !$this->option('force')) {
                // Quarter exists — skip unless forced
                $previousLabel = $q['risk_label'];
                continue;
            }

            // Upsert quarter
            $quarter = Quarter::updateOrCreate(
                ['company_id' => $companyModel->id, 'quarter_date' => $quarterDate],
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
                    'fcf_margin'         => $q['fcf_margin'],
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

            // Upsert risk prediction
            RiskPrediction::updateOrCreate(
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

            // ── 5. Generate alerts ─────────────────────────────────────────
            $currentLabel = $q['risk_label'];
            $users        = User::all();

            // High risk alert
            if ($currentLabel === 'high_risk') {
                foreach ($users as $user) {
                    $created = Alert::firstOrCreate(
                        ['company_id' => $companyModel->id, 'quarter_id' => $quarter->id,
                         'user_id' => $user->id, 'type' => 'high_risk_detected'],
                        [
                            'severity'     => 'critical',
                            'message'      => "{$companyModel->name} flagged as HIGH RISK for {$quarterDate}. Confidence: " . round($q['confidence'] * 100) . "%.",
                            'is_read'      => false,
                            'triggered_at' => now(),
                        ]
                    );
                    if ($created->wasRecentlyCreated) $newAlerts++;
                }
            }

            // Risk change alert
            if ($previousLabel && $previousLabel !== $currentLabel) {
                $riskLevels = ['low_risk' => 1, 'medium_risk' => 2, 'high_risk' => 3];
                $increased  = $riskLevels[$currentLabel] > $riskLevels[$previousLabel];
                $type       = $increased ? 'risk_increased' : 'risk_decreased';
                $severity   = $increased ? 'warning' : 'info';
                $message    = $increased
                    ? "{$companyModel->name} risk increased from {$previousLabel} to {$currentLabel} in {$quarterDate}."
                    : "{$companyModel->name} risk improved from {$previousLabel} to {$currentLabel} in {$quarterDate}.";

                foreach ($users as $user) {
                    $created = Alert::firstOrCreate(
                        ['company_id' => $companyModel->id, 'quarter_id' => $quarter->id,
                         'user_id' => $user->id, 'type' => $type],
                        [
                            'severity'     => $severity,
                            'message'      => $message,
                            'is_read'      => false,
                            'triggered_at' => now(),
                        ]
                    );
                    if ($created->wasRecentlyCreated) $newAlerts++;
                }
            }

            // Negative margin alert
            if (isset($q['operating_margin']) && $q['operating_margin'] !== null && $q['operating_margin'] < 0) {
                foreach ($users as $user) {
                    $created = Alert::firstOrCreate(
                        ['company_id' => $companyModel->id, 'quarter_id' => $quarter->id,
                         'user_id' => $user->id, 'type' => 'negative_margin'],
                        [
                            'severity'     => 'warning',
                            'message'      => "{$companyModel->name} reported negative operating margin (" . round($q['operating_margin'] * 100, 1) . "%) in {$quarterDate}.",
                            'is_read'      => false,
                            'triggered_at' => now(),
                        ]
                    );
                    if ($created->wasRecentlyCreated) $newAlerts++;
                }
            }

            $previousLabel = $currentLabel;
        }

        // ── 6. Summary ─────────────────────────────────────────────────────
        $elapsed = now()->diffInSeconds($start);
        $this->newLine();
        $this->info('✅ EPAM import complete!');
        $this->table(
            ['Metric', 'Value'],
            [
                ['New quarters',    $newQuarters],
                ['Updated quarters', $updatedQuarters],
                ['New alerts',      $newAlerts],
                ['Latest risk',     $analysis['latest_risk']],
                ['Data quality',    $analysis['data_quality'] . '%'],
                ['Elapsed',         $elapsed . 's'],
            ]
        );

        Log::info('EPAM import completed', [
            'new_quarters'     => $newQuarters,
            'updated_quarters' => $updatedQuarters,
            'new_alerts'       => $newAlerts,
            'latest_risk'      => $analysis['latest_risk'],
            'data_quality'     => $analysis['data_quality'],
        ]);

        return Command::SUCCESS;
    }

    private function getPreviousRiskLabel(int $companyId): ?string
    {
        $latest = RiskPrediction::whereHas('quarter', function ($q) use ($companyId) {
            $q->where('company_id', $companyId);
        })->orderByDesc(
            Quarter::select('quarter_date')
                ->whereColumn('quarters.id', 'risk_predictions.quarter_id')
                ->limit(1)
        )->first();

        return $latest?->risk_label;
    }
}
