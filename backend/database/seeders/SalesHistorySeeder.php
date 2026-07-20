<?php
#générer un vrai historique commercial
namespace Database\Seeders;

use App\Models\AiQuestion;
use App\Models\AiReport;
use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Services\OrderService;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;

class SalesHistorySeeder extends Seeder
{
    public function run(): void
    {
        mt_srand(20260714);

        Schema::disableForeignKeyConstraints();

        AiQuestion::truncate();
        AiReport::truncate();
        OrderItem::truncate();
        Order::truncate();

        Schema::enableForeignKeyConstraints();

        $customers = $this->createExtraCustomers();
        $products = $this->prepareProductsForHistoricalSales();

        $this->generateHistoricalOrders($customers, $products);

        $this->applyFinalStockSnapshot();
    }

    private function createExtraCustomers(): Collection
    {
        $customersData = [
            ['Erij', 'Ben Amor', 'erij@example.com', '12345678', 'Sousse, Tunisie'],
            ['Sami', 'Achour', 'sami@example.com', '22223333', 'Monastir, Tunisie'],
            ['Ines', 'Sassi', 'ines@example.com', '55556666', 'Ariana, Tunisie'],
            ['Meriem', 'Ben Amor', 'meriem@example.com', '98765432', 'Tunis, Tunisie'],

            ['Nour', 'Mansour', 'nour@example.com', '20111222', 'Tunis, Tunisie'],
            ['Yasmine', 'Trabelsi', 'yasmine@example.com', '20222333', 'Sfax, Tunisie'],
            ['Ahmed', 'Khalfaoui', 'ahmed@example.com', '20333444', 'Sousse, Tunisie'],
            ['Rania', 'Mejri', 'rania@example.com', '20444555', 'Nabeul, Tunisie'],
            ['Malek', 'Jebali', 'malek@example.com', '20555666', 'Ariana, Tunisie'],
            ['Sarra', 'Gharbi', 'sarra@example.com', '20666777', 'Bizerte, Tunisie'],
            ['Omar', 'Haddad', 'omar@example.com', '20777888', 'Tunis, Tunisie'],
            ['Lina', 'Bouzid', 'lina@example.com', '20888999', 'Monastir, Tunisie'],
            ['Aya', 'Saidi', 'aya@example.com', '20999000', 'Sousse, Tunisie'],
            ['Karim', 'Mrad', 'karim@example.com', '21111000', 'Mahdia, Tunisie'],
            ['Nesrine', 'Cherif', 'nesrine@example.com', '21222000', 'Tunis, Tunisie'],
            ['Houssem', 'Ayari', 'houssem@example.com', '21333000', 'Sfax, Tunisie'],
            ['Maha', 'Rezgui', 'maha@example.com', '21444000', 'Ariana, Tunisie'],
            ['Amir', 'Mbarek', 'amir@example.com', '21555000', 'Sousse, Tunisie'],
            ['Sirine', 'Kacem', 'sirine@example.com', '21666000', 'Nabeul, Tunisie'],
            ['Firas', 'Hamdi', 'firas@example.com', '21777000', 'Tunis, Tunisie'],
            ['Mariem', 'Louati', 'mariem.louati@example.com', '21888000', 'Sfax, Tunisie'],
            ['Anis', 'Brahmi', 'anis@example.com', '21999000', 'Monastir, Tunisie'],
            ['Rim', 'Toumi', 'rim@example.com', '22000111', 'Bizerte, Tunisie'],
            ['Ali', 'Mokni', 'ali@example.com', '22111222', 'Mahdia, Tunisie'],
        ];

        foreach ($customersData as [$firstName, $lastName, $email, $phone, $address]) {
            Customer::updateOrCreate(
                ['email' => $email],
                [
                    'first_name' => $firstName,
                    'last_name' => $lastName,
                    'phone' => $phone,
                    'address' => $address,
                ]
            );
        }

        return Customer::all();
    }

    private function prepareProductsForHistoricalSales(): Collection
    {
        $initialStocks = [
            'Casque Bluetooth' => 900,
            'Souris sans fil' => 850,
            'Montre connectée' => 500,
            'T-shirt Oversize' => 1000,
            'Sac à main' => 600,
            'Crème hydratante' => 1200,
            'Lampe LED' => 700,
            'Tapis Yoga' => 650,
            'Mug isotherme' => 500,
        ];

        foreach ($initialStocks as $productName => $stock) {
            Product::where('name', $productName)->update([
                'stock_quantity' => $stock,
                'status' => 'active',
            ]);
        }

        return Product::whereIn('name', array_keys($initialStocks))
            ->get()
            ->keyBy('name');
    }

    private function generateHistoricalOrders(Collection $customers, Collection $products): void
    {
        /** @var OrderService $orderService */
        $orderService = app(OrderService::class);

        $startDate = Carbon::create(2026, 1, 1)->startOfDay();
        $endDate = Carbon::create(2026, 8, 31)->endOfDay();

        $currentDate = $startDate->copy();

        while ($currentDate->lte($endDate)) {
            $ordersCount = $this->getDailyOrdersCount($currentDate);

            for ($i = 0; $i < $ordersCount; $i++) {
                $customer = $customers->random();
                $items = $this->generateBasket($currentDate, $products);

                if (empty($items)) {
                    continue;
                }

                $orderDate = $currentDate->copy()
                    ->setTime(
                        mt_rand(9, 21),
                        mt_rand(0, 59),
                        mt_rand(0, 59)
                    );

                $order = $orderService->createOrder([
                    'customer_id' => $customer->id,
                    'order_date' => $orderDate->toDateTimeString(),
                    'items' => $items,
                ]);

                $status = $this->chooseOrderStatus($currentDate);
                $this->applyStatus($orderService, $order, $status);
            }

            $currentDate->addDay();
        }
    }

