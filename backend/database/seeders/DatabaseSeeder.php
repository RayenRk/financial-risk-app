<?php

namespace Database\Seeders;

use App\Models\Alert;
use App\Models\Company;
use App\Models\Quarter;
use App\Models\RiskPrediction;
use App\Models\User;
use App\Models\UserCompanyWatchlist;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // ── Create default users ────────────────────────────
        $admin = User::firstOrCreate(
            ['email' => 'admin@financialrisk.com'],
            [
                'name'     => 'Admin User',
                'password' => Hash::make('Admin@1234'),
                'role'     => 'admin',
            ]
        );

        $analyst = User::firstOrCreate(
            ['email' => 'analyst@financialrisk.com'],
            [
                'name'     => 'Analyst User',
                'password' => Hash::make('Analyst@1234'),
                'role'     => 'analyst',
            ]
        );

        echo "✅ Users created\n";
        echo "   Admin    : admin@financialrisk.com / Admin@1234\n";
        echo "   Analyst  : analyst@financialrisk.com / Analyst@1234\n";

        // ── Load EPAM JSON ──────────────────────────────────
        $jsonPath = base_path('data/epam_data.json');
        if (!file_exists($jsonPath)) {
            echo "❌ epam_data.json not found at {$jsonPath}\n";
            echo "   Place epam_data.json in the /data folder and re-run seeder.\n";
            return;
        }

        $data    = json_decode(file_get_contents($jsonPath), true);
        $meta    = $data['company'];
        $quarters = $data['quarters'];

        // ── Create company ──────────────────────────────────
        $company = Company::firstOrCreate(
            ['ticker' => $meta['ticker']],
            [
                'name'        => $meta['name'],
                'sector'      => $meta['sector'],
                'industry'    => $meta['industry'] ?? null,
                'country'     => $meta['country'] ?? null,
                'employees'   => $meta['employees'] ?? null,
                'market_cap'  => $meta['market_cap'] ?? null,
                'website'     => $meta['website'] ?? null,
                'description' => $meta['description'] ?? null,
                'fetched_at'  => $meta['fetched_at'] ?? now(),
            ]
        );

        echo "✅ Company created: {$company->name} ({$company->ticker})\n";

        // ── Add company to both users watchlist ─────────────
        foreach ([$admin, $analyst] as $user) {
            UserCompanyWatchlist::firstOrCreate(
                ['user_id' => $user->id, 'company_id' => $company->id],
                ['notify_on_high_risk' => true, 'notify_on_change' => true]
            );
        }

        echo "✅ Watchlist configured for both users\n";

        // ── Import quarters + predictions ──────────────────
        $previousLabel = null;
        $quartersCreated = 0;
        $predictionsCreated = 0;
        $alertsCreated = 0;

        foreach ($quarters as $q) {
            // Create quarter
            $quarter = Quarter::firstOrCreate(
                ['company_id' => $company->id, 'quarter_date' => $q['date']],
                [
                    'revenue'            => $q['revenue'] ?? null,
                    'gross_profit'       => $q['gross_profit'] ?? null,
                    'operating_income'   => $q['operating_income'] ?? null,
                    'net_income'         => $q['net_income'] ?? null,
                    'free_cash_flow'     => $q['free_cash_flow'] ?? null,
                    'total_debt'         => $q['total_debt'] ?? null,
                    'cash'               => $q['cash'] ?? null,
                    'gross_margin'       => $q['gross_margin'] ?? null,
                    'operating_margin'   => $q['operating_margin'] ?? null,
                    'net_margin'         => $q['net_margin'] ?? null,
                    'fcf_margin'         => $q['fcf_margin'] ?? null,
                    'roe'                => $q['roe'] ?? null,
                    'roa'                => $q['roa'] ?? null,
                    'debt_to_equity'     => $q['debt_to_equity'] ?? null,
                    'current_ratio'      => $q['current_ratio'] ?? null,
                    'interest_coverage'  => $q['interest_coverage'] ?? null,
                    'asset_turnover'     => $q['asset_turnover'] ?? null,
                    'revenue_growth_yoy' => $q['revenue_growth_yoy'] ?? null,
                ]
            );
            $quartersCreated++;

            // Create risk prediction
            $prediction = RiskPrediction::firstOrCreate(
                ['quarter_id' => $quarter->id, 'model_version' => '1.0.0'],
                [
                    'company_id'       => $company->id,
                    'risk_label'       => $q['risk_label'],
                    'confidence'       => $q['risk_score'],
                    'prob_high_risk'   => $q['prob_high_risk'] ?? 0,
                    'prob_low_risk'    => $q['prob_low_risk'] ?? 0,
                    'prob_medium_risk' => $q['prob_medium_risk'] ?? 0,
                    'top_risk_drivers' => $q['top_risk_drivers'] ?? [],
                    'predicted_at'     => now(),
                ]
            );
            $predictionsCreated++;

            // ── 6. Generate alerts ─────────────────────────────
            $currentLabel = $q['risk_label'];

            // Alert on high risk
            if ($currentLabel === 'high_risk') {
                foreach ([$admin, $analyst] as $user) {
                    Alert::firstOrCreate(
                        [
                            'company_id' => $company->id,
                            'quarter_id' => $quarter->id,
                            'user_id'    => $user->id,
                            'type'       => 'high_risk_detected',
                        ],
                        [
                            'severity'     => 'critical',
                            'message'      => "{$company->name} flagged as HIGH RISK for quarter {$q['date']}. Confidence: " . round($q['risk_score'] * 100) . "%.",
                            'is_read'      => false,
                            'triggered_at' => now(),
                        ]
                    );
                    $alertsCreated++;
                }
            }

            // Alert on risk increase
            if ($previousLabel && $previousLabel !== $currentLabel) {
                $riskLevels = ['low_risk' => 1, 'medium_risk' => 2, 'high_risk' => 3];
                $increased  = $riskLevels[$currentLabel] > $riskLevels[$previousLabel];
                $type       = $increased ? 'risk_increased' : 'risk_decreased';
                $severity   = $increased ? 'warning' : 'info';
                $message    = $increased
                    ? "{$company->name} risk level increased from {$previousLabel} to {$currentLabel} in {$q['date']}."
                    : "{$company->name} risk level improved from {$previousLabel} to {$currentLabel} in {$q['date']}.";

                foreach ([$admin, $analyst] as $user) {
                    Alert::firstOrCreate(
                        [
                            'company_id' => $company->id,
                            'quarter_id' => $quarter->id,
                            'user_id'    => $user->id,
                            'type'       => $type,
                        ],
                        [
                            'severity'     => $severity,
                            'message'      => $message,
                            'is_read'      => false,
                            'triggered_at' => now(),
                        ]
                    );
                    $alertsCreated++;
                }
            }

            // Alert on negative operating margin
            if (isset($q['operating_margin']) && $q['operating_margin'] < 0) {
                foreach ([$admin, $analyst] as $user) {
                    Alert::firstOrCreate(
                        [
                            'company_id' => $company->id,
                            'quarter_id' => $quarter->id,
                            'user_id'    => $user->id,
                            'type'       => 'negative_margin',
                        ],
                        [
                            'severity'     => 'warning',
                            'message'      => "{$company->name} reported negative operating margin (" . round($q['operating_margin'] * 100, 1) . "%) in {$q['date']}.",
                            'is_read'      => false,
                            'triggered_at' => now(),
                        ]
                    );
                    $alertsCreated++;
                }
            }

            $previousLabel = $currentLabel;
        }

        echo "✅ Quarters imported    : {$quartersCreated}\n";
        echo "✅ Predictions imported : {$predictionsCreated}\n";
        echo "✅ Alerts generated     : {$alertsCreated}\n";
        echo "\n🎉 Database seeded successfully!\n";
        echo "   You can now start the Laravel server: php artisan serve\n";
    }
}
