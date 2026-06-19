<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size:12px; color:#111; background:#fff; }

  .header { background:#1e3a5f; padding:22px 32px; }
  .header-inner { display:table; width:100%; }
  .header-left  { display:table-cell; vertical-align:middle; }
  .header-right { display:table-cell; vertical-align:middle; text-align:right; }
  .header-eyebrow { color:#93c5fd; font-size:10px; letter-spacing:2px; margin-bottom:3px; }
  .header-title   { color:#fff; font-size:20px; font-weight:700; }
  .header-meta    { color:#93c5fd; font-size:10px; margin-bottom:2px; }
  .header-date    { color:#fff; font-size:12px; }

  .section { padding:20px 32px 0; }
  .section-last { padding:20px 32px; }

  .company-row { display:table; width:100%; margin-bottom:14px; }
  .company-left  { display:table-cell; vertical-align:top; }
  .company-right { display:table-cell; vertical-align:top; text-align:right; width:120px; }
  .company-name { font-size:18px; font-weight:700; margin-bottom:2px; }
  .company-sub  { font-size:11px; color:#6b7280; }
  .quarter-label { font-size:10px; color:#6b7280; margin-bottom:2px; }
  .quarter-val   { font-size:14px; font-weight:600; }

  .verdict-box { border:1px solid #bbf7d0; background:#f0fdf4; border-radius:6px; padding:14px 18px; margin-bottom:20px; display:table; width:100%; }
  .verdict-icon-cell { display:table-cell; vertical-align:middle; width:44px; }
  .verdict-icon { width:40px; height:40px; background:#22c55e; border-radius:50%; text-align:center; line-height:38px; color:#fff; font-size:24px; font-weight:900; font-family:Arial,sans-serif; }
  .verdict-main-cell { display:table-cell; vertical-align:middle; padding:0 12px; }
  .verdict-label { font-size:16px; font-weight:700; color:#15803d; margin-bottom:2px; }
  .verdict-sub   { font-size:11px; color:#166534; }
  .verdict-prob-cell { display:table-cell; vertical-align:middle; text-align:right; width:110px; }
  .prob-title { font-size:10px; color:#6b7280; margin-bottom:4px; }
  .prob-low  { font-size:11px; font-weight:600; color:#22c55e; }
  .prob-med  { font-size:11px; color:#f59e0b; }
  .prob-high { font-size:11px; color:#ef4444; }

  .section-label { font-size:10px; letter-spacing:1.5px; color:#6b7280; margin-bottom:10px; }
  .ratio-grid { width:100%; border-collapse:separate; border-spacing:10px; margin:-10px; }
  .ratio-cell { width:50%; vertical-align:top; }
  .ratio-card { border:1px solid #e5e7eb; border-radius:6px; padding:12px 14px; }
  .ratio-card-header { display:table; width:100%; margin-bottom:6px; }
  .ratio-card-header-left  { display:table-cell; font-size:10px; color:#6b7280; vertical-align:middle; }
  .ratio-card-header-right { display:table-cell; text-align:right; vertical-align:middle; }
  .badge { font-size:9px; padding:2px 7px; border-radius:10px; font-weight:600; }
  .badge-green  { background:#dcfce7; color:#166534; }
  .badge-amber  { background:#fef9c3; color:#854d0e; }
  .badge-red    { background:#fee2e2; color:#991b1b; }
  .ratio-value  { font-size:20px; font-weight:700; margin-bottom:5px; }
  .ratio-green  { color:#15803d; }
  .ratio-amber  { color:#d97706; }
  .ratio-red    { color:#ef4444; }
  .bar-bg  { height:4px; background:#e5e7eb; border-radius:2px; margin-bottom:4px; }
  .bar-fill { height:4px; border-radius:2px; }
  .bar-green { background:#22c55e; }
  .bar-amber { background:#f59e0b; }
  .bar-red   { background:#ef4444; }
  .ratio-note { font-size:9px; color:#9ca3af; }

  .shap-row { margin-bottom:8px; }
  .shap-header { display:table; width:100%; margin-bottom:3px; }
  .shap-name  { display:table-cell; font-size:11px; }
  .shap-score { display:table-cell; font-size:11px; color:#6b7280; text-align:right; width:60px; }
  .shap-bar-bg   { height:5px; background:#e5e7eb; border-radius:3px; }
  .shap-bar-fill { height:5px; border-radius:3px; }
  .shap-blue   { background:#3b82f6; }
  .shap-purple { background:#8b5cf6; }
  .shap-amber  { background:#f59e0b; }

  .summary-box { margin:0 32px 16px; background:#f9fafb; border-left:3px solid #1e3a5f; padding:12px 14px; border-radius:0 4px 4px 0; }
  .summary-text { font-size:11px; line-height:1.75; color:#374151; }

  .footer { background:#f9fafb; border-top:1px solid #e5e7eb; padding:10px 32px; display:table; width:100%; }
  .footer-left  { display:table-cell; font-size:9px; color:#9ca3af; vertical-align:middle; }
  .footer-right { display:table-cell; font-size:9px; color:#9ca3af; text-align:right; vertical-align:middle; }
  .divider { border:none; border-top:1px solid #e5e7eb; margin:0 32px; }
</style>
</head>
<body>

{{-- HEADER --}}
<div class="header">
  <div class="header-inner">
    <div class="header-left">
      <div class="header-eyebrow">FINANCIAL RISK REPORT</div>
      <div class="header-title">FinXG</div>
    </div>
    <div class="header-right">
      <div class="header-meta">Generated</div>
      <div class="header-date">{{ $generated_at }}</div>
    </div>
  </div>
</div>

{{-- COMPANY + QUARTER --}}
<div class="section">
  <div class="company-row">
    <div class="company-left">
      <div class="company-name">{{ $company_name }}</div>
      <div class="company-sub">{{ $sector }} · {{ $industry }} · {{ $country }}</div>
    </div>
    <div class="company-right">
      <div class="quarter-label">Quarter</div>
      <div class="quarter-val">{{ $quarter_label }}</div>
    </div>
  </div>

  {{-- RISK VERDICT --}}
  <div class="verdict-box" style="border-color:{{ $verdict_border }};background:{{ $verdict_bg }}">
    <div class="verdict-icon-cell">
      <div style="width:40px;height:40px;background:{{ $verdict_color }};border-radius:50%;text-align:center;padding-top:12px;color:#fff;font-size:12px;font-weight:900;font-family:Arial,sans-serif;box-sizing:border-box;">OK</div>
    </div>
    <div class="verdict-main-cell">
      <div class="verdict-label" style="color:{{ $verdict_text_dark }}">{{ $risk_label_display }}</div>
      <div class="verdict-sub" style="color:{{ $verdict_text_mid }}">
        Model confidence: {{ $confidence }}% &mdash; XGBoost classifier
      </div>
    </div>
    <div class="verdict-prob-cell">
      <div class="prob-title">PROBABILITIES</div>
      <div class="prob-low">Low: {{ $prob_low }}%</div>
      <div class="prob-med">Med: {{ $prob_medium }}%</div>
      <div class="prob-high">High: {{ $prob_high }}%</div>
    </div>
  </div>
</div>

<hr class="divider"/>

{{-- KEY RATIOS --}}
<div class="section">
  <div class="section-label">KEY FINANCIAL RATIOS</div>
  <table class="ratio-grid">
    <tr>
      {{-- Current Ratio --}}
      <td class="ratio-cell">
        <div class="ratio-card">
          <div class="ratio-card-header">
            <div class="ratio-card-header-left">Current ratio</div>
            <div class="ratio-card-header-right">
              <span class="badge {{ $ratios['current_ratio']['badge_class'] }}">
                {{ $ratios['current_ratio']['badge_label'] }}
              </span>
            </div>
          </div>
          <div class="ratio-value {{ $ratios['current_ratio']['color_class'] }}">
            {{ $ratios['current_ratio']['display'] }}
          </div>
          <div class="bar-bg">
            <div class="bar-fill {{ $ratios['current_ratio']['bar_class'] }}"
                 style="width:{{ $ratios['current_ratio']['bar_pct'] }}%"></div>
          </div>
          <div class="ratio-note">IT avg 1.5–2.0 &middot; danger &lt; 1.0</div>
        </div>
      </td>
      {{-- D/E Ratio --}}
      <td class="ratio-cell">
        <div class="ratio-card">
          <div class="ratio-card-header">
            <div class="ratio-card-header-left">Debt / equity</div>
            <div class="ratio-card-header-right">
              <span class="badge {{ $ratios['debt_to_equity']['badge_class'] }}">
                {{ $ratios['debt_to_equity']['badge_label'] }}
              </span>
            </div>
          </div>
          <div class="ratio-value {{ $ratios['debt_to_equity']['color_class'] }}">
            {{ $ratios['debt_to_equity']['display'] }}
          </div>
          <div class="bar-bg">
            <div class="bar-fill {{ $ratios['debt_to_equity']['bar_class'] }}"
                 style="width:{{ $ratios['debt_to_equity']['bar_pct'] }}%"></div>
          </div>
          <div class="ratio-note">IT avg &lt; 1.0 &middot; danger &gt; 2.0</div>
        </div>
      </td>
    </tr>
    <tr>
      {{-- Operating Margin --}}
      <td class="ratio-cell">
        <div class="ratio-card">
          <div class="ratio-card-header">
            <div class="ratio-card-header-left">Operating margin</div>
            <div class="ratio-card-header-right">
              <span class="badge {{ $ratios['operating_margin']['badge_class'] }}">
                {{ $ratios['operating_margin']['badge_label'] }}
              </span>
            </div>
          </div>
          <div class="ratio-value {{ $ratios['operating_margin']['color_class'] }}">
            {{ $ratios['operating_margin']['display'] }}
          </div>
          <div class="bar-bg">
            <div class="bar-fill {{ $ratios['operating_margin']['bar_class'] }}"
                 style="width:{{ $ratios['operating_margin']['bar_pct'] }}%"></div>
          </div>
          <div class="ratio-note">IT avg 15–25% &middot; danger &lt; 0%</div>
        </div>
      </td>
      {{-- Free Cash Flow --}}
      <td class="ratio-cell">
        <div class="ratio-card">
          <div class="ratio-card-header">
            <div class="ratio-card-header-left">Free cash flow</div>
            <div class="ratio-card-header-right">
              <span class="badge {{ $ratios['free_cash_flow']['badge_class'] }}">
                {{ $ratios['free_cash_flow']['badge_label'] }}
              </span>
            </div>
          </div>
          <div class="ratio-value {{ $ratios['free_cash_flow']['color_class'] }}">
            {{ $ratios['free_cash_flow']['display'] }}
          </div>
          <div class="bar-bg">
            <div class="bar-fill {{ $ratios['free_cash_flow']['bar_class'] }}"
                 style="width:{{ $ratios['free_cash_flow']['bar_pct'] }}%"></div>
          </div>
          <div class="ratio-note">Healthy if &gt; 0</div>
        </div>
      </td>
    </tr>
  </table>
</div>

<hr class="divider" style="margin-top:10px;"/>

{{-- SHAP DRIVERS --}}
<div class="section-last">
  <div class="section-label">TOP RISK DRIVERS (SHAP)</div>
  @foreach($shap_drivers as $i => $driver)
  <div class="shap-row">
    <div class="shap-header">
      <div class="shap-name">{{ $driver['label'] }}</div>
      <div class="shap-score">{{ $driver['importance'] }}</div>
    </div>
    <div class="shap-bar-bg">
      <div class="shap-bar-fill {{ $i === 0 ? 'shap-blue' : ($i === 1 ? 'shap-purple' : 'shap-amber') }}"
           style="width:{{ $driver['pct'] }}%"></div>
    </div>
  </div>
  @endforeach
</div>

{{-- SUMMARY --}}
<div class="summary-box">
  <div class="summary-text">{{ $summary }}</div>
</div>

{{-- FOOTER --}}
<div class="footer">
  <div class="footer-left">
    Generated by FinXG &middot; XGBoost model &middot; F1 = 0.947 &middot; GroupKFold validated
  </div>
  <div class="footer-right">Confidential &mdash; TAC-TIC internal use only</div>
</div>

</body>
</html>