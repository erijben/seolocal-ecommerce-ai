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
  pending: "bg-yellow-50 text-yellow-700",
  confirmed: "bg-blue-50 text-blue-700",
  shipped: "bg-purple-50 text-purple-700",
  delivered: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-700",
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

  async function loadCustomer() {
    if (!customerId) return;

    try {
      setLoading(true);
      setError("");

      const data = await getCustomer(Number(customerId));
      setCustomer(data);
    } catch {
      setError("Impossible de charger les détails du client.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomer();
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
      <div className="flex h-80 items-center justify-center rounded-2xl bg-white">
        <p className="text-slate-500">Chargement du client...</p>
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

  if (!customer) {
    return (
      <div className="rounded-2xl bg-white p-5 text-slate-500">
        Client introuvable.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/customers"
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
        >
          <ArrowLeft size={18} />
          Retour aux clients
        </Link>

        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {customer.first_name} {customer.last_name}
            </h1>
            <p className="mt-1 text-slate-500">
              Détails du client et historique des commandes.
            </p>
          </div>

          <div className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm">
            {customer.orders?.length ?? 0} commande(s)
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <User size={22} />
            </div>

            <div>
              <h2 className="font-bold text-slate-900">Informations client</h2>
              <p className="text-sm text-slate-500">Profil</p>
            </div>
          </div>

          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-3">
              <Mail size={18} className="text-slate-400" />
              <span className="font-medium text-slate-700">{customer.email}</span>
            </div>

            <div className="flex items-center gap-3">
              <Phone size={18} className="text-slate-400" />
              <span className="font-medium text-slate-700">
                {customer.phone || "-"}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <MapPin size={18} className="text-slate-400" />
              <span className="font-medium text-slate-700">
                {customer.address || "-"}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <ShoppingCart size={22} />
            </div>

            <div>
              <h2 className="font-bold text-slate-900">Commandes</h2>
              <p className="text-sm text-slate-500">Historique</p>
            </div>
          </div>

          <p className="text-3xl font-bold text-slate-900">
            {customer.orders?.length ?? 0}
          </p>
          <p className="mt-1 text-sm text-slate-500">commande(s) au total</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <ShoppingCart size={22} />
            </div>

            <div>
              <h2 className="font-bold text-slate-900">Montant dépensé</h2>
              <p className="text-sm text-slate-500">Hors commandes annulées</p>
            </div>
          </div>

          <p className="text-3xl font-bold text-indigo-600">
            {formatCurrency(totalSpent)}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-slate-900">
          Historique des commandes
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
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
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Ce client n’a pas encore de commandes.
                  </td>
                </tr>
              )}

              {customer.orders?.map((order) => (
                <tr key={order.id} className="border-b border-slate-100">
                  <td className="py-4 font-semibold text-slate-900">
                    {order.order_number}
                  </td>

                  <td className="py-4 text-slate-600">
                    {new Date(order.order_date).toLocaleDateString("fr-FR")}
                  </td>

                  <td className="py-4 text-slate-600">
                    {order.items?.length ?? 0} produit(s)
                  </td>

                  <td className="py-4 font-bold text-slate-900">
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
                      className="font-semibold text-indigo-600 hover:text-indigo-700"
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