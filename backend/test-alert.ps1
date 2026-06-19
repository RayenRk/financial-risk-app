# FinXG Alert Test Script
$env:PGPASSWORD = "admin"
$PG = "psql -U postgres -d financial_risk_db"

function sql($query) {
    Invoke-Expression "$PG -t -c `"$query`""
}
function sqlx($query) {
    Invoke-Expression "$PG -c `"$query`"" | Out-Null
}

Write-Host ""
Write-Host "Setting up risk change test..." -ForegroundColor Cyan

$companyId = (sql "SELECT id FROM companies WHERE ticker = 'EPAM';").Trim()
Write-Host "   Company ID: $companyId" -ForegroundColor Gray

$predId = (sql "SELECT rp.id FROM risk_predictions rp JOIN quarters q ON q.id = rp.quarter_id WHERE q.company_id = $companyId ORDER BY q.quarter_date DESC LIMIT 1;").Trim()
Write-Host "   Latest prediction ID: $predId" -ForegroundColor Gray

$currentRisk = (sql "SELECT risk_label FROM risk_predictions WHERE id = $predId;").Trim()
Write-Host "   Current risk label: $currentRisk" -ForegroundColor Gray

if ($currentRisk -eq "low_risk") { $newRisk = "high_risk" } else { $newRisk = "low_risk" }
Write-Host "   Setting to: $newRisk" -ForegroundColor Yellow

sqlx "UPDATE risk_predictions SET risk_label = '$newRisk' WHERE id = $predId;"
sqlx "UPDATE alerts SET is_read = true, read_at = NOW();"
Write-Host "   Alerts marked as read" -ForegroundColor Gray

Write-Host ""
Write-Host "Running import..." -ForegroundColor Cyan
php artisan epam:import --force

Write-Host ""
Write-Host "Done - check Mailtrap and browser for notification" -ForegroundColor Green
Write-Host ""
