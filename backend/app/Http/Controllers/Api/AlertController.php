<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Alert;
use Illuminate\Http\Request;

class AlertController extends Controller
{
    // GET /api/alerts — all alerts for current user
    public function index(Request $request)
    {
        $alerts = Alert::with(['company', 'quarter'])
            ->where('user_id', $request->user()->id)
            ->orderByDesc('triggered_at')
            ->get()
            ->map(fn($a) => $this->formatAlert($a));

        return response()->json([
            'alerts'         => $alerts,
            'total'          => $alerts->count(),
            'unread_count'   => $alerts->where('is_read', false)->count(),
        ]);
    }

    // GET /api/alerts/unread — unread alerts only
    public function unread(Request $request)
    {
        $alerts = Alert::with(['company', 'quarter'])
            ->where('user_id', $request->user()->id)
            ->where('is_read', false)
            ->orderByDesc('triggered_at')
            ->get()
            ->map(fn($a) => $this->formatAlert($a));

        return response()->json([
            'alerts' => $alerts,
            'count'  => $alerts->count(),
        ]);
    }

    // PATCH /api/alerts/{id}/read — mark single alert as read
    public function markRead(Request $request, int $id)
    {
        $alert = Alert::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        $alert->update([
            'is_read' => true,
            'read_at' => now(),
        ]);

        return response()->json([
            'message' => 'Alert marked as read.',
            'alert'   => $this->formatAlert($alert),
        ]);
    }

    // PATCH /api/alerts/read-all — mark all alerts as read
    public function markAllRead(Request $request)
    {
        $count = Alert::where('user_id', $request->user()->id)
            ->where('is_read', false)
            ->update([
                'is_read' => true,
                'read_at' => now(),
            ]);

        return response()->json([
            'message'       => 'All alerts marked as read.',
            'updated_count' => $count,
        ]);
    }

    // Format alert for response
    private function formatAlert(Alert $a): array
    {
        return [
            'id'             => $a->id,
            'type'           => $a->type,
            'severity'       => $a->severity,
            'severity_color' => $a->severity_color,
            'message'        => $a->message,
            'is_read'        => $a->is_read,
            'triggered_at'   => $a->triggered_at,
            'read_at'        => $a->read_at,
            'company'        => [
                'id'     => $a->company?->id,
                'name'   => $a->company?->name,
                'ticker' => $a->company?->ticker,
            ],
            'quarter_date'   => $a->quarter?->quarter_date,
        ];
    }
}
