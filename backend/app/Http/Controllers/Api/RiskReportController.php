<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\Quarter;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;

class RiskReportController extends Controller
{
    public function download(Request $request, string $ticker)
    {
        // ── Auth via query-string token (for direct browser navigation) ──
        // When opened in a new tab, the browser cannot send an Authorization
        // header — so we accept the token as ?token=xxx and authenticate manually.
        if ($request->query('token') && !$request->bearerToken()) {
            $request->headers->set('Authorization', 'Bearer ' . $request->query('token'));
        }

        $user = auth('sanctum')->user();
        if (!$user) {
            return response()->json(['error' => 'Unauthenticated.'], 401);
        }

        try {
        // ── Fetch company ──────────────────────────────────────────
        $company = Company::where('ticker', strtoupper($ticker))->firstOrFail();

        // ── Fetch quarter ──────────────────────────────────────────
        $quarterDate = $request->query('quarter');
        $query = Quarter::where('company_id', $company->id)
            ->with('riskPrediction');

        $quarter = $quarterDate
            ? $query->whereDate('quarter_date', $quarterDate)->firstOrFail()
            : $query->orderByDesc('quarter_date')->firstOrFail();

        $prediction = $quarter->riskPrediction;

        // ── Quarter label ──────────────────────────────────────────
        $date         = \Carbon\Carbon::parse($quarter->quarter_date);
        $quarterLabel = 'Q' . ceil($date->month / 3) . ' ' . $date->year;

        // ── Verdict colors ─────────────────────────────────────────
        $label = $prediction->risk_label ?? 'low_risk';
        [$verdictColor, $verdictBorder, $verdictBg, $verdictTextDark, $verdictTextMid, $labelDisplay] =
            match ($label) {
                'high_risk'   => ['#ef4444', '#fca5a5', '#fef2f2', '#991b1b', '#b91c1c', 'High Risk'],
                'medium_risk' => ['#f59e0b', '#fcd34d', '#fffbeb', '#92400e', '#b45309', 'Medium Risk'],
                default       => ['#22c55e', '#bbf7d0', '#f0fdf4', '#15803d', '#166534', 'Low Risk'],
            };

        // ── Ratio cards ────────────────────────────────────────────
        $ratios = [
            'current_ratio' => $this->ratioCard(
                $quarter->current_ratio,
                fn($v) => $v >= 1.5  ? 'green' : ($v >= 1.0 ? 'amber' : 'red'),
                fn($v) => $v >= 1.5  ? 'Healthy' : ($v >= 1.0 ? 'Watch' : 'Danger'),
                fn($v) => min(100, round(($v / 4) * 100)),
                number_format($quarter->current_ratio, 2)
            ),
            'debt_to_equity' => $this->ratioCard(
                $quarter->debt_to_equity,
                fn($v) => $v <= 1.0  ? 'green' : ($v <= 2.0 ? 'amber' : 'red'),
                fn($v) => $v <= 1.0  ? 'Healthy' : ($v <= 2.0 ? 'Watch' : 'Danger'),
                fn($v) => min(100, round((min($v, 3) / 3) * 100)),
                number_format($quarter->debt_to_equity, 3)
            ),
            'operating_margin' => $this->ratioCard(
                $quarter->operating_margin,
                fn($v) => $v >= 0.15 ? 'green' : ($v >= 0 ? 'amber' : 'red'),
                fn($v) => $v >= 0.15 ? 'Healthy' : ($v >= 0 ? 'Below avg' : 'Danger'),
                fn($v) => max(0, min(100, round((($v * 100 + 10) / 40) * 100))),
                number_format($quarter->operating_margin * 100, 1) . '%'
            ),
            'free_cash_flow' => $this->ratioCard(
                $quarter->free_cash_flow,
                fn($v) => $v >= 0    ? 'green' : 'red',
                fn($v) => $v >= 0    ? 'Positive' : 'Negative',
                fn($v) => $v >= 0    ? min(100, round(($v / 500) * 100)) : 0,
                ($quarter->free_cash_flow >= 0 ? '+' : '-') . '$' . number_format(abs((float)$quarter->free_cash_flow), 1) . 'M'
            ),
        ];

        // ── SHAP drivers ───────────────────────────────────────────
        $drivers    = collect($prediction->top_risk_drivers ?? [])
            ->take(3)
            ->values();
        $maxImp     = $drivers->max('importance') ?: 1;
        $shapDrivers = $drivers->map(fn($d) => [
            'label'      => str_replace('_', ' ', ucwords($d['feature'] ?? '', '_')),
            'importance' => number_format($d['importance'], 4),
            'pct'        => round(($d['importance'] / $maxImp) * 100),
        ])->toArray();

        // ── Auto-generated summary ─────────────────────────────────
        $summary = $this->buildSummary($company, $quarter, $prediction, $quarterLabel, $labelDisplay);

        // ── Build PDF ──────────────────────────────────────────────
        $data = [
            'generated_at'     => now()->format('d F Y'),
            'company_name'     => $company->name,
            'ticker'           => strtoupper($ticker),
            'sector'           => $company->sector    ?? 'Technology',
            'industry'         => $company->industry  ?? 'Software & IT Services',
            'country'          => $company->country   ?? 'USA',
            'quarter_label'    => $quarterLabel,
            'risk_label_display' => $labelDisplay,
            'confidence'       => number_format(($prediction->confidence ?? 0) * 100, 2),
            'prob_low'         => number_format(($prediction->prob_low_risk    ?? 0) * 100, 2),
            'prob_medium'      => number_format(($prediction->prob_medium_risk ?? 0) * 100, 2),
            'prob_high'        => number_format(($prediction->prob_high_risk   ?? 0) * 100, 2),
            'verdict_color'    => $verdictColor,
            'verdict_border'   => $verdictBorder,
            'verdict_bg'       => $verdictBg,
            'verdict_text_dark'=> $verdictTextDark,
            'verdict_text_mid' => $verdictTextMid,
            'ratios'           => $ratios,
            'shap_drivers'     => $shapDrivers,
            'summary'          => $summary,
        ];

        $pdf = Pdf::loadView('reports.risk_report', $data)
            ->setPaper('a4', 'portrait')
            ->setOptions([
                'isHtml5ParserEnabled' => true,
                'isRemoteEnabled'      => false,
                'defaultFont'          => 'Arial',
            ]);

        $filename = 'finxg-risk-' . strtolower($ticker) . '-' . $quarterLabel . '.pdf';
        $filename = str_replace(' ', '-', $filename);

        return $pdf->stream($filename);

        } catch (\Throwable $e) {
            return response()->json([
                'error' => $e->getMessage(),
                'file'  => basename($e->getFile()),
                'line'  => $e->getLine(),
            ], 500);
        }
    }

