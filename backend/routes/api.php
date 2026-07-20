<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\AiController;
use App\Http\Controllers\Api\KnowledgeBaseController;

Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::apiResource('categories', CategoryController::class);

    Route::apiResource('products', ProductController::class);
    Route::get('/products-low-stock', [ProductController::class, 'lowStock']);

    Route::apiResource('customers', CustomerController::class);
    Route::get('/customers/{customer}/orders', [CustomerController::class, 'orders']);

    Route::get('/orders', [OrderController::class, 'index']);
    Route::post('/orders', [OrderController::class, 'store']);
    Route::get('/orders/{order}', [OrderController::class, 'show']);
    Route::put('/orders/{order}/status', [OrderController::class, 'updateStatus']);
    Route::delete('/orders/{order}', [OrderController::class, 'destroy']);

    Route::get('/dashboard/stats', [DashboardController::class, 'stats']);
    Route::get('/dashboard/sales-by-period', [DashboardController::class, 'salesByPeriod']);
    Route::get('/dashboard/top-products', [DashboardController::class, 'topProducts']);
    Route::get('/dashboard/top-customers', [DashboardController::class, 'topCustomers']);
    Route::get('/dashboard/orders-by-status', [DashboardController::class, 'ordersByStatus']);
    Route::get('/dashboard/low-stock-products', [DashboardController::class, 'lowStockProducts']);

    Route::post('/ai/generate-report', [AiController::class, 'generateReport']);
    Route::get('/ai/stock-forecast', [AiController::class, 'stockForecast']);

    // Routes IA accessibles aux utilisateurs connectés
    Route::post('/ai/ask', [AiController::class, 'ask']);
    Route::get('/ai/questions', [AiController::class, 'questions']);
    Route::get('/ai/reports', [AiController::class, 'reports']);

    Route::middleware('admin')->group(function () {
        Route::get('/ai/agent-insights', [AiController::class, 'agentInsights']);

        // Knowledge Base réservée à l’admin
        Route::post('/knowledge-documents/upload-pdf', [KnowledgeBaseController::class, 'uploadPdf']);
        Route::apiResource('knowledge-documents', KnowledgeBaseController::class);
        Route::post('/knowledge-search', [KnowledgeBaseController::class, 'search']);
    });
});
