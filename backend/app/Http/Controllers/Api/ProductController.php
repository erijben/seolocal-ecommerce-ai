<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        $query = Product::query()->with('category');

        if ($request->filled('search')) {
            $query->where('name', 'like', '%' . $request->search . '%');
        }

        if ($request->filled('category_id')) {
            $query->where('category_id', $request->category_id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->boolean('low_stock')) {
            $query->whereColumn('stock_quantity', '<=', 'stock_alert_threshold');
        }

        $products = $query->latest()->get();

        return response()->json([
            'success' => true,
            'data' => $products,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'category_id' => ['required', 'exists:categories,id'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'price' => ['required', 'numeric', 'min:0'],
            'stock_quantity' => ['required', 'integer', 'min:0'],
            'stock_alert_threshold' => ['nullable', 'integer', 'min:0'],
            'image' => ['nullable', 'string'],
            'status' => ['nullable', 'in:active,inactive'],
        ]);

        $validated['status'] = $validated['status'] ?? 'active';
        $validated['stock_alert_threshold'] = $validated['stock_alert_threshold'] ?? 5;

        $product = Product::create($validated);
        $product->load('category');

        return response()->json([
            'success' => true,
            'message' => 'Produit créé avec succès.',
            'data' => $product,
        ], 201);
    }

    public function show(Product $product)
    {
        $product->load('category');

        return response()->json([
            'success' => true,
            'data' => $product,
        ]);
    }

    public function update(Request $request, Product $product)
    {
        $validated = $request->validate([
            'category_id' => ['required', 'exists:categories,id'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'price' => ['required', 'numeric', 'min:0'],
            'stock_quantity' => ['required', 'integer', 'min:0'],
            'stock_alert_threshold' => ['nullable', 'integer', 'min:0'],
            'image' => ['nullable', 'string'],
            'status' => ['required', 'in:active,inactive'],
        ]);

        $product->update($validated);
        $product->load('category');

        return response()->json([
            'success' => true,
            'message' => 'Produit modifié avec succès.',
            'data' => $product,
        ]);
    }

    public function destroy(Product $product)
    {
        if ($product->orderItems()->exists()) {
            $product->update([
                'status' => 'inactive',
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Ce produit existe dans des commandes. Il a été désactivé au lieu d’être supprimé.',
                'data' => $product,
            ]);
        }

        $product->delete();

        return response()->json([
            'success' => true,
            'message' => 'Produit supprimé avec succès.',
        ]);
    }

    public function lowStock()
    {
        $products = Product::with('category')
            ->whereColumn('stock_quantity', '<=', 'stock_alert_threshold')
            ->latest()
            ->get();

        return response()->json([
            'success' => true,
            'data' => $products,
        ]);
    }
}