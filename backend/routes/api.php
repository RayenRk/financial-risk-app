<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CompanyController;
use App\Http\Controllers\Api\QuarterController;
use App\Http\Controllers\Api\RiskPredictionController;
use App\Http\Controllers\Api\AlertController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

// ── Public routes (no auth required) ──────────────────────────────────────────
Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login',    [AuthController::class, 'login']);
});

// ── Authenticated routes (all roles) ──────────────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    // Auth
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me',      [AuthController::class, 'me']);

    // Company — read only for both roles
    Route::get('/company',          [CompanyController::class, 'show']);
    Route::get('/company/summary',  [CompanyController::class, 'summary']);

    // Quarters — read only for both roles
    Route::get('/quarters',         [QuarterController::class, 'index']);
    Route::get('/quarters/{id}',    [QuarterController::class, 'show']);
    Route::get('/quarters/latest',  [QuarterController::class, 'latest']);

    // Risk predictions — read only for both roles
    Route::get('/predictions',              [RiskPredictionController::class, 'index']);
    Route::get('/predictions/latest',       [RiskPredictionController::class, 'latest']);
    Route::get('/predictions/{quarterId}',  [RiskPredictionController::class, 'show']);
    Route::post('/predictions/custom',      [RiskPredictionController::class, 'custom']);

    // Alerts — each user sees their own
    Route::get('/alerts',           [AlertController::class, 'index']);
    Route::get('/alerts/unread',    [AlertController::class, 'unread']);
    Route::patch('/alerts/{id}/read',       [AlertController::class, 'markRead']);
    Route::patch('/alerts/read-all',        [AlertController::class, 'markAllRead']);

    // ── Admin only routes ──────────────────────────────────────────────────────
    Route::middleware('role:admin')->group(function () {

        // User management
        Route::get('/users',            [UserController::class, 'index']);
        Route::get('/users/{id}',       [UserController::class, 'show']);
        Route::patch('/users/{id}',     [UserController::class, 'update']);
        Route::delete('/users/{id}',    [UserController::class, 'destroy']);

        // Company management
        Route::post('/company',         [CompanyController::class, 'store']);
        Route::put('/company/{id}',     [CompanyController::class, 'update']);

        // Import fresh EPAM data
        Route::post('/company/import',  [CompanyController::class, 'import']);
    });
});
