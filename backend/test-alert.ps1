# ── FinXG Alert Test Script ────────────────────────────────────────────────

Write-Host "🔄 Setting up risk change test..." -ForegroundColor Cyan

# Step 1 — Get EPAM company ID
$companyId = psql -U postgres -d financial_risk_db -t -c "SELECT id FROM companies WHERE ticker = 'EPAM';"
$companyId = $companyId.Trim()
Write-Host "   Company ID: $companyId" -ForegroundColor Gray

# Step 2 — Get latest prediction ID for EPAM
$predId = psql -U postgres -d financial_risk_db -t -c "SELECT rp.id FROM risk_predictions rp JOIN quarters q ON q.id = rp.quarter_id WHERE q.company_id = $companyId ORDER BY q.quarter_date DESC LIMIT 1;"
$predId = $predId.Trim()
Write-Host "   Latest prediction ID: $predId" -ForegroundColor Gray

# Step 3 — Get current risk label
$currentRisk = psql -U postgres -d financial_risk_db -t -c "SELECT risk_label FROM risk_predictions WHERE id = $predId;"
$currentRisk = $currentRisk.Trim()
Write-Host "   Current risk label: $currentRisk" -ForegroundColor Gray

# Step 4 — Set opposite risk to guarantee a change
if ($currentRisk -eq "low_risk") {
    $newRisk = "high_risk"
} else {
    $newRisk = "low_risk"
}
Write-Host "   Setting to: $newRisk" -ForegroundColor Yellow

psql -U postgres -d financial_risk_db -c "UPDATE risk_predictions SET risk_label = '$newRisk' WHERE id = $predId;" | Out-Null

# Step 5 — Mark all alerts as read
psql -U postgres -d financial_risk_db -c "UPDATE alerts SET is_read = true, read_at = NOW();" | Out-Null
Write-Host "   Alerts marked as read" -ForegroundColor Gray

# Step 6 — Run import
Write-Host "`n🚀 Running import..." -ForegroundColor Cyan
php artisan epam:import --force

Write-Host "`n✅ Done — check Mailtrap and browser for notification" -ForegroundColor Green