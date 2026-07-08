import { useEffect, useState } from "react";
import { Edit, PackagePlus, Search, Trash2 } from "lucide-react";
import { getCategories } from "../api/categoryApi";
import {
  createProduct,
  deleteProduct,
  getProducts,
  updateProduct,
} from "../api/productApi";
import type { Category } from "../types/category";
import type { Product, ProductFormData } from "../types/product";

const emptyForm: ProductFormData = {
  category_id: "",
  name: "",
  description: "",
  price: "",
  stock_quantity: "",
  stock_alert_threshold: "5",
  image: "",
  status: "active",
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [formData, setFormData] = useState<ProductFormData>(emptyForm);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function formatCurrency(value: number | string) {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(Number(value));
  }

  function isLowStock(product: Product) {
    return product.stock_quantity <= product.stock_alert_threshold;
  }

  async function loadProducts() {
    try {
      setLoading(true);
      setError("");

      const data = await getProducts({
        search,
        category_id: categoryFilter,
        status: statusFilter,
        low_stock: lowStockOnly,
      });

      setProducts(data);
    } catch {
      setError("Impossible de charger les produits.");
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      const data = await getCategories();
      setCategories(data);
    } catch {
      setError("Impossible de charger les catégories.");
    }
  }

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadProducts();
  }, [search, categoryFilter, statusFilter, lowStockOnly]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function startEdit(product: Product) {
    setEditingProduct(product);

    setFormData({
      category_id: String(product.category_id),
      name: product.name,
      description: product.description ?? "",
      price: String(product.price),
      stock_quantity: String(product.stock_quantity),
      stock_alert_threshold: String(product.stock_alert_threshold),
      image: product.image ?? "",
      status: product.status,
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingProduct(null);
    setFormData(emptyForm);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.category_id) {
      setError("Veuillez choisir une catégorie.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      if (editingProduct) {
        const response = await updateProduct(editingProduct.id, formData);
        setMessage(response.message ?? "Produit modifié avec succès.");
      } else {
        const response = await createProduct(formData);
        setMessage(response.message ?? "Produit créé avec succès.");
      }

      resetForm();
      await loadProducts();
    } catch {
      setError("Une erreur est survenue lors de l’enregistrement du produit.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(product: Product) {
    const confirmed = window.confirm(
      `Voulez-vous vraiment supprimer ou désactiver le produit "${product.name}" ?`
    );

    if (!confirmed) return;

    try {
      setError("");
      setMessage("");

      const response = await deleteProduct(product.id);

      setMessage(response.message ?? "Produit supprimé avec succès.");
      await loadProducts();
    } catch {
      setError("Impossible de supprimer ce produit.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Produits</h1>
          <p className="mt-1 text-slate-500">
            Gestion des produits, prix, catégories et stock.
          </p>
        </div>

        <div className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm">
          {products.length} produit(s)
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
            <PackagePlus size={22} />
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {editingProduct ? "Modifier un produit" : "Ajouter un produit"}
            </h2>
            <p className="text-sm text-slate-500">
              Renseignez les informations du produit.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Nom du produit
            </label>
            <input
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500"
              placeholder="Ex: Casque Bluetooth"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Catégorie
            </label>
            <select
              name="category_id"
              value={formData.category_id}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500"
              required
            >
              <option value="">Choisir une catégorie</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Prix
            </label>
            <input
              name="price"
              type="number"
              step="0.01"
              min="0"
              value={formData.price}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500"
              placeholder="Ex: 129.99"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Quantité en stock
            </label>
            <input
              name="stock_quantity"
              type="number"
              min="0"
              value={formData.stock_quantity}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500"
              placeholder="Ex: 20"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Seuil d’alerte
            </label>
            <input
              name="stock_alert_threshold"
              type="number"
              min="0"
              value={formData.stock_alert_threshold}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500"
              placeholder="Ex: 5"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Statut
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500"
            >
              <option value="active">Actif</option>
              <option value="inactive">Inactif</option>
            </select>
          </div>

          <div className="md:col-span-2 xl:col-span-3">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="min-h-24 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500"
              placeholder="Description du produit..."
            />
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:bg-indigo-300"
          >
            {saving
              ? "Enregistrement..."
              : editingProduct
              ? "Modifier"
              : "Ajouter"}
          </button>

          {editingProduct && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-slate-200 px-5 py-3 font-semibold text-slate-600 transition hover:bg-slate-100"
            >
              Annuler
            </button>
          )}
        </div>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-4 outline-none focus:border-indigo-500"
              placeholder="Rechercher un produit..."
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500"
          >
            <option value="">Toutes les catégories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500"
          >
            <option value="">Tous les statuts</option>
            <option value="active">Actif</option>
            <option value="inactive">Inactif</option>
          </select>

          <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
            />
            Stock faible uniquement
          </label>
        </div>

        {loading ? (
          <p className="py-8 text-center text-slate-500">
            Chargement des produits...
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-3">Produit</th>
                  <th className="py-3">Catégorie</th>
                  <th className="py-3">Prix</th>
                  <th className="py-3">Stock</th>
                  <th className="py-3">Seuil</th>
                  <th className="py-3">Statut</th>
                  <th className="py-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {products.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      Aucun produit trouvé.
                    </td>
                  </tr>
                )}

                {products.map((product) => (
                  <tr key={product.id} className="border-b border-slate-100">
                    <td className="py-4">
                      <p className="font-semibold text-slate-900">
                        {product.name}
                      </p>
                      <p className="max-w-xs truncate text-sm text-slate-500">
                        {product.description || "Aucune description"}
                      </p>
                    </td>

                    <td className="py-4 text-slate-600">
                      {product.category?.name ?? "-"}
                    </td>

                    <td className="py-4 font-semibold text-slate-900">
                      {formatCurrency(product.price)}
                    </td>

                    <td className="py-4">
                      <span
                        className={`font-bold ${
                          isLowStock(product)
                            ? "text-red-600"
                            : "text-slate-700"
                        }`}
                      >
                        {product.stock_quantity}
                      </span>
                    </td>

                    <td className="py-4 text-slate-600">
                      {product.stock_alert_threshold}
                    </td>

                    <td className="py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          product.status === "active"
                            ? "bg-green-50 text-green-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {product.status === "active" ? "Actif" : "Inactif"}
                      </span>
                    </td>

                    <td className="py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => startEdit(product)}
                          className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-indigo-600"
                        >
                          <Edit size={17} />
                        </button>

                        <button
                          onClick={() => handleDelete(product)}
                          className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={17} />
                        </button>
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