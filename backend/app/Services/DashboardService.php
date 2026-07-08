<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use Illuminate\Support\Facades\DB;

class DashboardService
{
    public function getStats(): array
    {
        return [
            'total_revenue' => Order::where('status', '!=', 'cancelled')->sum('total_amount'),
            'orders_count' => Order::count(),
            'customers_count' => Customer::count(),
            'products_count' => Product::count(),
            'low_stock_count' => Product::whereColumn('stock_quantity', '<=', 'stock_alert_threshold')->count(),
        ];
    }

    public function getSalesByPeriod(string $period = 'monthly')
    {
        $query = Order::query()
            ->where('status', '!=', 'cancelled');

        if ($period === 'daily') {
            return $query
                ->selectRaw('DATE(order_date) as period, SUM(total_amount) as total_sales, COUNT(*) as orders_count')
                ->groupByRaw('DATE(order_date)')
                ->orderBy('period')
                ->get();
        }

        if ($period === 'weekly') {
            return $query
                ->selectRaw('YEARWEEK(order_date) as period, SUM(total_amount) as total_sales, COUNT(*) as orders_count')
                ->groupByRaw('YEARWEEK(order_date)')
                ->orderBy('period')
                ->get();
        }

        if ($period === 'yearly') {
            return $query
                ->selectRaw('YEAR(order_date) as period, SUM(total_amount) as total_sales, COUNT(*) as orders_count')
                ->groupByRaw('YEAR(order_date)')
                ->orderBy('period')
                ->get();
        }

        return $query
            ->selectRaw("DATE_FORMAT(order_date, '%Y-%m') as period, SUM(total_amount) as total_sales, COUNT(*) as orders_count")
            ->groupByRaw("DATE_FORMAT(order_date, '%Y-%m')")
            ->orderBy('period')
            ->get();
    }

    public function getTopProducts(int $limit = 5)
    {
        return OrderItem::query()
            ->join('products', 'order_items.product_id', '=', 'products.id')
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->where('orders.status', '!=', 'cancelled')
            ->select(
                'products.id as product_id',
                'products.name as product_name',
                DB::raw('SUM(order_items.quantity) as total_sold'),
                DB::raw('SUM(order_items.subtotal) as total_revenue')
            )
            ->groupBy('products.id', 'products.name')
            ->orderByDesc('total_sold')
            ->limit($limit)
            ->get();
    }

    public function getTopCustomers(int $limit = 5)
    {
        return Order::query()
            ->join('customers', 'orders.customer_id', '=', 'customers.id')
            ->where('orders.status', '!=', 'cancelled')
            ->select(
                'customers.id as customer_id',
                'customers.first_name',
                'customers.last_name',
                'customers.email',
                DB::raw('COUNT(orders.id) as orders_count'),
                DB::raw('SUM(orders.total_amount) as total_spent')
            )
            ->groupBy(
                'customers.id',
                'customers.first_name',
                'customers.last_name',
                'customers.email'
            )
            ->orderByDesc('total_spent')
            ->limit($limit)
            ->get();
    }

    public function getOrdersByStatus()
    {
        return Order::query()
            ->select('status', DB::raw('COUNT(*) as count'))
            ->groupBy('status')
            ->get();
    }

    public function getLowStockProducts()
    {
        return Product::query()
            ->with('category')
            ->whereColumn('stock_quantity', '<=', 'stock_alert_threshold')
            ->orderBy('stock_quantity')
            ->get();
    }
}