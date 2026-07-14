<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\AiReport;
use App\Models\AiQuestion;
use App\Services\OrderService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Schema;

class DemoDataSeeder extends Seeder
{
    public function run(): void
    {
        Schema::disableForeignKeyConstraints();

        AiQuestion::truncate();
        AiReport::truncate();
        OrderItem::truncate();
        Order::truncate();
        Product::truncate();
        Customer::truncate();
        Category::truncate();

        Schema::enableForeignKeyConstraints();

        $categories = $this->createCategories();
        $products = $this->createProducts($categories);
        $customers = $this->createCustomers();

        $this->createOrders($customers, $products);
    }

    private function createCategories(): array
    {
        $data = [
            'Électronique' => 'Produits électroniques et accessoires.',
            'Mode' => 'Vêtements et accessoires.',
            'Beauté' => 'Produits de beauté et soins.',
            'Maison' => 'Produits pour la maison.',
            'Sport' => 'Articles de sport et bien-être.',
        ];

        $categories = [];

        foreach ($data as $name => $description) {
            $categories[$name] = Category::create([
                'name' => $name,
                'description' => $description,
            ]);
        }

        return $categories;
    }

    private function createProducts(array $categories): array
    {
        $data = [
            [
                'category' => 'Électronique',
                'name' => 'Casque Bluetooth',
                'description' => 'Casque sans fil avec réduction de bruit.',
                'price' => 129.97,
                'stock_quantity' => 8,
                'stock_alert_threshold' => 5,
            ],
            [
                'category' => 'Électronique',
                'name' => 'Souris sans fil',
                'description' => 'Souris ergonomique pour ordinateur.',
                'price' => 25.55,
                'stock_quantity' => 8,
                'stock_alert_threshold' => 5,
            ],
            [
                'category' => 'Électronique',
                'name' => 'Montre connectée',
                'description' => 'Montre connectée avec suivi activité.',
                'price' => 89.00,
                'stock_quantity' => 10,
                'stock_alert_threshold' => 4,
            ],
            [
                'category' => 'Mode',
                'name' => 'T-shirt Oversize',
                'description' => 'T-shirt confortable coupe oversize.',
                'price' => 19.98,
                'stock_quantity' => 20,
                'stock_alert_threshold' => 5,
            ],
            [
                'category' => 'Mode',
                'name' => 'Sac à main',
                'description' => 'Sac élégant pour usage quotidien.',
                'price' => 45.00,
                'stock_quantity' => 12,
                'stock_alert_threshold' => 4,
            ],
            [
                'category' => 'Beauté',
                'name' => 'Crème hydratante',
                'description' => 'Crème hydratante pour soin du visage.',
                'price' => 17.98,
                'stock_quantity' => 9,
                'stock_alert_threshold' => 5,
            ],
            [
                'category' => 'Maison',
                'name' => 'Lampe LED',
                'description' => 'Lampe LED moderne pour bureau.',
                'price' => 35.00,
                'stock_quantity' => 8,
                'stock_alert_threshold' => 5,
            ],
            [
                'category' => 'Sport',
                'name' => 'Tapis Yoga',
                'description' => 'Tapis de yoga antidérapant.',
                'price' => 22.00,
                'stock_quantity' => 5,
                'stock_alert_threshold' => 4,
            ],
            [
                'category' => 'Maison',
                'name' => 'Mug isotherme',
                'description' => 'Mug pratique pour boissons chaudes et froides.',
                'price' => 14.99,
                'stock_quantity' => 18,
                'stock_alert_threshold' => 5,
            ],
        ];

        $products = [];

        foreach ($data as $item) {
            $products[$item['name']] = Product::create([
                'category_id' => $categories[$item['category']]->id,
                'name' => $item['name'],
                'description' => $item['description'],
                'price' => $item['price'],
                'stock_quantity' => $item['stock_quantity'],
                'stock_alert_threshold' => $item['stock_alert_threshold'],
                'image' => null,
                'status' => 'active',
            ]);
        }

        return $products;
    }

    private function createCustomers(): array
    {
        $data = [
            [
                'first_name' => 'Erij',
                'last_name' => 'Ben Amor',
                'email' => 'erij@example.com',
                'phone' => '12345678',
                'address' => 'Sousse, Tunisie',
            ],
            [
                'first_name' => 'Sami',
                'last_name' => 'Achour',
                'email' => 'sami@example.com',
                'phone' => '22223333',
                'address' => 'Monastir, Tunisie',
            ],
            [
                'first_name' => 'Ines',
                'last_name' => 'Sassi',
                'email' => 'ines@example.com',
                'phone' => '55556666',
                'address' => 'Ariana, Tunisie',
            ],
            [
                'first_name' => 'Meriem',
                'last_name' => 'Ben Amor',
                'email' => 'meriem@example.com',
                'phone' => '98765432',
                'address' => 'Tunis, Tunisie',
            ],
        ];

        $customers = [];

        foreach ($data as $item) {
            $customers[$item['email']] = Customer::create($item);
        }

        return $customers;
    }

