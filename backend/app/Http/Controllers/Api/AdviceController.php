<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\Quarter;
use App\Models\RiskPrediction;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class AdviceController extends Controller
{
    private string $fastApiUrl = 'http://localhost:8001';

    // POST /api/advice/{ticker}
    public function generate(Request $request, string $ticker)
    {
        $ticker  = strtoupper(trim($ticker));
        $company = Company::where('ticker', $ticker)->firstOrFail();

        // Get latest quarter with prediction
        $quarter = Quarter::where('company_id', $company->id)
            ->orderByDesc('quarter_date')
            ->with('riskPrediction')
            ->first();

        if (!$quarter || !$quarter->riskPrediction) {
            return response()->json([
                'message' => 'No risk prediction found for this company.',
            ], 404);
        }

        $prediction = $quarter->riskPrediction;

        // Build payload for FastAPI
        $payload = [
            'ticker'             => $ticker,
            'company_name'       => $company->name,
            'risk_label'         => $prediction->risk_label,
            'confidence'         => (float) $prediction->confidence,
            'top_risk_drivers'   => $prediction->top_risk_drivers ?? [],
            'current_ratio'      => $quarter->current_ratio      ? (float) $quarter->current_ratio      : null,
            'debt_to_equity'     => $quarter->debt_to_equity     ? (float) $quarter->debt_to_equity     : null,
            'operating_margin'   => $quarter->operating_margin   ? (float) $quarter->operating_margin   : null,
            'net_margin'         => $quarter->net_margin         ? (float) $quarter->net_margin         : null,
            'roe'                => $quarter->roe                ? (float) $quarter->roe                : null,
            'roa'                => $quarter->roa                ? (float) $quarter->roa                : null,
            'revenue_growth_yoy' => $quarter->revenue_growth_yoy ? (float) $quarter->revenue_growth_yoy : null,
            'fcf_margin'         => $quarter->fcf_margin         ? (float) $quarter->fcf_margin         : null,
            'quarter_date'       => $quarter->quarter_date,
        ];

        // Call FastAPI
        try {
            $response = Http::timeout(30)->post("{$this->fastApiUrl}/advice", $payload);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'AI service unavailable. Please try again later.',
            ], 503);
        }

        if ($response->failed()) {
            return response()->json([
                'message' => $response->json('detail') ?? 'AI advice generation failed.',
            ], $response->status());
        }

        return response()->json($response->json());
    }
}
