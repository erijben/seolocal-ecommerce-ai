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
const statusLabels: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  shipped: "Expédiée",
  delivered: "Livrée",
  cancelled: "Annulée",
};
const orderStatusClasses: Record<string, string> = {
  pending: "bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-200",
  confirmed: "bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-200",
  shipped: "bg-violet-100 dark:bg-violet-950/70 text-violet-800 dark:text-violet-200",
  delivered: "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-200",
  cancelled: "bg-red-100 dark:bg-red-950/70 text-red-800 dark:text-red-200",
};
const productStatusLabels: Record<string, string> = {
  active: "Actif",
  inactive: "Inactif",
};
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
      setError("Impossible de charger les données du tableau de bord.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex h-80 items-center justify-center rounded-2xl bg-white dark:bg-slate-900">
        <p className="text-slate-500 dark:text-slate-400">Chargement du tableau de bord...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 dark:border-red-900/70 bg-red-50 dark:bg-red-950/40 p-5 text-red-600 dark:text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Tableau de bord</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          Vue globale de l’activité commerciale.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Chiffre d'affaires"
          value={formatCurrency(stats?.total_revenue)}
          icon={<Wallet size={22} />}
          description="Commandes non annulées"
          variant="ai"
        />

        <StatCard
          title="Commandes"
          value={stats?.orders_count ?? 0}
          icon={<ShoppingCart size={22} />}
          description="Total des commandes"
          variant="info"
        />

        <StatCard
          title="Clients"
          value={stats?.customers_count ?? 0}
          icon={<Users size={22} />}
          description="Clients enregistrés"
          variant="success"
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
          variant={
            (stats?.low_stock_count ?? 0) > 0 ? "danger" : "success"
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md xl:col-span-2">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Ventes par période
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Évolution mensuelle du chiffre d’affaires.
            </p>
          </div>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sales}>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="period"
                  axisLine={{ stroke: "var(--chart-grid)" }}
                  tick={{ fill: "var(--chart-axis)" }}
                  tickLine={{ stroke: "var(--chart-grid)" }}
                />
                <YAxis
                  axisLine={{ stroke: "var(--chart-grid)" }}
                  tick={{ fill: "var(--chart-axis)" }}
                  tickLine={{ stroke: "var(--chart-grid)" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--chart-tooltip-background)",
                    border: "1px solid var(--chart-tooltip-border)",
                    borderRadius: "12px",
                    color: "var(--chart-tooltip-text)",
                  }}
                  itemStyle={{ color: "var(--chart-tooltip-text)" }}
                  labelStyle={{ color: "var(--chart-tooltip-text)" }}
                />
     <Bar dataKey="total_sales" name="Ventes" fill="#4f46e5" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md">
          <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">
            Commandes par statut
          </h2>

          <div className="space-y-3">
            {ordersByStatus.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400">Aucune commande.</p>
            )}

            {ordersByStatus.map((item) => (
              <div
                key={statusLabels[item.status] ?? item.status}
                className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-4 py-3 transition hover:bg-white dark:hover:bg-slate-800"
              >
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    orderStatusClasses[item.status] ?? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                  }`}
                >
                  {statusLabels[item.status] ?? item.status}
                </span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md">
          <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">
            Produits les plus vendus
          </h2>

          <div className="space-y-3">
            {topProducts.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Aucun produit vendu pour le moment.
              </p>
            )}

            {topProducts.map((product) => (
              <div
                key={product.product_id}
                className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-4 py-3 transition hover:border-indigo-100 dark:hover:border-indigo-800 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/40"
              >
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {product.product_name}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {product.total_sold} unités vendues
                  </p>
                </div>

                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                  {formatCurrency(product.total_revenue)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md">
          <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">
            Meilleurs clients
          </h2>

          <div className="space-y-3">
            {topCustomers.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Aucun client avec commande pour le moment.
              </p>
            )}

            {topCustomers.map((customer) => (
              <div
                key={customer.customer_id}
                className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-4 py-3 transition hover:border-indigo-100 dark:hover:border-indigo-800 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/40"
              >
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {customer.first_name} {customer.last_name}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {customer.orders_count} commande(s)
                  </p>
                </div>

                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                  {formatCurrency(customer.total_spent)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200 dark:border-amber-900/70 bg-gradient-to-br from-white dark:from-slate-900 to-amber-50/40 dark:to-amber-950/25 p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl bg-amber-100 dark:bg-amber-950/70 p-2 text-amber-700 dark:text-amber-300">
            <AlertTriangle size={20} />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Produits à stock faible
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
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
                  <td colSpan={5} className="py-5 text-center text-slate-500 dark:text-slate-400">
                    Aucun produit à stock faible.
                  </td>
                </tr>
              )}

              {lowStockProducts.map((product) => (
                <tr
                  key={product.id}
                  className="border-b border-amber-100 dark:border-amber-900/60 transition hover:bg-amber-50/60 dark:hover:bg-amber-950/30"
                >
                  <td className="py-3 font-medium text-slate-900 dark:text-slate-100">
                    {product.name}
                  </td>
                  <td className="py-3 text-slate-600 dark:text-slate-300">
                    {product.category?.name ?? "-"}
                  </td>
                  <td className="py-3">
                    <span className="inline-flex min-w-10 justify-center rounded-full bg-red-100 dark:bg-red-950/70 px-3 py-1 text-xs font-bold text-red-700 dark:text-red-300">
                      {product.stock_quantity}
                    </span>
                  </td>
                  <td className="py-3 text-slate-600 dark:text-slate-300">
                    {product.stock_alert_threshold}
                  </td>
                  <td className="py-3">
                    <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/70 px-3 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                      {productStatusLabels[product.status] ?? product.status}
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
