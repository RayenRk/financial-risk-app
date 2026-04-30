<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CompanyController;
use App\Http\Controllers\Api\QuarterController;
use App\Http\Controllers\Api\RiskPredictionController;
use App\Http\Controllers\Api\AlertController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\AnalyzeController;
use Illuminate\Support\Facades\Route;

// Public route — no auth needed
Route::get('/config', function () {
    return response()->json([
        'primary_ticker'       => config('app.primary_ticker'),
        'primary_display_name' => config('app.primary_display_name'),
    ]);
});

// Public
Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login',    [AuthController::class, 'login']);
});

// Authenticated
Route::middleware('auth:sanctum')->group(function () {

    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me',      [AuthController::class, 'me']);

    Route::get('/company',         [CompanyController::class, 'show']);
    Route::get('/company/summary', [CompanyController::class, 'summary']);
    Route::get('/quarters',        [QuarterController::class, 'index']);
    Route::get('/quarters/latest', [QuarterController::class, 'latest']);
    Route::get('/quarters/{id}',   [QuarterController::class, 'show']);

    Route::get('/predictions',             [RiskPredictionController::class, 'index']);
    Route::get('/predictions/latest',      [RiskPredictionController::class, 'latest']);
    Route::get('/predictions/{quarterId}', [RiskPredictionController::class, 'show']);
    Route::post('/predictions/custom',     [RiskPredictionController::class, 'custom']);

    Route::get('/alerts',             [AlertController::class, 'index']);
    Route::get('/alerts/unread',      [AlertController::class, 'unread']);
    Route::patch('/alerts/{id}/read', [AlertController::class, 'markRead']);
    Route::patch('/alerts/read-all',  [AlertController::class, 'markAllRead']);

        // Ticker search proxy
    Route::get('/search', function (\Illuminate\Http\Request $request) {
        $q = $request->query('q', '');
        if (strlen($q) < 1) {
            return response()->json(['results' => []]);
        }
        try {
            $response = \Illuminate\Support\Facades\Http::timeout(10)
                ->get('http://localhost:8001/search', ['q' => $q]);
            return response()->json($response->json());
        } catch (\Exception $e) {
            return response()->json(['results' => []]);
        }
    });

    // Multi-company
    Route::post('/analyze',           [AnalyzeController::class, 'analyze']);
    Route::get('/companies',          [AnalyzeController::class, 'index']);
    Route::get('/companies/{ticker}', [AnalyzeController::class, 'show']);
    // Delete analyzed company (non-primary only)
    Route::delete('/companies/{id}', [AnalyzeController::class, 'destroy']);

    // Admin only
    Route::middleware('role:admin')->group(function () {
        Route::get('/users',         [UserController::class, 'index']);
        Route::get('/users/{id}',    [UserController::class, 'show']);
        Route::patch('/users/{id}',  [UserController::class, 'update']);
        Route::delete('/users/{id}', [UserController::class, 'destroy']);
        Route::post('/company',        [CompanyController::class, 'store']);
        Route::put('/company/{id}',    [CompanyController::class, 'update']);
        Route::post('/company/import', [CompanyController::class, 'import']);
        Route::post('/epam/refresh',   [AnalyzeController::class, 'refreshEpam']);
    });
});