import { useEffect, useState } from "react";
import { Edit, FolderPlus, Loader2, Search, Trash2 } from "lucide-react";
import {
  createCategory,
  deleteCategory,
  getCategories,
  updateCategory,
  type CategoryFormData,
} from "../api/categoryApi";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import EmptyState from "../components/ui/EmptyState";
import Modal from "../components/ui/Modal";
import { useToast } from "../components/ui/ToastProvider";
import type { Category } from "../types/category";

const emptyForm: CategoryFormData = { name: "", description: "" };

export default function CategoriesPage() {
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState<CategoryFormData>(emptyForm);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [deleteError, setDeleteError] = useState("");

  async function loadCategories() {
    try {
      setLoading(true);
      setError("");
      setCategories(await getCategories(search));
    } catch {
      setError("Impossible de charger les catégories.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCategories();
  }, [search]);

  function openCreateModal() {
    setEditingCategory(null);
    setFormData(emptyForm);
    setFormError("");
    setIsFormOpen(true);
  }

  function openEditModal(category: Category) {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description ?? "",
    });
    setFormError("");
    setIsFormOpen(true);
  }

  function closeFormModal() {
    if (saving) return;
    setIsFormOpen(false);
    setEditingCategory(null);
    setFormData(emptyForm);
    setFormError("");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    try {
      setSaving(true);
      setFormError("");

      const response = editingCategory
        ? await updateCategory(editingCategory.id, formData)
        : await createCategory(formData);

      toast.success(
        response.message ??
          (editingCategory
            ? "Catégorie modifiée avec succès."
            : "Catégorie créée avec succès.")
      );
      setIsFormOpen(false);
      setEditingCategory(null);
      setFormData(emptyForm);
      await loadCategories();
    } catch {
      setFormError("Une erreur est survenue lors de l’enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!categoryToDelete) return;

    try {
      setDeleting(true);
      setDeleteError("");
      const response = await deleteCategory(categoryToDelete.id);
      toast.success(response.message ?? "Catégorie supprimée avec succès.");
      setCategoryToDelete(null);
      await loadCategories();
    } catch {
      setDeleteError(
        "Impossible de supprimer cette catégorie. Elle contient peut-être des produits."
      );
      toast.error("Impossible de supprimer cette catégorie.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Catégories</h1>
          <p className="mt-1 text-slate-500">
            Organisez les produits par catégories.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="rounded-xl bg-indigo-50 px-5 py-3 text-sm font-semibold text-indigo-700">
            {categories.length} catégorie(s)
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <FolderPlus size={19} />
            Ajouter une catégorie
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5">
          <div className="relative max-w-md">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-4 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
              placeholder="Rechercher une catégorie..."
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-slate-500">
            <Loader2 size={18} className="animate-spin" />
            Chargement des catégories...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-3">Nom</th>
                  <th className="py-3">Description</th>
                  <th className="py-3">Produits</th>
                  <th className="py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      <EmptyState
                        icon={<FolderPlus size={22} />}
                        title="Aucune catégorie trouvée"
                        description="Ajoutez une première catégorie pour organiser vos produits."
                      />
                    </td>
                  </tr>
                )}
                {categories.map((category) => (
                  <tr
                    key={category.id}
                    className="border-b border-slate-100 transition-colors hover:bg-slate-50/80 last:border-0"
                  >
                    <td className="py-4 font-semibold text-slate-900">
                      {category.name}
                    </td>
                    <td className="py-4 text-slate-600">
                      {category.description || "Aucune description"}
                    </td>
                    <td className="py-4">
                      <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">
                        {category.products_count ?? 0} produit(s)
                      </span>
                    </td>
                    <td className="py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(category)}
                          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
                          title="Modifier"
                          aria-label={`Modifier la catégorie ${category.name}`}
                        >
                          <Edit size={17} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteError("");
                            setCategoryToDelete(category);
                          }}
                          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                          title="Supprimer"
                          aria-label={`Supprimer la catégorie ${category.name}`}
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
        title={
          editingCategory ? "Modifier une catégorie" : "Ajouter une catégorie"
        }
        onClose={closeFormModal}
        closeDisabled={saving}
        size="md"
      >
        <form onSubmit={handleSubmit}>
          <p className="mb-5 text-sm text-slate-500">
            {editingCategory
              ? "Mettez à jour les informations de cette catégorie."
              : "Créez une catégorie pour organiser vos produits."}
          </p>
          {formError && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              {formError}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label
                htmlFor="category-name"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Nom de la catégorie
              </label>
              <input
                id="category-name"
                name="name"
                value={formData.name}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                autoFocus
                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
                placeholder="Ex : Électronique"
                required
              />
            </div>
            <div>
              <label
                htmlFor="category-description"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Description
              </label>
              <textarea
                id="category-description"
                name="description"
                value={formData.description}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                rows={4}
                className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50"
                placeholder="Description de la catégorie..."
              />
            </div>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeFormModal}
              disabled={saving}
              className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
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
                : editingCategory
                ? "Enregistrer"
                : "Ajouter"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={categoryToDelete !== null}
        title="Supprimer cette catégorie ?"
        description={
          <>
            La catégorie{" "}
            <span className="font-semibold text-slate-900">
              {categoryToDelete?.name}
            </span>{" "}
            sera définitivement supprimée. Cette opération peut échouer si elle
            contient encore des produits.
            {deleteError && (
              <span className="mt-4 block rounded-xl border border-red-200 bg-red-50 p-3 font-medium text-red-700">
                {deleteError}
              </span>
            )}
          </>
        }
        onCancel={() => {
          if (!deleting) {
            setCategoryToDelete(null);
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
