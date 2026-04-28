<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\Quarter;

class QuarterController extends Controller
{
    // GET /api/quarters — all quarters with predictions
    public function index()
    {
        $ticker  = config('app.primary_ticker', 'EPAM');
        $company = Company::where('ticker', $ticker)->firstOrFail();
        $quarters = Quarter::with('riskPrediction')
            ->where('company_id', $company->id)
            ->orderBy('quarter_date')
            ->get()
            ->map(fn($q) => $this->formatQuarter($q));

        return response()->json([
            'company_id' => $company->id,
            'ticker'     => $company->ticker,
            'quarters'   => $quarters,
            'count'      => $quarters->count(),
        ]);
    }

    // GET /api/quarters/latest — most recent quarter
    public function latest()
    {
        $ticker  = config('app.primary_ticker', 'EPAM');
        $company = Company::where('ticker', $ticker)->firstOrFail();
        $quarter = Quarter::with('riskPrediction')
            ->where('company_id', $company->id)
            ->orderByDesc('quarter_date')
            ->firstOrFail();

        return response()->json($this->formatQuarter($quarter));
    }

    // GET /api/quarters/{id} — single quarter by id
    public function show(int $id)
    {
        $ticker  = config('app.primary_ticker', 'EPAM');
        $company = Company::where('ticker', $ticker)->firstOrFail();
        $quarter = Quarter::with('riskPrediction')->findOrFail($id);
        return response()->json($this->formatQuarter($quarter));
    }

    // Format quarter with prediction data
    private function formatQuarter(Quarter $q): array
    {
        $prediction = $q->riskPrediction;

        return [
            'id'                 => $q->id,
            'quarter_date'       => $q->quarter_date,
            // Raw financials
            'revenue'            => $q->revenue,
            'gross_profit'       => $q->gross_profit,
            'operating_income'   => $q->operating_income,
            'net_income'         => $q->net_income,
            'free_cash_flow'     => $q->free_cash_flow,
            'total_debt'         => $q->total_debt,
            'cash'               => $q->cash,
            // Ratios
            'gross_margin'       => $q->gross_margin,
            'operating_margin'   => $q->operating_margin,
            'net_margin'         => $q->net_margin,
            'fcf_margin'         => $q->fcf_margin,
            'roe'                => $q->roe,
            'roa'                => $q->roa,
            'debt_to_equity'     => $q->debt_to_equity,
            'current_ratio'      => $q->current_ratio,
            'interest_coverage'  => $q->interest_coverage,
            'asset_turnover'     => $q->asset_turnover,
            'revenue_growth_yoy' => $q->revenue_growth_yoy,
            // Risk prediction
            'risk_label'         => $prediction?->risk_label,
            'risk_color'         => $prediction?->risk_color,
            'confidence'         => $prediction?->confidence,
            'prob_high_risk'     => $prediction?->prob_high_risk,
            'prob_low_risk'      => $prediction?->prob_low_risk,
            'prob_medium_risk'   => $prediction?->prob_medium_risk,
            'top_risk_drivers'   => $prediction?->top_risk_drivers,
        ];
    }
}
