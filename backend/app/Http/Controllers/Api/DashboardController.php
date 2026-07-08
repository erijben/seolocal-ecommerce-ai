<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DashboardService;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __construct(private DashboardService $dashboardService)
    {
    }

    public function stats()
    {
        return response()->json([
            'success' => true,
            'data' => $this->dashboardService->getStats(),
        ]);
    }

    public function salesByPeriod(Request $request)
    {
        $validated = $request->validate([
            'period' => ['nullable', 'in:daily,weekly,monthly,yearly'],
        ]);

        $period = $validated['period'] ?? 'monthly';

        return response()->json([
            'success' => true,
            'data' => $this->dashboardService->getSalesByPeriod($period),
        ]);
    }

    public function topProducts(Request $request)
    {
        $limit = $request->integer('limit', 5);

        return response()->json([
            'success' => true,
            'data' => $this->dashboardService->getTopProducts($limit),
        ]);
    }

    public function topCustomers(Request $request)
    {
        $limit = $request->integer('limit', 5);

        return response()->json([
            'success' => true,
            'data' => $this->dashboardService->getTopCustomers($limit),
        ]);
    }

    public function ordersByStatus()
    {
        return response()->json([
            'success' => true,
            'data' => $this->dashboardService->getOrdersByStatus(),
        ]);
    }

    public function lowStockProducts()
    {
        return response()->json([
            'success' => true,
            'data' => $this->dashboardService->getLowStockProducts(),
        ]);
    }
}