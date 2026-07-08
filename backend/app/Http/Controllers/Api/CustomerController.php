<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CustomerController extends Controller
{
    public function index(Request $request)
    {
        $query = Customer::query()->withCount('orders');

        if ($request->filled('search')) {
            $search = $request->search;

            $query->where(function ($q) use ($search) {
                $q->where('first_name', 'like', '%' . $search . '%')
                    ->orWhere('last_name', 'like', '%' . $search . '%')
                    ->orWhere('email', 'like', '%' . $search . '%')
                    ->orWhere('phone', 'like', '%' . $search . '%');
            });
        }

        $customers = $query->latest()->get();

        return response()->json([
            'success' => true,
            'data' => $customers,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:customers,email'],
            'phone' => ['nullable', 'string', 'max:30'],
            'address' => ['nullable', 'string'],
        ]);

        $customer = Customer::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Client créé avec succès.',
            'data' => $customer,
        ], 201);
    }

    public function show(Customer $customer)
    {
        $customer->load([
            'orders' => function ($query) {
                $query->latest();
            },
            'orders.items.product'
        ]);

        return response()->json([
            'success' => true,
            'data' => $customer,
        ]);
    }

    public function update(Request $request, Customer $customer)
    {
        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'email' => [
                'required',
                'email',
                'max:255',
                Rule::unique('customers', 'email')->ignore($customer->id),
            ],
            'phone' => ['nullable', 'string', 'max:30'],
            'address' => ['nullable', 'string'],
        ]);

        $customer->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Client modifié avec succès.',
            'data' => $customer,
        ]);
    }

    public function destroy(Customer $customer)
    {
        if ($customer->orders()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Impossible de supprimer ce client car il possède des commandes.',
            ], 400);
        }

        $customer->delete();

        return response()->json([
            'success' => true,
            'message' => 'Client supprimé avec succès.',
        ]);
    }

    public function orders(Customer $customer)
    {
        $orders = $customer->orders()
            ->with('items.product')
            ->latest()
            ->get();

        return response()->json([
            'success' => true,
            'data' => $orders,
        ]);
    }
}