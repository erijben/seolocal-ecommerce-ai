<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\OrderService;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    public function __construct(private OrderService $orderService)
    {
    }

    public function index(Request $request)
    {
        $query = Order::query()
            ->with('customer')
            ->withCount('items');

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('customer_id')) {
            $query->where('customer_id', $request->customer_id);
        }

        if ($request->filled('date_from')) {
            $query->whereDate('order_date', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('order_date', '<=', $request->date_to);
        }

        $orders = $query->latest()->get();

        return response()->json([
            'success' => true,
            'data' => $orders,
        ]);
    }

    public function store(Request $request)
    {
       $validated = $request->validate([
    'customer_id' => ['required', 'exists:customers,id'],
    'order_date' => ['nullable', 'date'],
    'items' => ['required', 'array', 'min:1'],
    'items.*.product_id' => ['required', 'exists:products,id'],
    'items.*.quantity' => ['required', 'integer', 'min:1'],
]);

        $order = $this->orderService->createOrder($validated);

        return response()->json([
            'success' => true,
            'message' => 'Commande créée avec succès.',
            'data' => $order,
        ], 201);
    }

    public function show(Order $order)
    {
        $order->load('customer', 'items.product.category');

        return response()->json([
            'success' => true,
            'data' => $order,
        ]);
    }

    public function updateStatus(Request $request, Order $order)
    {
        $validated = $request->validate([
            'status' => ['required', 'in:pending,confirmed,shipped,delivered,cancelled'],
        ]);

        $order = $this->orderService->updateStatus($order, $validated['status']);

        return response()->json([
            'success' => true,
            'message' => 'Statut de la commande modifié avec succès.',
            'data' => $order,
        ]);
    }

    public function destroy(Order $order)
    {
        $order = $this->orderService->updateStatus($order, 'cancelled');

        return response()->json([
            'success' => true,
            'message' => 'Commande annulée avec succès.',
            'data' => $order,
        ]);
    }
}