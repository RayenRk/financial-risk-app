<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use Illuminate\Http\Request;

class CompanyController extends Controller
{
    // GET /api/company — full company info
    public function show()
    {
        $company = Company::with(['latestQuarter.riskPrediction'])->firstOrFail();

        return response()->json([
            'id'          => $company->id,
            'ticker'      => $company->ticker,
            'name'        => $company->name,
            'sector'      => $company->sector,
            'industry'    => $company->industry,
            'country'     => $company->country,
            'employees'   => $company->employees,
            'market_cap'  => $company->market_cap,
            'website'     => $company->website,
            'description' => $company->description,
            'fetched_at'  => $company->fetched_at,
            'current_risk' => $company->latestQuarter?->riskPrediction?->risk_label,
            'risk_color'   => $company->latestQuarter?->riskPrediction?->risk_color,
        ]);
    }

    // GET /api/company/summary — quick stats for dashboard header
    public function summary()
    {
        $company  = Company::with('quarters.riskPrediction')->firstOrFail();
        $quarters = $company->quarters;

        $riskCounts = $quarters
            ->pluck('riskPrediction.risk_label')
            ->filter()
            ->countBy()
            ->toArray();

        $latest = $quarters->last();

        return response()->json([
            'company_name'    => $company->name,
            'ticker'          => $company->ticker,
            'total_quarters'  => $quarters->count(),
            'latest_quarter'  => $latest?->quarter_date,
            'latest_risk'     => $latest?->riskPrediction?->risk_label,
            'latest_confidence' => $latest?->riskPrediction?->confidence,
            'risk_distribution' => [
                'low_risk'    => $riskCounts['low_risk']    ?? 0,
                'medium_risk' => $riskCounts['medium_risk'] ?? 0,
                'high_risk'   => $riskCounts['high_risk']   ?? 0,
            ],
            'model_metrics' => [
                'f1'  => $company->latestQuarter?->riskPrediction?->model_version,
            ],
        ]);
    }

    // POST /api/company — admin only: create company (future use)
    public function store(Request $request)
    {
        $request->validate([
            'ticker' => ['required', 'string', 'unique:companies'],
            'name'   => ['required', 'string'],
        ]);

        $company = Company::create($request->all());

        return response()->json($company, 201);
    }

    // PUT /api/company/{id} — admin only: update company info
    public function update(Request $request, int $id)
    {
        $company = Company::findOrFail($id);
        $company->update($request->all());

        return response()->json($company);
    }

    // POST /api/company/import — admin only: re-import from JSON
    public function import(Request $request)
    {
        $jsonPath = base_path('data/epam_data.json');

        if (!file_exists($jsonPath)) {
            return response()->json(['message' => 'epam_data.json not found in /data folder.'], 404);
        }

        // Re-run the seeder logic
        \Artisan::call('db:seed', ['--class' => 'DatabaseSeeder', '--force' => true]);

        return response()->json(['message' => 'Import completed successfully.']);
    }
}
