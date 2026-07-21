import { useEffect, useMemo, useState } from "react";
import {
  Eye,
  Loader2,
  Plus,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { getCustomers } from "../api/customerApi";
import {
  cancelOrder,
  createOrder,
  getOrders,
  updateOrderStatus,
} from "../api/orderApi";
import { getProducts } from "../api/productApi";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import EmptyState from "../components/ui/EmptyState";
import Modal from "../components/ui/Modal";
import { useToast } from "../components/ui/ToastProvider";
import type { Customer } from "../types/customer";
import type {
  Order,
  OrderFormData,
  OrderFormItem,
  OrderStatus,
} from "../types/order";
import type { Product } from "../types/product";

function createEmptyForm(): OrderFormData {
  return {
    customer_id: "",
    order_date: new Date().toISOString().slice(0, 16),
    items: [{ product_id: "", quantity: "1" }],
  };
}

const statusLabels: Record<OrderStatus, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  shipped: "Expédiée",
  delivered: "Livrée",
  cancelled: "Annulée",
};

const statusClasses: Record<OrderStatus, string> = {
  pending: "bg-amber-50 text-amber-700",
  confirmed: "bg-blue-50 text-blue-700",
  shipped: "bg-violet-50 text-violet-700",
  delivered: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-red-50 text-red-700",
};