    private function getDailyOrdersCount(Carbon $date): int
    {
        $month = (int) $date->month;

        $baseByMonth = [
            1 => 1,
            2 => 1,
            3 => 2,
            4 => 2,
            5 => 2,
            6 => 3,
            7 => 4,
            8 => 3,
        ];

        $base = $baseByMonth[$month] ?? 2;

        if ($date->isWeekend()) {
            $base += 1;
        }

        $variation = mt_rand(-1, 1);

        return max(0, $base + $variation);
    }

    private function generateBasket(Carbon $date, Collection $products): array
    {
        $itemsCount = $this->chooseWeighted([
            1 => 70,
            2 => 25,
            3 => 5,
        ]);

        $selectedItems = [];

        for ($i = 0; $i < $itemsCount; $i++) {
            $productName = $this->chooseWeighted($this->getProductWeights($date));

            if (! $products->has($productName)) {
                continue;
            }

            $quantity = $this->getQuantityForProduct($productName);

            if (isset($selectedItems[$productName])) {
                $selectedItems[$productName]['quantity'] += $quantity;
            } else {
                $selectedItems[$productName] = [
                    'product_id' => $products[$productName]->id,
                    'quantity' => $quantity,
                ];
            }
        }

        return array_values($selectedItems);
    }

    private function getProductWeights(Carbon $date): array
    {
        $month = (int) $date->month;

        return [
            'Crème hydratante' => 8 + ($month * 3),
            'T-shirt Oversize' => 15 + ($month >= 5 ? 3 : 0),
            'Casque Bluetooth' => 10 + ($month >= 6 ? 6 : 0),
            'Souris sans fil' => 9,
            'Lampe LED' => 7 + (in_array($month, [3, 4, 5], true) ? 3 : 0),
            'Sac à main' => 5 + (in_array($month, [2, 3, 8], true) ? 4 : 0),
            'Tapis Yoga' => 6 + ($month <= 3 ? 5 : 0),
            'Montre connectée' => 4 + ($month >= 6 ? 3 : 0),
            'Mug isotherme' => 3 + ($month <= 2 ? 4 : 0),
        ];
    }

    private function getQuantityForProduct(string $productName): int
    {
        return match ($productName) {
            'Crème hydratante', 'T-shirt Oversize' => $this->chooseWeighted([
                1 => 55,
                2 => 30,
                3 => 15,
            ]),

            'Souris sans fil', 'Mug isotherme', 'Tapis Yoga' => $this->chooseWeighted([
                1 => 75,
                2 => 20,
                3 => 5,
            ]),

            default => $this->chooseWeighted([
                1 => 85,
                2 => 15,
            ]),
        };
    }

    private function chooseOrderStatus(Carbon $date): string
    {
        if ($date->month === 8 && $date->day >= 20) {
            return $this->chooseWeighted([
                'pending' => 20,
                'confirmed' => 35,
                'shipped' => 30,
                'delivered' => 10,
                'cancelled' => 5,
            ]);
        }

        return $this->chooseWeighted([
            'delivered' => 75,
            'shipped' => 8,
            'confirmed' => 7,
            'pending' => 3,
            'cancelled' => 7,
        ]);
    }

    private function chooseWeighted(array $weights): int|string
    {
        $total = array_sum($weights);
        $random = mt_rand(1, $total);
        $current = 0;

        foreach ($weights as $value => $weight) {
            $current += $weight;

            if ($random <= $current) {
                return is_numeric($value) ? (int) $value : (string) $value;
            }
        }

        return array_key_first($weights);
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

    private function applyFinalStockSnapshot(): void
    {
        $finalStocks = [
            'Crème hydratante' => [
                'stock_quantity' => 18,
                'stock_alert_threshold' => 25,
            ],
            'Casque Bluetooth' => [
                'stock_quantity' => 18,
                'stock_alert_threshold' => 20,
            ],
            'Souris sans fil' => [
                'stock_quantity' => 16,
                'stock_alert_threshold' => 18,
            ],
            'Tapis Yoga' => [
                'stock_quantity' => 18,
                'stock_alert_threshold' => 20,
            ],
            'Lampe LED' => [
                'stock_quantity' => 25,
                'stock_alert_threshold' => 20,
            ],
            'T-shirt Oversize' => [
                'stock_quantity' => 80,
                'stock_alert_threshold' => 30,
            ],
            'Montre connectée' => [
                'stock_quantity' => 45,
                'stock_alert_threshold' => 12,
            ],
            'Sac à main' => [
                'stock_quantity' => 38,
                'stock_alert_threshold' => 15,
            ],
            'Mug isotherme' => [
                'stock_quantity' => 60,
                'stock_alert_threshold' => 20,
            ],
        ];

        foreach ($finalStocks as $productName => $data) {
            Product::where('name', $productName)->update($data);
        }
    }
}