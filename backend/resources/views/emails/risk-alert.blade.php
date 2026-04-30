<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Risk Alert</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #f1f5f9; }
    .wrapper { max-width: 600px; margin: 0 auto; padding: 32px 16px; }
    .card { background: #1e293b; border-radius: 16px; overflow: hidden; border: 1px solid #334155; }
    .header { padding: 32px; text-align: center; }
    .logo { font-size: 20px; font-weight: 700; color: #3b82f6; margin-bottom: 24px; letter-spacing: -0.5px; }
    .risk-badge { display: inline-block; padding: 10px 24px; border-radius: 999px; font-weight: 700; font-size: 18px; margin-bottom: 12px; }
    .risk-high   { background: #ef444420; color: #ef4444; border: 1px solid #ef444440; }
    .risk-medium { background: #f59e0b20; color: #f59e0b; border: 1px solid #f59e0b40; }
    .risk-low    { background: #22c55e20; color: #22c55e; border: 1px solid #22c55e40; }
    .company-name { font-size: 24px; font-weight: 700; color: #f1f5f9; margin-bottom: 4px; }
    .ticker { font-size: 13px; color: #94a3b8; font-family: monospace; }
    .body { padding: 0 32px 32px; }
    .change-row { display: flex; align-items: center; justify-content: center; gap: 16px; margin: 24px 0; padding: 20px; background: #0f172a; border-radius: 12px; }
    .change-label { font-size: 12px; color: #64748b; margin-bottom: 4px; text-align: center; }
    .change-value { font-size: 15px; font-weight: 600; text-align: center; }
    .arrow { font-size: 24px; color: #475569; }
    .section-title { font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
    .meta-item { background: #0f172a; border-radius: 10px; padding: 14px; }
    .meta-label { font-size: 11px; color: #64748b; margin-bottom-4px; }
    .meta-value { font-size: 15px; font-weight: 600; color: #f1f5f9; margin-top: 4px; }
    .drivers { background: #0f172a; border-radius: 10px; padding: 16px; margin-bottom: 24px; }
    .driver-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #1e293b; }
    .driver-row:last-child { border-bottom: none; }
    .driver-name { font-size: 13px; color: #cbd5e1; text-transform: capitalize; }
    .driver-bar-wrap { flex: 1; margin: 0 12px; background: #1e293b; border-radius: 999px; height: 4px; }
    .driver-bar { height: 4px; border-radius: 999px; background: #3b82f6; }
    .driver-val { font-size: 12px; color: #64748b; font-family: monospace; }
    .cta { text-align: center; margin: 24px 0; }
    .cta a { display: inline-block; background: #3b82f6; color: #fff; text-decoration: none; padding: 12px 32px; border-radius: 10px; font-weight: 600; font-size: 14px; }
    .footer { padding: 24px 32px; border-top: 1px solid #334155; text-align: center; }
    .footer p { font-size: 12px; color: #475569; line-height: 1.6; }
  </style>
</head>
<body>
<div class="wrapper">
  <div class="card">

    <!-- Header -->
    <div class="header">
      <div class="logo">⚡ FinXG</div>

      @php
        $riskClass = match($currentRisk)  {
          'high_risk'   => 'risk-high',
          'medium_risk' => 'risk-medium',
          default       => 'risk-low',
        };
        $riskText = ucwords(str_replace('_', ' ', $currentRisk));
        $prevText = ucwords(str_replace('_', ' ', $previousRisk));
        $emoji = match($currentRisk) {
          'high_risk'   => '🔴',
          'medium_risk' => '🟡',
          default       => '🟢',
        };
      @endphp

      <div class="risk-badge {{ $riskClass }}">{{ $emoji }} {{ $riskText }}</div>
      <div class="company-name">{{ $companyName }}</div>
      <div class="ticker">{{ $ticker }}</div>
    </div>

    <!-- Body -->
    <div class="body">

      <!-- Risk change -->
      <div class="change-row">
        <div>
          <div class="change-label">Previous Risk</div>
          <div class="change-value" style="color: #94a3b8;">{{ $prevText }}</div>
        </div>
        <div class="arrow">→</div>
        <div>
          <div class="change-label">New Risk</div>
          <div class="change-value
            @if($currentRisk === 'high_risk') style="color:#ef4444"
            @elseif($currentRisk === 'medium_risk') style="color:#f59e0b"
            @else style="color:#22c55e" @endif
          ">{{ $riskText }}</div>
        </div>
      </div>

      <!-- Meta -->
      <p class="section-title">Quarter Details</p>
      <div class="meta-grid">
        <div class="meta-item">
          <div class="meta-label">Quarter Date</div>
          <div class="meta-value">{{ $quarterDate }}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Model Confidence</div>
          <div class="meta-value">{{ number_format($confidence * 100, 1) }}%</div>
        </div>
      </div>

      <!-- Top drivers -->
      @if(!empty($topDrivers))
      <p class="section-title">Top Risk Drivers</p>
      <div class="drivers">
        @foreach($topDrivers as $driver)
        <div class="driver-row">
          <span class="driver-name">{{ str_replace('_', ' ', $driver['feature']) }}</span>
          <div class="driver-bar-wrap">
            <div class="driver-bar" style="width: {{ min(($driver['importance'] / 1.5) * 100, 100) }}%"></div>
          </div>
          <span class="driver-val">{{ number_format($driver['importance'], 4) }}</span>
        </div>
        @endforeach
      </div>
      @endif

      <!-- CTA -->
      <div class="cta">
        <a href="{{ config('app.frontend_url', 'http://localhost:5173') }}/dashboard">View Full Dashboard →</a>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p>
        You are receiving this alert because you are watching {{ $companyName }} on FinXG.<br/>
        This is an automated alert generated by the ML risk detection system.
      </p>
    </div>

  </div>
</div>
</body>
</html>
