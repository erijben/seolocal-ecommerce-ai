import { useEffect, useState } from "react";
import { Edit, Loader2, PackagePlus, Search, Trash2 } from "lucide-react";
import { getCategories } from "../api/categoryApi";
import {
  createProduct,
  deleteProduct,
  getProducts,
  updateProduct,
} from "../api/productApi";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import EmptyState from "../components/ui/EmptyState";
import Modal from "../components/ui/Modal";
import StatusBadge from "../components/ui/StatusBadge";
import { useToast } from "../components/ui/toastContext";
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
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState<ProductFormData>(emptyForm);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [deleteError, setDeleteError] = useState("");

  async function loadProducts() {
    try {
      setLoading(true);
      setError("");
      setProducts(
        await getProducts({
          search,
          category_id: categoryFilter,
          status: statusFilter,
          low_stock: lowStockOnly,
        })
      );
    } catch {
      setError("Impossible de charger les produits.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadProductCategories() {
      try {
        const data = await getCategories();
        if (!cancelled) {
          setCategories(data);
        }
      } catch {
        if (!cancelled) {
          setError("Impossible de charger les catégories.");
        }
      }
    }

    void loadProductCategories();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadFilteredProducts() {
      try {
        const data = await getProducts({
          search,
          category_id: categoryFilter,
          status: statusFilter,
          low_stock: lowStockOnly,
        });
        if (!cancelled) {
          setProducts(data);
          setError("");
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("Impossible de charger les produits.");
          setLoading(false);
        }
      }
    }

    void loadFilteredProducts();

    return () => {
      cancelled = true;
    };
  }, [search, categoryFilter, statusFilter, lowStockOnly]);

  function handleChange(
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  }

  function openCreateModal() {
    setEditingProduct(null);
    setFormData(emptyForm);
    setFormError("");
    setIsFormOpen(true);
  }

  function openEditModal(product: Product) {
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
    setFormError("");
    setIsFormOpen(true);
  }

  function closeFormModal() {
    if (saving) return;
    setIsFormOpen(false);
    setEditingProduct(null);
    setFormData(emptyForm);
    setFormError("");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!formData.category_id) {
      setFormError("Veuillez choisir une catégorie.");
      return;
    }

    try {
      setSaving(true);
      setFormError("");
      const response = editingProduct
        ? await updateProduct(editingProduct.id, formData)
        : await createProduct(formData);

      toast.success(
        response.message ??
          (editingProduct
            ? "Produit modifié avec succès."
            : "Produit créé avec succès.")
      );
      setIsFormOpen(false);
      setEditingProduct(null);
      setFormData(emptyForm);
      await loadProducts();
    } catch {
      setFormError("Une erreur est survenue lors de l’enregistrement du produit.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!productToDelete) return;

    try {
      setDeleting(true);
      setDeleteError("");
      const response = await deleteProduct(productToDelete.id);
      toast.success(response.message ?? "Produit supprimé avec succès.");
      setProductToDelete(null);
      await loadProducts();
    } catch {
      setDeleteError("Impossible de supprimer ce produit.");
      toast.error("Impossible de supprimer ce produit.");
    } finally {
      setDeleting(false);
    }
  }

  function formatCurrency(value: number | string) {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(Number(value));
  }

  function isLowStock(product: Product) {
    return product.stock_quantity <= product.stock_alert_threshold;
  }

  const fieldClass =
    "w-full rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3 bg-white text-slate-900 placeholder:text-slate-400 outline-none dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 transition focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-950/60";

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Produits</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            Gestion des produits, prix, catégories et stock.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/50 px-5 py-3 text-sm font-semibold text-indigo-700 dark:text-indigo-300">
            {products.length} produit(s)
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm dark:shadow-black/20 transition hover:bg-indigo-700"
          >
            <PackagePlus size={19} />
            Ajouter un produit
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 p-4 text-sm font-medium text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm dark:shadow-black/20">
        <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 py-3 pl-11 pr-4 bg-white text-slate-900 placeholder:text-slate-400 outline-none dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 focus:border-indigo-500 dark:focus:border-indigo-400"
              placeholder="Rechercher un produit..."
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className={fieldClass}
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
            onChange={(event) => setStatusFilter(event.target.value)}
            className={fieldClass}
          >
            <option value="">Tous les statuts</option>
            <option value="active">Actif</option>
            <option value="inactive">Inactif</option>
          </select>
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(event) => setLowStockOnly(event.target.checked)}
            />
            Stock faible uniquement
          </label>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-slate-500 dark:text-slate-400">
            <Loader2 size={18} className="animate-spin" />
            Chargement des produits...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
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
                    <td colSpan={7}>
                      <EmptyState
                        icon={<PackagePlus size={22} />}
                        title="Aucun produit trouvé"
                        description="Modifiez vos filtres ou ajoutez un premier produit."
                      />
                    </td>
                  </tr>
                )}
                {products.map((product) => (
                  <tr
                    key={product.id}
                    className="border-b border-slate-100 dark:border-slate-800/70 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/70 last:border-0"
                  >
                    <td className="py-4">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {product.name}
                      </p>
                      <p className="max-w-xs truncate text-sm text-slate-500 dark:text-slate-400">
                        {product.description || "Aucune description"}
                      </p>
                    </td>
                    <td className="py-4 text-slate-600 dark:text-slate-300">
                      {product.category?.name ?? "-"}
                    </td>
                    <td className="py-4 font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrency(product.price)}
                    </td>
                    <td className="py-4">
                      <StatusBadge
                        variant={isLowStock(product) ? "attention" : "success"}
                      >
                        {product.stock_quantity}
                        {isLowStock(product) ? " · Stock faible" : ""}
                      </StatusBadge>
                    </td>
                    <td className="py-4 text-slate-600 dark:text-slate-300">
                      {product.stock_alert_threshold}
                    </td>
                    <td className="py-4">
                      <StatusBadge
                        variant={product.status === "active" ? "success" : "neutral"}
                      >
                        {product.status === "active" ? "Actif" : "Inactif"}
                      </StatusBadge>
                    </td>
                    <td className="py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(product)}
                          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 text-slate-500 dark:text-slate-400 transition hover:border-indigo-200 dark:hover:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-600 dark:hover:text-indigo-300"
                          title="Modifier"
                          aria-label={`Modifier le produit ${product.name}`}
                        >
                          <Edit size={17} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteError("");
                            setProductToDelete(product);
                          }}
                          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 text-slate-500 dark:text-slate-400 transition hover:border-red-200 dark:hover:border-red-700 hover:bg-red-50 dark:hover:bg-red-950/60 hover:text-red-600 dark:hover:text-red-300"
                          title="Supprimer"
                          aria-label={`Supprimer le produit ${product.name}`}
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

      <Modal
        open={isFormOpen}
        title={editingProduct ? "Modifier un produit" : "Ajouter un produit"}
        onClose={closeFormModal}
        closeDisabled={saving}
        size="lg"
      >
        <form onSubmit={handleSubmit}>
          <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">
            Renseignez les informations du produit.
          </p>
          {formError && (
            <div className="mb-5 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 p-4 text-sm font-medium text-red-700 dark:text-red-300">
              {formError}
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <ProductField label="Nom du produit" htmlFor="product-name">
              <input
                id="product-name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={fieldClass}
                placeholder="Ex : Casque Bluetooth"
                autoFocus
                required
              />
            </ProductField>
            <ProductField label="Catégorie" htmlFor="product-category">
              <select
                id="product-category"
                name="category_id"
                value={formData.category_id}
                onChange={handleChange}
                className={fieldClass}
                required
              >
                <option value="">Choisir une catégorie</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </ProductField>
            <ProductField label="Prix" htmlFor="product-price">
              <input
                id="product-price"
                name="price"
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={handleChange}
                className={fieldClass}
                placeholder="Ex : 129.99"
                required
              />
            </ProductField>
            <ProductField label="Quantité en stock" htmlFor="product-stock">
              <input
                id="product-stock"
                name="stock_quantity"
                type="number"
                min="0"
                value={formData.stock_quantity}
                onChange={handleChange}
                className={fieldClass}
                placeholder="Ex : 20"
                required
              />
            </ProductField>
            <ProductField label="Seuil d’alerte" htmlFor="product-threshold">
              <input
                id="product-threshold"
                name="stock_alert_threshold"
                type="number"
                min="0"
                value={formData.stock_alert_threshold}
                onChange={handleChange}
                className={fieldClass}
                placeholder="Ex : 5"
              />
            </ProductField>
            <ProductField label="Statut" htmlFor="product-status">
              <select
                id="product-status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                className={fieldClass}
              >
                <option value="active">Actif</option>
                <option value="inactive">Inactif</option>
              </select>
            </ProductField>
            <div className="md:col-span-2">
              <ProductField label="Description" htmlFor="product-description">
                <textarea
                  id="product-description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={4}
                  className={`${fieldClass} resize-y`}
                  placeholder="Description du produit..."
                />
              </ProductField>
            </div>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeFormModal}
              disabled={saving}
              className="rounded-xl border border-slate-200 dark:border-slate-800 px-5 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800/70 disabled:opacity-60"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving && <Loader2 size={17} className="animate-spin" />}
              {saving
                ? "Enregistrement..."
                : editingProduct
                ? "Enregistrer"
                : "Ajouter"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={productToDelete !== null}
        title="Supprimer ce produit ?"
        description={
          <>
            Le produit{" "}
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {productToDelete?.name}
            </span>{" "}
            sera supprimé ou désactivé selon son utilisation actuelle.
            {deleteError && (
              <span className="mt-4 block rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 p-3 font-medium text-red-700 dark:text-red-300">
                {deleteError}
              </span>
            )}
          </>
        }
        onCancel={() => {
          if (!deleting) {
            setProductToDelete(null);
            setDeleteError("");
          }
        }}
        onConfirm={() => void handleDelete()}
        loading={deleting}
        confirmLabel="Supprimer"
        destructive
      />
    </div>
  );
}

function ProductField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
