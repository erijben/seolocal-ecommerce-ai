import { useEffect, useMemo, useState } from "react";
import {
  Eye,
  Plus,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";

import { getCustomers } from "../api/customerApi";
import { getProducts } from "../api/productApi";
import {
  cancelOrder,
  createOrder,
  getOrders,
  updateOrderStatus,
} from "../api/orderApi";

import type { Customer } from "../types/customer";
import type { Product } from "../types/product";
import type {
  Order,
  OrderFormData,
  OrderFormItem,
  OrderStatus,
} from "../types/order";

const emptyForm: OrderFormData = {
  customer_id: "",
  order_date: new Date().toISOString().slice(0, 16),
  items: [
    {
      product_id: "",
      quantity: "1",
    },
  ],
};

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

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [formData, setFormData] = useState<OrderFormData>(emptyForm);

  const [statusFilter, setStatusFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function formatCurrency(value: number | string | undefined) {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(Number(value ?? 0));
  }

  async function loadOrders() {
    try {
      setLoading(true);
      setError("");

      const data = await getOrders({
        status: statusFilter,
        customer_id: customerFilter,
      });

      setOrders(data);
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
    loadInitialData();
  }, []);

  useEffect(() => {
    loadOrders();
  }, [statusFilter, customerFilter]);

  function updateItem(index: number, field: keyof OrderFormItem, value: string) {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
  }

  function addItem() {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          product_id: "",
          quantity: "1",
        },
      ],
    }));
  }

  function removeItem(index: number) {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

function resetForm() {
  setFormData({
    customer_id: "",
    order_date: new Date().toISOString().slice(0, 16),
    items: [
      {
        product_id: "",
        quantity: "1",
      },
    ],
  });
}

  const estimatedTotal = useMemo(() => {
    return formData.items.reduce((total, item) => {
      const product = products.find(
        (currentProduct) => String(currentProduct.id) === item.product_id
      );

      if (!product) return total;

      return total + Number(product.price) * Number(item.quantity || 0);
    }, 0);
  }, [formData.items, products]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.customer_id) {
      setError("Veuillez choisir un client.");
      return;
    }

    const hasInvalidItem = formData.items.some(
      (item) => !item.product_id || Number(item.quantity) < 1
    );

    if (hasInvalidItem) {
      setError("Veuillez choisir les produits et les quantités correctement.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      setError("");

      const response = await createOrder(formData);

      setMessage(response.message ?? "Commande créée avec succès.");
      resetForm();
      await loadOrders();
      await loadInitialData();
    } catch {
      setError(
        "Impossible de créer la commande. Vérifie le stock disponible."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(order: Order, status: OrderStatus) {
    try {
      setMessage("");
      setError("");

      const response = await updateOrderStatus(order.id, status);

      setMessage(response.message ?? "Statut modifié avec succès.");
      await loadOrders();
    } catch {
      setError("Changement de statut non autorisé.");
    }
  }

  async function handleCancel(order: Order) {
    const confirmed = window.confirm(
      `Voulez-vous vraiment annuler la commande ${order.order_number} ?`
    );

    if (!confirmed) return;

    try {
      setMessage("");
      setError("");

      const response = await cancelOrder(order.id);

      setMessage(response.message ?? "Commande annulée avec succès.");
      await loadOrders();
      await loadInitialData();
    } catch {
      setError("Impossible d’annuler cette commande.");
    }
  }

  function getAvailableStatuses(order: Order): OrderStatus[] {
    if (order.status === "pending") return ["confirmed", "cancelled"];
    if (order.status === "confirmed") return ["shipped", "cancelled"];
    if (order.status === "shipped") return ["delivered"];

    return [];
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Commandes</h1>
          <p className="mt-1 text-slate-500">
            Créez, suivez et mettez à jour les commandes.
          </p>
        </div>

        <div className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm">
          {orders.length} commande(s)
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

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <ShoppingCart size={22} />
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Créer une commande
            </h2>
            <p className="text-sm text-slate-500">
              Choisissez un client et les produits commandés.
            </p>
          </div>
        </div>

        <div className="mb-5">
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Client
          </label>

          <select
            value={formData.customer_id}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                customer_id: e.target.value,
              }))
            }
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500"
            required
          >
            <option value="">Choisir un client</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.first_name} {customer.last_name} - {customer.email}
              </option>
            ))}
          </select>
        </div>
<div className="mb-5">
  <label className="mb-2 block text-sm font-medium text-slate-700">
    Date de commande
  </label>

  <input
    type="datetime-local"
    value={formData.order_date}
    onChange={(e) =>
      setFormData((prev) => ({
        ...prev,
        order_date: e.target.value,
      }))
    }
    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500"
  />
</div>
        <div className="space-y-4">
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
                    onChange={(e) =>
                      updateItem(index, "product_id", e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500"
                    required
                  >
                    <option value="">Choisir un produit</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} — Stock: {product.stock_quantity}
                      </option>
                    ))}
                  </select>

                  {selectedProduct && (
                    <p className="mt-2 text-xs text-slate-500">
                      Prix : {formatCurrency(selectedProduct.price)} | Stock :
                      {" "}
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
                    onChange={(e) =>
                      updateItem(index, "quantity", e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500"
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
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 font-semibold text-slate-600 transition hover:bg-slate-100"
          >
            <Plus size={18} />
            Ajouter un produit
          </button>

          <div className="text-right">
            <p className="text-sm text-slate-500">Total estimé</p>
            <p className="text-2xl font-bold text-indigo-600">
              {formatCurrency(estimatedTotal)}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:bg-indigo-300"
          >
            {saving ? "Création..." : "Créer la commande"}
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500"
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
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500"
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
          <p className="py-8 text-center text-slate-500">
            Chargement des commandes...
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
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
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      Aucune commande trouvée.
                    </td>
                  </tr>
                )}

                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-slate-100">
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
                          onChange={(e) =>
                            handleStatusChange(
                              order,
                              e.target.value as OrderStatus
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
                          className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-indigo-600"
                        >
                          <Eye size={17} />
                        </Link>

                        {["pending", "confirmed"].includes(order.status) && (
                          <button
                            onClick={() => handleCancel(order)}
                            className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
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
    </div>
  );
}