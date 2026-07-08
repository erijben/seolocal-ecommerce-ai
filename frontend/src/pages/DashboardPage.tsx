import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import StatCard from "../components/ui/StatCard";
import {
  getDashboardStats,
  getLowStockProducts,
  getOrdersByStatus,
  getSalesByPeriod,
  getTopCustomers,
  getTopProducts,
} from "../api/dashboardApi";
import type {
  DashboardStats,
  LowStockProduct,
  OrdersByStatus,
  SalesByPeriodItem,
  TopCustomer,
  TopProduct,
} from "../types/dashboard";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [sales, setSales] = useState<SalesByPeriodItem[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [ordersByStatus, setOrdersByStatus] = useState<OrdersByStatus[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>(
    []
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function formatCurrency(value: number | string | undefined) {
    const numberValue = Number(value ?? 0);

    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(numberValue);
  }

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      const [
        statsData,
        salesData,
        topProductsData,
        topCustomersData,
        ordersByStatusData,
        lowStockData,
      ] = await Promise.all([
        getDashboardStats(),
        getSalesByPeriod("monthly"),
        getTopProducts(5),
        getTopCustomers(5),
        getOrdersByStatus(),
        getLowStockProducts(),
      ]);

      setStats(statsData);

      setSales(
        salesData.map((item) => ({
          ...item,
          total_sales: Number(item.total_sales),
          orders_count: Number(item.orders_count),
        }))
      );

      setTopProducts(topProductsData);
      setTopCustomers(topCustomersData);
      setOrdersByStatus(ordersByStatusData);
      setLowStockProducts(lowStockData);
    } catch {
      setError("Impossible de charger les données du dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex h-80 items-center justify-center rounded-2xl bg-white">
        <p className="text-slate-500">Chargement du dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-600">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-slate-500">
          Vue globale de l’activité commerciale.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Chiffre d'affaires"
          value={formatCurrency(stats?.total_revenue)}
          icon={<Wallet size={22} />}
          description="Commandes non annulées"
        />

        <StatCard
          title="Commandes"
          value={stats?.orders_count ?? 0}
          icon={<ShoppingCart size={22} />}
          description="Total des commandes"
        />

        <StatCard
          title="Clients"
          value={stats?.customers_count ?? 0}
          icon={<Users size={22} />}
          description="Clients enregistrés"
        />

        <StatCard
          title="Produits"
          value={stats?.products_count ?? 0}
          icon={<Boxes size={22} />}
          description="Produits disponibles"
        />

        <StatCard
          title="Stock faible"
          value={stats?.low_stock_count ?? 0}
          icon={<AlertTriangle size={22} />}
          description="Produits à surveiller"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-slate-900">
              Ventes par période
            </h2>
            <p className="text-sm text-slate-500">
              Évolution mensuelle du chiffre d’affaires.
            </p>
          </div>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sales}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total_sales" name="Ventes" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900">
            Commandes par statut
          </h2>

          <div className="space-y-3">
            {ordersByStatus.length === 0 && (
              <p className="text-sm text-slate-500">Aucune commande.</p>
            )}

            {ordersByStatus.map((item) => (
              <div
                key={item.status}
                className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
              >
                <span className="capitalize text-slate-600">
                  {item.status}
                </span>
                <span className="font-bold text-slate-900">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900">
            Produits les plus vendus
          </h2>

          <div className="space-y-3">
            {topProducts.length === 0 && (
              <p className="text-sm text-slate-500">
                Aucun produit vendu pour le moment.
              </p>
            )}

            {topProducts.map((product) => (
              <div
                key={product.product_id}
                className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {product.product_name}
                  </p>
                  <p className="text-sm text-slate-500">
                    {product.total_sold} unités vendues
                  </p>
                </div>

                <span className="font-bold text-indigo-600">
                  {formatCurrency(product.total_revenue)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900">
            Meilleurs clients
          </h2>

          <div className="space-y-3">
            {topCustomers.length === 0 && (
              <p className="text-sm text-slate-500">
                Aucun client avec commande pour le moment.
              </p>
            )}

            {topCustomers.map((customer) => (
              <div
                key={customer.customer_id}
                className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {customer.first_name} {customer.last_name}
                  </p>
                  <p className="text-sm text-slate-500">
                    {customer.orders_count} commande(s)
                  </p>
                </div>

                <span className="font-bold text-indigo-600">
                  {formatCurrency(customer.total_spent)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-slate-900">
          Produits à stock faible
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-3">Produit</th>
                <th className="py-3">Catégorie</th>
                <th className="py-3">Stock</th>
                <th className="py-3">Seuil</th>
                <th className="py-3">Statut</th>
              </tr>
            </thead>

            <tbody>
              {lowStockProducts.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-5 text-center text-slate-500">
                    Aucun produit à stock faible.
                  </td>
                </tr>
              )}

              {lowStockProducts.map((product) => (
                <tr key={product.id} className="border-b border-slate-100">
                  <td className="py-3 font-medium text-slate-900">
                    {product.name}
                  </td>
                  <td className="py-3 text-slate-600">
                    {product.category?.name ?? "-"}
                  </td>
                  <td className="py-3 text-red-600">
                    {product.stock_quantity}
                  </td>
                  <td className="py-3 text-slate-600">
                    {product.stock_alert_threshold}
                  </td>
                  <td className="py-3">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium capitalize text-slate-600">
                      {product.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}