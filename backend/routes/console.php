<?php

use Illuminate\Support\Facades\Schedule;

// ── EPAM auto-refresh schedule ─────────────────────────────────────────────────
// Runs every day at 6am — checks for new EPAM quarterly data
// A new quarter only appears every 3 months so most runs are no-ops
Schedule::command('epam:import')
    ->dailyAt('06:00')
    ->withoutOverlapping()
    ->runInBackground()
    ->appendOutputTo(storage_path('logs/epam-import.log'));
