import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Mail, MapPin, Phone, ShoppingCart, User } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { getCustomer } from "../api/customerApi";
import type { Customer } from "../types/customer";
import type { Order, OrderStatus } from "../types/order";

const statusLabels: Record<OrderStatus, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  shipped: "Expédiée",
  delivered: "Livrée",
  cancelled: "Annulée",
};

const statusClasses: Record<OrderStatus, string> = {
  pending: "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/60 dark:text-yellow-300",
  confirmed: "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300",
  shipped: "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300",
  delivered: "bg-green-50 dark:bg-green-950/60 text-green-700 dark:text-green-300",
  cancelled: "bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300",
};

type CustomerWithOrders = Customer & {
  orders?: Order[];
};

export default function CustomerDetailsPage() {
  const { customerId } = useParams();

  const [customer, setCustomer] = useState<CustomerWithOrders | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function formatCurrency(value: number | string | undefined) {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(Number(value ?? 0));
  }

  useEffect(() => {
    if (!customerId) {
      return;
    }

    let cancelled = false;

    async function loadRequestedCustomer() {
      try {
        const data = await getCustomer(Number(customerId));
        if (!cancelled) {
          setCustomer(data);
          setError("");
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("Impossible de charger les détails du client.");
          setLoading(false);
        }
      }
    }

    void loadRequestedCustomer();

    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const totalSpent = useMemo(() => {
    return (
      customer?.orders
        ?.filter((order) => order.status !== "cancelled")
        .reduce((total, order) => total + Number(order.total_amount), 0) ?? 0
    );
  }, [customer]);

  if (loading) {
    return (
      <div className="flex h-80 items-center justify-center rounded-2xl bg-white dark:bg-slate-900">
        <p className="text-slate-500 dark:text-slate-400">Chargement du client...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 p-5 text-red-600 dark:text-red-400">
        {error}
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 text-slate-500 dark:text-slate-400">
        Client introuvable.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/customers"
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
        >
          <ArrowLeft size={18} />
          Retour aux clients
        </Link>

        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              {customer.first_name} {customer.last_name}
            </h1>
            <p className="mt-1 text-slate-500 dark:text-slate-400">
              Détails du client et historique des commandes.
            </p>
          </div>

          <div className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm dark:shadow-black/20">
            {customer.orders?.length ?? 0} commande(s)
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm dark:shadow-black/20">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <User size={22} />
            </div>

            <div>
              <h2 className="font-bold text-slate-900 dark:text-slate-100">Informations client</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Profil</p>
            </div>
          </div>

          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-3">
              <Mail size={18} className="text-slate-400 dark:text-slate-500" />
              <span className="font-medium text-slate-700 dark:text-slate-300">{customer.email}</span>
            </div>

            <div className="flex items-center gap-3">
              <Phone size={18} className="text-slate-400 dark:text-slate-500" />
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {customer.phone || "-"}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <MapPin size={18} className="text-slate-400 dark:text-slate-500" />
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {customer.address || "-"}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm dark:shadow-black/20">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <ShoppingCart size={22} />
            </div>

            <div>
              <h2 className="font-bold text-slate-900 dark:text-slate-100">Commandes</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Historique</p>
            </div>
          </div>

          <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            {customer.orders?.length ?? 0}
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">commande(s) au total</p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm dark:shadow-black/20">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <ShoppingCart size={22} />
            </div>

            <div>
              <h2 className="font-bold text-slate-900 dark:text-slate-100">Montant dépensé</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Hors commandes annulées</p>
            </div>
          </div>

          <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
            {formatCurrency(totalSpent)}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm dark:shadow-black/20">
        <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">
          Historique des commandes
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="py-3">Commande</th>
                <th className="py-3">Date</th>
                <th className="py-3">Produits</th>
                <th className="py-3">Total</th>
                <th className="py-3">Statut</th>
                <th className="py-3 text-right">Détails</th>
              </tr>
            </thead>

            <tbody>
              {customer.orders?.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    Ce client n’a pas encore de commandes.
                  </td>
                </tr>
              )}

              {customer.orders?.map((order) => (
                <tr key={order.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50/80 dark:border-slate-800/70 dark:hover:bg-slate-800/70">
                  <td className="py-4 font-semibold text-slate-900 dark:text-slate-100">
                    {order.order_number}
                  </td>

                  <td className="py-4 text-slate-600 dark:text-slate-300">
                    {new Date(order.order_date).toLocaleDateString("fr-FR")}
                  </td>

                  <td className="py-4 text-slate-600 dark:text-slate-300">
                    {order.items?.length ?? 0} produit(s)
                  </td>

                  <td className="py-4 font-bold text-slate-900 dark:text-slate-100">
                    {formatCurrency(order.total_amount)}
                  </td>

                  <td className="py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        statusClasses[order.status]
                      }`}
                    >
                      {statusLabels[order.status]}
                    </span>
                  </td>

                  <td className="py-4 text-right">
                    <Link
                      to={`/orders/${order.id}`}
                      className="font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
                    >
                      Voir
                    </Link>
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
