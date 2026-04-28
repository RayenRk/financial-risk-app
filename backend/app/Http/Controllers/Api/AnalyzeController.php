<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Alert;
use App\Models\Company;
use App\Models\Quarter;
use App\Models\RiskPrediction;
use App\Models\User;
use App\Models\UserCompanyWatchlist;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AnalyzeController extends Controller
{
    private string $fastApiUrl = 'http://localhost:8001';

    // POST /api/analyze — analyze any ticker
    public function analyze(Request $request)
    {
        $request->validate([
            'ticker' => ['required', 'string', 'max:20', 'regex:/^[A-Za-z0-9.\-]+$/'],
        ]);

        $ticker = strtoupper(trim($request->ticker));

        // Call FastAPI
        try {
            $response = Http::timeout(60)->post("{$this->fastApiUrl}/analyze", [
                'ticker' => $ticker,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'ML service unavailable. Please try again later.',
                'error'   => $e->getMessage(),
            ], 503);
        }

        if ($response->status() === 404) {
            return response()->json([
                'message' => "Ticker '{$ticker}' not found. Please check the ticker symbol.",
            ], 404);
        }

        if ($response->status() === 422) {
            return response()->json([
                'message' => $response->json('detail') ?? 'Insufficient data for this ticker.',
            ], 422);
        }

        if ($response->failed()) {
            return response()->json([
                'message' => 'Analysis failed. Please try again.',
            ], 500);
        }

        $data     = $response->json();
        $company  = $data['company'];
        $quarters = $data['quarters'];
        $analysis = $data['analysis'];

        // Save to database
        $companyModel = $this->saveCompany($ticker, $company);
        $this->saveQuartersAndPredictions($companyModel, $quarters, $request->user());

        return response()->json([
            'message'  => "Analysis complete for {$ticker}.",
            'ticker'   => $ticker,
            'company'  => $companyModel,
            'analysis' => $analysis,
            'quarters' => $quarters,
            'shap'     => $data['shap_global'],
            'model'    => $data['model'],
        ]);
    }

    // GET /api/companies — list all analyzed companies
    public function index()
    {
        $companies = Company::with(['latestQuarter.riskPrediction'])
            ->orderBy('name')
            ->get()
            ->map(fn($c) => [
                'id'           => $c->id,
                'ticker'       => $c->ticker,
                'name'         => $c->name,
                'sector'       => $c->sector,
                'country'      => $c->country,
                'market_cap'   => $c->market_cap,
                'current_risk' => $c->latestQuarter?->riskPrediction?->risk_label,
                'risk_color'   => $c->latestQuarter?->riskPrediction?->risk_color,
                'fetched_at'   => $c->fetched_at,
            ]);

        return response()->json([
            'companies' => $companies,
            'count'     => $companies->count(),
        ]);
    }

    // GET /api/companies/{ticker} — get full data for a specific company
    public function show(string $ticker)
    {
        $company = Company::where('ticker', strtoupper($ticker))
            ->with(['quarters.riskPrediction'])
            ->firstOrFail();

        $quarters = $company->quarters->map(fn($q) => [
            'id'                 => $q->id,
            'quarter_date'       => $q->quarter_date,
            'revenue'            => $q->revenue,
            'gross_profit'       => $q->gross_profit,
            'operating_income'   => $q->operating_income,
            'net_income'         => $q->net_income,
            'free_cash_flow'     => $q->free_cash_flow,
            'total_debt'         => $q->total_debt,
            'cash'               => $q->cash,
            'gross_margin'       => $q->gross_margin,
            'operating_margin'   => $q->operating_margin,
            'net_margin'         => $q->net_margin,
            'current_ratio'      => $q->current_ratio,
            'debt_to_equity'     => $q->debt_to_equity,
            'roe'                => $q->roe,
            'roa'                => $q->roa,
            'revenue_growth_yoy' => $q->revenue_growth_yoy,
            'risk_label'         => $q->riskPrediction?->risk_label,
            'risk_color'         => $q->riskPrediction?->risk_color,
            'confidence'         => $q->riskPrediction?->confidence,
            'prob_high_risk'     => $q->riskPrediction?->prob_high_risk,
            'prob_low_risk'      => $q->riskPrediction?->prob_low_risk,
            'prob_medium_risk'   => $q->riskPrediction?->prob_medium_risk,
            'top_risk_drivers'   => $q->riskPrediction?->top_risk_drivers,
        ]);

        return response()->json([
            'company'  => $company,
            'quarters' => $quarters,
        ]);
    }

    // POST /api/epam/refresh — admin only: force refresh EPAM data
    public function refreshEpam()
    {
        try {
            \Artisan::call('epam:import', ['--force' => true]);
            $output = \Artisan::output();
            return response()->json([
                'message' => 'EPAM data refreshed successfully.',
                'output'  => $output,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Refresh failed: ' . $e->getMessage(),
            ], 500);
        }
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    private function saveCompany(string $ticker, array $company): Company
    {
        return Company::updateOrCreate(
            ['ticker' => $ticker],
            [
                'name'        => $company['name'],
                'sector'      => $company['sector'] ?? null,
                'industry'    => $company['industry'] ?? null,
                'country'     => $company['country'] ?? null,
                'employees'   => $company['employees'] ?? null,
                'market_cap'  => $company['market_cap'] ?? null,
                'website'     => $company['website'] ?? null,
                'description' => $company['description'] ?? null,
                'fetched_at'  => now(),
            ]
        );
    }

    private function saveQuartersAndPredictions(Company $company, array $quarters, $user): void
    {
        $previousLabel = RiskPrediction::whereHas('quarter', fn($q) =>
            $q->where('company_id', $company->id)
        )->orderByDesc(
            Quarter::select('quarter_date')
                ->whereColumn('quarters.id', 'risk_predictions.quarter_id')
                ->limit(1)
        )->first()?->risk_label;

        $users = User::all();

        // Add to watchlist for requesting user
        UserCompanyWatchlist::firstOrCreate(
            ['user_id' => $user->id, 'company_id' => $company->id],
            ['notify_on_high_risk' => true, 'notify_on_change' => true]
        );

        foreach ($quarters as $q) {
            $quarter = Quarter::updateOrCreate(
                ['company_id' => $company->id, 'quarter_date' => $q['date']],
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

            RiskPrediction::updateOrCreate(
                ['quarter_id' => $quarter->id, 'model_version' => '1.0.0'],
                [
                    'company_id'       => $company->id,
                    'risk_label'       => $q['risk_label'],
                    'confidence'       => $q['confidence'],
                    'prob_high_risk'   => $q['probabilities']['high_risk'] ?? 0,
                    'prob_low_risk'    => $q['probabilities']['low_risk'] ?? 0,
                    'prob_medium_risk' => $q['probabilities']['medium_risk'] ?? 0,
                    'top_risk_drivers' => $q['top_risk_drivers'],
                    'predicted_at'     => now(),
                ]
            );

            // Generate alerts
            $currentLabel = $q['risk_label'];

            if ($currentLabel === 'high_risk') {
                foreach ($users as $u) {
                    Alert::firstOrCreate(
                        ['company_id' => $company->id, 'quarter_id' => $quarter->id,
                         'user_id' => $u->id, 'type' => 'high_risk_detected'],
                        ['severity' => 'critical',
                         'message'  => "{$company->name} flagged as HIGH RISK for {$q['date']}.",
                         'is_read'  => false, 'triggered_at' => now()]
                    );
                }
            }

            if ($previousLabel && $previousLabel !== $currentLabel) {
                $riskLevels = ['low_risk' => 1, 'medium_risk' => 2, 'high_risk' => 3];
                $increased  = ($riskLevels[$currentLabel] ?? 0) > ($riskLevels[$previousLabel] ?? 0);
                foreach ($users as $u) {
                    Alert::firstOrCreate(
                        ['company_id' => $company->id, 'quarter_id' => $quarter->id,
                         'user_id' => $u->id, 'type' => $increased ? 'risk_increased' : 'risk_decreased'],
                        ['severity' => $increased ? 'warning' : 'info',
                         'message'  => "{$company->name} risk " . ($increased ? 'increased' : 'improved') . " from {$previousLabel} to {$currentLabel} in {$q['date']}.",
                         'is_read'  => false, 'triggered_at' => now()]
                    );
                }
            }

            $previousLabel = $currentLabel;
        }
    }
}