    // ── Helpers ────────────────────────────────────────────────────

    private function ratioCard(
        $value,
        callable $colorFn,
        callable $labelFn,
        callable $barFn,
        string $display
    ): array {
        $v     = (float) ($value ?? 0);
        $color = $colorFn($v);
        return [
            'display'     => $display,
            'color_class' => "ratio-{$color}",
            'badge_class' => "badge-{$color}",
            'badge_label' => $labelFn($v),
            'bar_class'   => "bar-{$color}",
            'bar_pct'     => $barFn($v),
        ];
    }

    private function buildSummary($company, $quarter, $prediction, string $quarterLabel, string $labelDisplay): string
    {
        $confidence = number_format(($prediction->confidence ?? 0) * 100, 2);
        $cr  = number_format($quarter->current_ratio ?? 0, 2);
        $de  = number_format($quarter->debt_to_equity ?? 0, 3);
        $om  = number_format(($quarter->operating_margin ?? 0) * 100, 1);
        $fcf = (float)($quarter->free_cash_flow ?? 0);
        $fcfStr = ($fcf >= 0 ? '+$' : '-$') . number_format(abs($fcf), 1) . 'M';

        $label = $prediction->risk_label ?? 'low_risk';

        $liquidity = $quarter->current_ratio >= 1.5
            ? "strong liquidity (current ratio {$cr})"
            : ($quarter->current_ratio >= 1.0
                ? "adequate liquidity (current ratio {$cr}, approaching the danger threshold of 1.0)"
                : "weak liquidity (current ratio {$cr}, below the 1.0 danger threshold)");

        $leverage = $quarter->debt_to_equity <= 1.0
            ? "negligible leverage (D/E {$de})"
            : ($quarter->debt_to_equity <= 2.0
                ? "moderate leverage (D/E {$de})"
                : "high leverage (D/E {$de}, above the 2.0 danger threshold)");

        $marginNote = $quarter->operating_margin >= 0.15
            ? "Operating margin of {$om}% is above the IT sector average of 15–25%."
            : ($quarter->operating_margin >= 0
                ? "Operating margin of {$om}% is positive but below the IT sector average of 15–25%, indicating a monitor point."
                : "Operating margin of {$om}% is negative, a significant risk signal.");

        $fcfNote = $fcf >= 0
            ? "Free cash flow is positive ({$fcfStr}), confirming solid cash generation."
            : "Free cash flow turned negative this quarter ({$fcfStr}), which warrants monitoring.";

        return "Based on {$quarterLabel} financial data, {$company->name} is classified as {$labelDisplay} "
            . "with {$confidence}% confidence. The company maintains {$liquidity} and {$leverage}, "
            . "well within safe thresholds. {$marginNote} {$fcfNote}";
    }
}