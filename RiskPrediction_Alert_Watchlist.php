<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// ── RiskPrediction ─────────────────────────────────────────────────────────────
class RiskPrediction extends Model
{
    protected $fillable = [
        'company_id', 'quarter_id', 'risk_label', 'confidence',
        'prob_high_risk', 'prob_low_risk', 'prob_medium_risk',
        'top_risk_drivers', 'model_version', 'predicted_at',
    ];

    protected $casts = [
        'top_risk_drivers' => 'array',
        'confidence'       => 'decimal:4',
        'prob_high_risk'   => 'decimal:4',
        'prob_low_risk'    => 'decimal:4',
        'prob_medium_risk' => 'decimal:4',
        'predicted_at'     => 'datetime',
    ];

    public function quarter()
    {
        return $this->belongsTo(Quarter::class);
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    // Helper: risk color for frontend
    public function getRiskColorAttribute(): string
    {
        return match($this->risk_label) {
            'high_risk'   => '#ef4444',
            'medium_risk' => '#f59e0b',
            'low_risk'    => '#22c55e',
            default       => '#6b7280',
        };
    }
}


// ── Alert ──────────────────────────────────────────────────────────────────────
class Alert extends Model
{
    protected $fillable = [
        'company_id', 'quarter_id', 'user_id',
        'type', 'severity', 'message',
        'is_read', 'triggered_at', 'read_at',
    ];

    protected $casts = [
        'is_read'      => 'boolean',
        'triggered_at' => 'datetime',
        'read_at'      => 'datetime',
    ];

    public function company()
    {
        return $this->belongsTo(Company::class);
    }

    public function quarter()
    {
        return $this->belongsTo(Quarter::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    // Helper: severity color for frontend
    public function getSeverityColorAttribute(): string
    {
        return match($this->severity) {
            'critical' => '#ef4444',
            'warning'  => '#f59e0b',
            'info'     => '#3b82f6',
            default    => '#6b7280',
        };
    }
}


// ── UserCompanyWatchlist ───────────────────────────────────────────────────────
class UserCompanyWatchlist extends Model
{
    protected $fillable = [
        'user_id', 'company_id',
        'notify_on_high_risk', 'notify_on_change',
    ];

    protected $casts = [
        'notify_on_high_risk' => 'boolean',
        'notify_on_change'    => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }
}
