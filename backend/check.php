<?php
$c = App\Models\Company::where('ticker', 'EPAM')->first();
echo "Company found: " . ($c ? $c->name : 'NOT FOUND') . "\n";

$q = App\Models\Quarter::where('company_id', $c?->id)
    ->with('riskPrediction')
    ->latest('quarter_date')
    ->first();
echo "Quarter found: " . ($q ? $q->quarter_date : 'NOT FOUND') . "\n";
echo "Prediction found: " . ($q?->riskPrediction ? 'YES' : 'NOT FOUND') . "\n";

echo "\nView exists: " . (view()->exists('reports.risk_report') ? 'YES' : 'NO') . "\n";
echo "Free cash flow: " . $q?->free_cash_flow . "\n";
echo "Net income: " . $q?->net_income . "\n";