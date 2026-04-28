<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\Quarter;
use App\Models\RiskPrediction;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class RiskPredictionController extends Controller
{
    // FastAPI microservice URL
    private string $fastApiUrl = 'http://localhost:8000';

    // GET /api/predictions — all predictions ordered by quarter date
    public function index()
    {
        $ticker  = config('app.primary_ticker', 'EPAM');
        $company = Company::where('ticker', $ticker)->firstOrFail();
        $predictions = RiskPrediction::with('quarter')
            ->where('company_id', $company->id)
            ->orderBy('predicted_at')
            ->get()
            ->map(fn($p) => [
                'id'               => $p->id,
                'quarter_date'     => $p->quarter?->quarter_date,
                'risk_label'       => $p->risk_label,
                'risk_color'       => $p->risk_color,
                'confidence'       => $p->confidence,
                'prob_high_risk'   => $p->prob_high_risk,
                'prob_low_risk'    => $p->prob_low_risk,
                'prob_medium_risk' => $p->prob_medium_risk,
                'top_risk_drivers' => $p->top_risk_drivers,
                'model_version'    => $p->model_version,
                'predicted_at'     => $p->predicted_at,
            ]);

        return response()->json([
            'company_id' => $company->id,
            'predictions' => $predictions,
            'count'       => $predictions->count(),
        ]);
    }

    // GET /api/predictions/latest — latest quarter prediction
    public function latest()
    {
        $ticker  = config('app.primary_ticker', 'EPAM');
        $company = Company::where('ticker', $ticker)->firstOrFail();
        $prediction = RiskPrediction::with('quarter')
            ->where('company_id', $company->id)
            ->orderByDesc(
                Quarter::select('quarter_date')
                    ->whereColumn('quarters.id', 'risk_predictions.quarter_id')
                    ->limit(1)
        )
            ->firstOrFail();

        return response()->json([
            'quarter_date'     => $prediction->quarter?->quarter_date,
            'risk_label'       => $prediction->risk_label,
            'risk_color'       => $prediction->risk_color,
            'confidence'       => $prediction->confidence,
            'prob_high_risk'   => $prediction->prob_high_risk,
            'prob_low_risk'    => $prediction->prob_low_risk,
            'prob_medium_risk' => $prediction->prob_medium_risk,
            'top_risk_drivers' => $prediction->top_risk_drivers,
            'model_version'    => $prediction->model_version,
            'predicted_at'     => $prediction->predicted_at,
        ]);
    }

    // GET /api/predictions/{quarterId} — prediction for a specific quarter
    public function show(int $quarterId)
    {
        $quarter    = Quarter::findOrFail($quarterId);
        $prediction = RiskPrediction::where('quarter_id', $quarterId)->firstOrFail();

        return response()->json([
            'quarter_date'     => $quarter->quarter_date,
            'risk_label'       => $prediction->risk_label,
            'risk_color'       => $prediction->risk_color,
            'confidence'       => $prediction->confidence,
            'prob_high_risk'   => $prediction->prob_high_risk,
            'prob_low_risk'    => $prediction->prob_low_risk,
            'prob_medium_risk' => $prediction->prob_medium_risk,
            'top_risk_drivers' => $prediction->top_risk_drivers,
        ]);
    }

    // POST /api/predictions/custom — score any company with custom inputs
    // Laravel proxies this to FastAPI microservice
    public function custom(Request $request)
    {
        $validated = $request->validate([
            'gross_margin'       => ['required', 'numeric', 'between:-100,100'],
            'operating_margin'   => ['required', 'numeric', 'between:-100,100'],
            'net_margin'         => ['required', 'numeric', 'between:-100,100'],
            'fcf_margin'         => ['required', 'numeric', 'between:-100,100'],
            'roe'                => ['required', 'numeric', 'between:-100,100'],
            'roa'                => ['required', 'numeric', 'between:-100,100'],
            'debt_to_equity'     => ['required', 'numeric', 'between:-100,100'],
            'current_ratio'      => ['required', 'numeric', 'min:0'],
            'interest_coverage'  => ['required', 'numeric', 'between:-100,100'],
            'asset_turnover'     => ['required', 'numeric', 'min:0'],
            'revenue_growth_yoy' => ['required', 'numeric', 'between:-100,100'],
        ]);

        try {
            // Call FastAPI microservice
            $response = Http::timeout(10)->post("{$this->fastApiUrl}/predict/custom", $validated);

            if ($response->failed()) {
                return response()->json([
                    'message' => 'Prediction service unavailable.',
                    'error'   => $response->body(),
                ], 503);
            }

            return response()->json($response->json());

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Could not connect to prediction service.',
                'error'   => $e->getMessage(),
            ], 503);
        }
    }
}
