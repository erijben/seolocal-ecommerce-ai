import { useEffect, useState } from "react";
import { ArrowLeft, Package, ShoppingCart, User } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { getOrder, updateOrderStatus } from "../api/orderApi";
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

export default function OrderDetailsPage() {
  const { orderId } = useParams();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function formatCurrency(value: number | string | undefined) {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(Number(value ?? 0));
  }

  async function loadOrder() {
    if (!orderId) return;

    try {
      setLoading(true);
      setError("");

      const data = await getOrder(Number(orderId));
      setOrder(data);
    } catch {
      setError("Impossible de charger les détails de la commande.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  function getAvailableStatuses(currentStatus: OrderStatus): OrderStatus[] {
    if (currentStatus === "pending") return ["confirmed", "cancelled"];
    if (currentStatus === "confirmed") return ["shipped", "cancelled"];
    if (currentStatus === "shipped") return ["delivered"];

    return [];
  }

  async function handleStatusChange(status: OrderStatus) {
    if (!order) return;

    try {
      setMessage("");
      setError("");

      const response = await updateOrderStatus(order.id, status);

      setMessage(response.message ?? "Statut modifié avec succès.");
      await loadOrder();
    } catch {
      setError("Changement de statut non autorisé.");
    }
  }

  if (loading) {
    return (
      <div className="flex h-80 items-center justify-center rounded-2xl bg-white">
        <p className="text-slate-500">Chargement de la commande...</p>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-600">
        {error}
      </div>
    );
  }

  if (!order) {
    return (
      <div className="rounded-2xl bg-white p-5 text-slate-500">
        Commande introuvable.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/orders"
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
        >
          <ArrowLeft size={18} />
          Retour aux commandes
        </Link>

        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Commande {order.order_number}
            </h1>
            <p className="mt-1 text-slate-500">
              Détails complets de la commande.
            </p>
          </div>

          <span
            className={`w-fit rounded-full px-4 py-2 text-sm font-semibold ${
              statusClasses[order.status]
            }`}
          >
            {statusLabels[order.status]}
          </span>
        </div>
      </div>

      {message && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-green-700">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <ShoppingCart size={22} />
            </div>

            <div>
              <h2 className="font-bold text-slate-900">Informations</h2>
              <p className="text-sm text-slate-500">Commande</p>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Numéro</span>
              <span className="font-semibold text-slate-900">
                {order.order_number}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Date</span>
              <span className="font-semibold text-slate-900">
                {new Date(order.order_date).toLocaleString("fr-FR")}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Total</span>
              <span className="font-bold text-indigo-600">
                {formatCurrency(order.total_amount)}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <User size={22} />
            </div>

            <div>
              <h2 className="font-bold text-slate-900">Client</h2>
              <p className="text-sm text-slate-500">Informations client</p>
            </div>
          </div>

          {order.customer ? (
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-slate-500">Nom complet</p>
                <p className="font-semibold text-slate-900">
                  {order.customer.first_name} {order.customer.last_name}
                </p>
              </div>

              <div>
                <p className="text-slate-500">Email</p>
                <p className="font-semibold text-slate-900">
                  {order.customer.email}
                </p>
              </div>

              <div>
                <p className="text-slate-500">Téléphone</p>
                <p className="font-semibold text-slate-900">
                  {order.customer.phone || "-"}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Aucun client trouvé.</p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Package size={22} />
            </div>

            <div>
              <h2 className="font-bold text-slate-900">Statut</h2>
              <p className="text-sm text-slate-500">Suivi commande</p>
            </div>
          </div>

          {getAvailableStatuses(order.status).length > 0 ? (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Changer le statut
              </label>

              <select
                value=""
                onChange={(e) =>
                  handleStatusChange(e.target.value as OrderStatus)
                }
                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500"
              >
                <option value="">Choisir un nouveau statut</option>
                {getAvailableStatuses(order.status).map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Aucun changement de statut disponible.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-slate-900">
          Produits commandés
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-3">Produit</th>
                <th className="py-3">Catégorie</th>
                <th className="py-3">Prix unitaire</th>
                <th className="py-3">Quantité</th>
                <th className="py-3 text-right">Sous-total</th>
              </tr>
            </thead>

            <tbody>
              {order.items?.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    Aucun produit dans cette commande.
                  </td>
                </tr>
              )}

              {order.items?.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="py-4">
                    <p className="font-semibold text-slate-900">
                      {item.product?.name ?? "Produit supprimé"}
                    </p>
                    <p className="max-w-xs truncate text-sm text-slate-500">
                      {item.product?.description ?? ""}
                    </p>
                  </td>

                  <td className="py-4 text-slate-600">
                    {item.product?.category?.name ?? "-"}
                  </td>

                  <td className="py-4 font-semibold text-slate-900">
                    {formatCurrency(item.unit_price)}
                  </td>

                  <td className="py-4 text-slate-600">{item.quantity}</td>

                  <td className="py-4 text-right font-bold text-indigo-600">
                    {formatCurrency(item.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>

            <tfoot>
              <tr>
                <td colSpan={4} className="pt-5 text-right font-bold">
                  Total
                </td>
                <td className="pt-5 text-right text-xl font-bold text-indigo-600">
                  {formatCurrency(order.total_amount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}