<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class OrderService
{
    public function createOrder(array $data): Order
    {
        return DB::transaction(function () use ($data) {
            $items = collect($data['items'])
                ->groupBy('product_id')
                ->map(function ($rows) {
                    return [
                        'product_id' => (int) $rows->first()['product_id'],
                        'quantity' => $rows->sum('quantity'),
                    ];
                })
                ->values();

            $preparedItems = [];
            $totalAmount = 0;

            foreach ($items as $item) {
                $product = Product::where('id', $item['product_id'])
                    ->lockForUpdate()
                    ->first();

                if (! $product) {
                    throw ValidationException::withMessages([
                        'items' => 'Produit introuvable.',
                    ]);
                }

                if ($product->status !== 'active') {
                    throw ValidationException::withMessages([
                        'items' => "Le produit {$product->name} est inactif.",
                    ]);
                }

                if ($product->stock_quantity < $item['quantity']) {
                    throw ValidationException::withMessages([
                        'items' => "Stock insuffisant pour le produit {$product->name}. Stock disponible : {$product->stock_quantity}.",
                    ]);
                }

                $unitPrice = (float) $product->price;
                $subtotal = $unitPrice * $item['quantity'];

                $preparedItems[] = [
                    'product' => $product,
                    'quantity' => $item['quantity'],
                    'unit_price' => $unitPrice,
                    'subtotal' => $subtotal,
                ];

                $totalAmount += $subtotal;
            }

          $order = Order::create([
    'customer_id' => $data['customer_id'],
    'order_number' => $this->generateOrderNumber(),
    'status' => 'pending',
    'total_amount' => $totalAmount,
    'order_date' => $data['order_date'] ?? now(),
]);

            foreach ($preparedItems as $preparedItem) {
                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $preparedItem['product']->id,
                    'quantity' => $preparedItem['quantity'],
                    'unit_price' => $preparedItem['unit_price'],
                    'subtotal' => $preparedItem['subtotal'],
                ]);

                $preparedItem['product']->decrement('stock_quantity', $preparedItem['quantity']);
            }

            return $order->load('customer', 'items.product');
        });
    }

    public function updateStatus(Order $order, string $newStatus): Order
    {
        return DB::transaction(function () use ($order, $newStatus) {
            $currentStatus = $order->status;

            if ($currentStatus === $newStatus) {
                return $order->load('customer', 'items.product');
            }

            $allowedTransitions = [
                'pending' => ['confirmed', 'cancelled'],
                'confirmed' => ['shipped', 'cancelled'],
                'shipped' => ['delivered'],
                'delivered' => [],
                'cancelled' => [],
            ];

            if (! in_array($newStatus, $allowedTransitions[$currentStatus] ?? [])) {
                throw ValidationException::withMessages([
                    'status' => "Changement de statut non autorisé : {$currentStatus} vers {$newStatus}.",
                ]);
            }

            if ($newStatus === 'cancelled') {
                $this->restoreStock($order);
            }

            $order->update([
                'status' => $newStatus,
            ]);

            return $order->load('customer', 'items.product');
        });
    }

    private function restoreStock(Order $order): void
    {
        $order->load('items.product');

        foreach ($order->items as $item) {
            if ($item->product) {
                $item->product->increment('stock_quantity', $item->quantity);
            }
        }
    }

    private function generateOrderNumber(): string
    {
        do {
            $orderNumber = 'ORD-' . now()->format('Ymd-His') . '-' . Str::upper(Str::random(4));
        } while (Order::where('order_number', $orderNumber)->exists());

        return $orderNumber;
    }
}