    private function createOrders(array $customers, array $products): void
    {
        /** @var OrderService $orderService */
        $orderService = app(OrderService::class);

        $orders = [
            [
                'customer' => 'erij@example.com',
                'date' => '2026-01-09 10:15:00',
                'status' => 'delivered',
                'items' => [
                    ['product' => 'Casque Bluetooth', 'quantity' => 1],
                ],
            ],
            [
                'customer' => 'sami@example.com',
                'date' => '2026-03-12 14:30:00',
                'status' => 'confirmed',
                'items' => [
                    ['product' => 'Montre connectée', 'quantity' => 2],
                    ['product' => 'Souris sans fil', 'quantity' => 1],
                ],
            ],
            [
                'customer' => 'ines@example.com',
                'date' => '2026-04-05 11:20:00',
                'status' => 'shipped',
                'items' => [
                    ['product' => 'Sac à main', 'quantity' => 2],
                    ['product' => 'T-shirt Oversize', 'quantity' => 3],
                ],
            ],
            [
                'customer' => 'meriem@example.com',
                'date' => '2026-05-18 16:00:00',
                'status' => 'cancelled',
                'items' => [
                    ['product' => 'Tapis Yoga', 'quantity' => 2],
                ],
            ],
            [
                'customer' => 'erij@example.com',
                'date' => '2026-07-01 09:20:00',
                'status' => 'pending',
                'items' => [
                    ['product' => 'Crème hydratante', 'quantity' => 4],
                    ['product' => 'Lampe LED', 'quantity' => 1],
                ],
            ],
            [
                'customer' => 'erij@example.com',
                'date' => '2026-07-07 15:45:00',
                'status' => 'confirmed',
                'items' => [
                    ['product' => 'Casque Bluetooth', 'quantity' => 2],
                    ['product' => 'Souris sans fil', 'quantity' => 2],
                ],
            ],
            [
                'customer' => 'sami@example.com',
                'date' => '2026-07-15 12:10:00',
                'status' => 'delivered',
                'items' => [
                    ['product' => 'Lampe LED', 'quantity' => 2],
                    ['product' => 'Crème hydratante', 'quantity' => 2],
                ],
            ],
            [
                'customer' => 'ines@example.com',
                'date' => '2026-08-02 17:30:00',
                'status' => 'shipped',
                'items' => [
                    ['product' => 'Sac à main', 'quantity' => 1],
                    ['product' => 'Montre connectée', 'quantity' => 1],
                ],
            ],
            [
                'customer' => 'erij@example.com',
                'date' => '2026-08-10 13:45:00',
                'status' => 'delivered',
                'items' => [
                    ['product' => 'T-shirt Oversize', 'quantity' => 4],
                    ['product' => 'Casque Bluetooth', 'quantity' => 1],
                ],
            ],
            [
                'customer' => 'meriem@example.com',
                'date' => '2026-08-22 18:10:00',
                'status' => 'pending',
                'items' => [
                    ['product' => 'Souris sans fil', 'quantity' => 1],
                    ['product' => 'Tapis Yoga', 'quantity' => 1],
                ],
            ],
            [
                'customer' => 'sami@example.com',
                'date' => '2026-07-25 10:00:00',
                'status' => 'confirmed',
                'items' => [
                    ['product' => 'Mug isotherme', 'quantity' => 3],
                    ['product' => 'Crème hydratante', 'quantity' => 3],
                ],
            ],
            [
                'customer' => 'erij@example.com',
                'date' => '2026-03-25 09:40:00',
                'status' => 'cancelled',
                'items' => [
                    ['product' => 'T-shirt Oversize', 'quantity' => 2],
                ],
            ],
        ];

        foreach ($orders as $orderData) {
            $order = $orderService->createOrder([
                'customer_id' => $customers[$orderData['customer']]->id,
                'order_date' => $orderData['date'],
                'items' => collect($orderData['items'])->map(function ($item) use ($products) {
                    return [
                        'product_id' => $products[$item['product']]->id,
                        'quantity' => $item['quantity'],
                    ];
                })->toArray(),
            ]);

            $this->applyStatus($orderService, $order, $orderData['status']);
        }
    }

    private function applyStatus(OrderService $orderService, Order $order, string $status): void
    {
        if ($status === 'pending') {
            return;
        }

        if ($status === 'cancelled') {
            $orderService->updateStatus($order, 'cancelled');
            return;
        }

        if (in_array($status, ['confirmed', 'shipped', 'delivered'], true)) {
            $order = $orderService->updateStatus($order, 'confirmed');
        }

        if (in_array($status, ['shipped', 'delivered'], true)) {
            $order = $orderService->updateStatus($order, 'shipped');
        }

        if ($status === 'delivered') {
            $orderService->updateStatus($order, 'delivered');
        }
    }
}