export default function OrdersPage() {
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [formData, setFormData] = useState<OrderFormData>(createEmptyForm);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [cancelError, setCancelError] = useState("");

  async function loadOrders() {
    try {
      setLoading(true);
      setError("");
      setOrders(
        await getOrders({
          status: statusFilter,
          customer_id: customerFilter,
        })
      );
    } catch {
      setError("Impossible de charger les commandes.");
    } finally {
      setLoading(false);
    }
  }

  async function loadInitialData() {
    try {
      const [customersData, productsData] = await Promise.all([
        getCustomers(),
        getProducts({ status: "active" }),
      ]);
      setCustomers(customersData);
      setProducts(productsData);
    } catch {
      setError("Impossible de charger les clients ou les produits.");
    }
  }

  useEffect(() => {
    void loadInitialData();
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [statusFilter, customerFilter]);

  function openCreateModal() {
    setFormData(createEmptyForm());
    setFormError("");
    setIsFormOpen(true);
  }

  function closeCreateModal() {
    if (saving) return;
    setIsFormOpen(false);
    setFormData(createEmptyForm());
    setFormError("");
  }

  function updateItem(index: number, field: keyof OrderFormItem, value: string) {
    setFormData((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
  }

  function addItem() {
    setFormData((current) => ({
      ...current,
      items: [...current.items, { product_id: "", quantity: "1" }],
    }));
  }

  function removeItem(index: number) {
    setFormData((current) => ({
      ...current,
      items: current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  const estimatedTotal = useMemo(
    () =>
      formData.items.reduce((total, item) => {
        const product = products.find(
          (currentProduct) => String(currentProduct.id) === item.product_id
        );
        return product
          ? total + Number(product.price) * Number(item.quantity || 0)
          : total;
      }, 0),
    [formData.items, products]
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!formData.customer_id) {
      setFormError("Veuillez choisir un client.");
      return;
    }

    if (
      formData.items.some(
        (item) => !item.product_id || Number(item.quantity) < 1
      )
    ) {
      setFormError("Veuillez choisir les produits et les quantités correctement.");
      return;
    }

    try {
      setSaving(true);
      setFormError("");
      const response = await createOrder(formData);
      toast.success(response.message ?? "Commande créée avec succès.");
      setIsFormOpen(false);
      setFormData(createEmptyForm());
      await loadOrders();
      await loadInitialData();
    } catch {
      setFormError(
        "Impossible de créer la commande. Vérifiez le stock disponible."
      );
      toast.error("Création de la commande impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(order: Order, status: OrderStatus) {
    if (status === "cancelled") {
      setCancelError("");
      setOrderToCancel(order);
      return;
    }

    try {
      setError("");
      const response = await updateOrderStatus(order.id, status);
      toast.success(response.message ?? "Statut modifié avec succès.");
      await loadOrders();
    } catch {
      toast.error("Changement de statut non autorisé.");
    }
  }

  async function handleCancel() {
    if (!orderToCancel) return;

    try {
      setCancelling(true);
      setCancelError("");
      const response = await cancelOrder(orderToCancel.id);
      toast.success(response.message ?? "Commande annulée avec succès.");
      setOrderToCancel(null);
      await loadOrders();
      await loadInitialData();
    } catch {
      setCancelError("Impossible d’annuler cette commande.");
      toast.error("Annulation de la commande impossible.");
    } finally {
      setCancelling(false);
    }
  }

  function getAvailableStatuses(order: Order): OrderStatus[] {
    if (order.status === "pending") return ["confirmed", "cancelled"];
    if (order.status === "confirmed") return ["shipped", "cancelled"];
    if (order.status === "shipped") return ["delivered"];
    return [];
  }

  function formatCurrency(value: number | string | undefined) {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(Number(value ?? 0));
  }

  const fieldClass =
    "w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50";

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Commandes</h1>
          <p className="mt-1 text-slate-500">
            Créez, suivez et mettez à jour les commandes.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="rounded-xl bg-indigo-50 px-5 py-3 text-sm font-semibold text-indigo-700">
            {orders.length} commande(s)
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <ShoppingCart size={19} />
            Nouvelle commande
          </button>
        </div>
      </div>
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className={fieldClass}
          >
            <option value="">Tous les statuts</option>
            <option value="pending">En attente</option>
            <option value="confirmed">Confirmée</option>
            <option value="shipped">Expédiée</option>
            <option value="delivered">Livrée</option>
            <option value="cancelled">Annulée</option>
          </select>
          <select
            value={customerFilter}
            onChange={(event) => setCustomerFilter(event.target.value)}
            className={fieldClass}
          >
            <option value="">Tous les clients</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.first_name} {customer.last_name}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-slate-500">
            <Loader2 size={18} className="animate-spin" />
            Chargement des commandes...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-3">Commande</th>
                  <th className="py-3">Client</th>
                  <th className="py-3">Total</th>
                  <th className="py-3">Produits</th>
                  <th className="py-3">Statut</th>
                  <th className="py-3">Changer statut</th>
                  <th className="py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState
                        icon={<ShoppingCart size={22} />}
                        title="Aucune commande trouvée"
                        description="Créez une commande ou ajustez vos filtres."
                      />
                    </td>
                  </tr>
                )}
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-slate-100 transition-colors hover:bg-slate-50/80 last:border-0"
                  >
                    <td className="py-4">
                      <p className="font-semibold text-slate-900">
                        {order.order_number}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(order.order_date).toLocaleDateString("fr-FR")}
                      </p>
                    </td>
                    <td className="py-4 text-slate-600">
                      {order.customer
                        ? `${order.customer.first_name} ${order.customer.last_name}`
                        : "-"}
                    </td>
                    <td className="py-4 font-bold text-slate-900">
                      {formatCurrency(order.total_amount)}
                    </td>
                    <td className="py-4 text-slate-600">
                      {order.items_count ?? order.items?.length ?? 0}
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
                    <td className="py-4">
                      {getAvailableStatuses(order).length > 0 ? (
                        <select
                          value=""
                          onChange={(event) =>
                            void handleStatusChange(
                              order,
                              event.target.value as OrderStatus
                            )
                          }
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                        >
                          <option value="">Choisir</option>
                          {getAvailableStatuses(order).map((status) => (
                            <option key={status} value={status}>
                              {statusLabels[status]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-sm text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-4">
                      <div className="flex justify-end gap-2">
                        <Link
                          to={`/orders/${order.id}`}
                          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
                          title="Voir les détails"
                          aria-label={`Voir la commande ${order.order_number}`}
                        >
                          <Eye size={17} />
                        </Link>
                        {["pending", "confirmed"].includes(order.status) && (
                          <button
                            type="button"
                            onClick={() => {
                              setCancelError("");
                              setOrderToCancel(order);
                            }}
                            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                            title="Annuler"
                            aria-label={`Annuler la commande ${order.order_number}`}
                          >
                            <Trash2 size={17} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={isFormOpen}
        title="Nouvelle commande"
        onClose={closeCreateModal}
        closeDisabled={saving}
        size="xl"
      >
        <form onSubmit={handleSubmit}>
          <p className="mb-5 text-sm text-slate-500">
            Choisissez un client et les produits commandés.
          </p>
          {formError && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              {formError}
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="order-customer"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Client
              </label>
              <select
                id="order-customer"
                value={formData.customer_id}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    customer_id: event.target.value,
                  }))
                }
                className={fieldClass}
                autoFocus
                required
              >
                <option value="">Choisir un client</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.first_name} {customer.last_name} — {customer.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="order-date"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Date de commande
              </label>
              <input
                id="order-date"
                type="datetime-local"
                value={formData.order_date}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    order_date: event.target.value,
                  }))
                }
                className={fieldClass}
              />
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {formData.items.map((item, index) => {
              const selectedProduct = products.find(
                (product) => String(product.id) === item.product_id
              );

              return (
                <div
                  key={index}
                  className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-4"
                >
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Produit
                    </label>
                    <select
                      value={item.product_id}
                      onChange={(event) =>
                        updateItem(index, "product_id", event.target.value)
                      }
                      className={fieldClass}
                      required
                    >
                      <option value="">Choisir un produit</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} — Stock : {product.stock_quantity}
                        </option>
                      ))}
                    </select>
                    {selectedProduct && (
                      <p className="mt-2 text-xs text-slate-500">
                        Prix : {formatCurrency(selectedProduct.price)} | Stock :{" "}
                        {selectedProduct.stock_quantity}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Quantité
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(event) =>
                        updateItem(index, "quantity", event.target.value)
                      }
                      className={fieldClass}
                      required
                    />
                  </div>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-500">Sous-total</p>
                      <p className="font-bold text-slate-900">
                        {selectedProduct
                          ? formatCurrency(
                              Number(selectedProduct.price) *
                                Number(item.quantity || 0)
                            )
                          : formatCurrency(0)}
                      </p>
                    </div>
                    {formData.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="rounded-xl border border-slate-200 p-3 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                        title="Retirer cette ligne"
                        aria-label={`Retirer le produit ${index + 1}`}
                      >
                        <X size={18} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 font-semibold text-slate-600 transition hover:bg-slate-100"
            >
              <Plus size={18} />
              Ajouter un produit
            </button>
            <div className="rounded-xl bg-indigo-50 px-5 py-3 text-right">
              <p className="text-sm text-indigo-600">Total estimé</p>
              <p className="text-2xl font-bold text-indigo-700">
                {formatCurrency(estimatedTotal)}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeCreateModal}
              disabled={saving}
              className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving && <Loader2 size={18} className="animate-spin" />}
              {saving ? "Création..." : "Créer la commande"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={orderToCancel !== null}
        title="Annuler cette commande ?"
        description={
          <>
            La commande{" "}
            <span className="font-semibold text-slate-900">
              {orderToCancel?.order_number}
            </span>{" "}
            sera annulée et son stock sera mis à jour.
            {cancelError && (
              <span className="mt-4 block rounded-xl border border-red-200 bg-red-50 p-3 font-medium text-red-700">
                {cancelError}
              </span>
            )}
          </>
        }
        onCancel={() => {
          if (!cancelling) {
            setOrderToCancel(null);
            setCancelError("");
          }
        }}
        onConfirm={() => void handleCancel()}
        loading={cancelling}
        confirmLabel="Annuler la commande"
        destructive
      />
    </div>
  );
}
