<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CategoryController; 
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\DashboardController;

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
});