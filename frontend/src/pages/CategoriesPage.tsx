import { useEffect, useState } from "react";
import { Edit, FolderPlus, Search, Trash2 } from "lucide-react";
import {
  createCategory,
  deleteCategory,
  getCategories,
  updateCategory,
  type CategoryFormData,
} from "../api/categoryApi";
import type { Category } from "../types/category";

const emptyForm: CategoryFormData = {
  name: "",
  description: "",
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState<CategoryFormData>(emptyForm);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadCategories() {
    try {
      setLoading(true);
      setError("");

      const data = await getCategories(search);
      setCategories(data);
    } catch {
      setError("Impossible de charger les catégories.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCategories();
  }, [search]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function startEdit(category: Category) {
    setEditingCategory(category);

    setFormData({
      name: category.name,
      description: category.description ?? "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingCategory(null);
    setFormData(emptyForm);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");
      setMessage("");

      if (editingCategory) {
        const response = await updateCategory(editingCategory.id, formData);
        setMessage(response.message ?? "Catégorie modifiée avec succès.");
      } else {
        const response = await createCategory(formData);
        setMessage(response.message ?? "Catégorie créée avec succès.");
      }

      resetForm();
      await loadCategories();
    } catch {
      setError("Une erreur est survenue lors de l’enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(category: Category) {
    const confirmed = window.confirm(
      `Voulez-vous vraiment supprimer la catégorie "${category.name}" ?`
    );

    if (!confirmed) return;

    try {
      setError("");
      setMessage("");

      const response = await deleteCategory(category.id);
      setMessage(response.message ?? "Catégorie supprimée avec succès.");

      await loadCategories();
    } catch {
      setError(
        "Impossible de supprimer cette catégorie. Elle contient peut-être des produits."
      );
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

        <div className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm">
          {categories.length} catégorie(s)
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
            <FolderPlus size={22} />
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {editingCategory
                ? "Modifier une catégorie"
                : "Ajouter une catégorie"}
            </h2>
            <p className="text-sm text-slate-500">
              Créez des catégories pour organiser vos produits.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Nom de la catégorie
            </label>
            <input
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500"
              placeholder="Ex: Électronique"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="min-h-12 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500"
              placeholder="Description de la catégorie..."
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
              : editingCategory
              ? "Modifier"
              : "Ajouter"}
          </button>

          {editingCategory && (
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
        <div className="mb-5">
          <div className="relative max-w-md">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-4 outline-none focus:border-indigo-500"
              placeholder="Rechercher une catégorie..."
            />
          </div>
        </div>

        {loading ? (
          <p className="py-8 text-center text-slate-500">
            Chargement des catégories...
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-3">Nom</th>
                  <th className="py-3">Description</th>
                  <th className="py-3">Produits</th>
                  <th className="py-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {categories.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500">
                      Aucune catégorie trouvée.
                    </td>
                  </tr>
                )}

                {categories.map((category) => (
                  <tr key={category.id} className="border-b border-slate-100">
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
                          onClick={() => startEdit(category)}
                          className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-indigo-600"
                        >
                          <Edit size={17} />
                        </button>

                        <button
                          onClick={() => handleDelete(category)}
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