import { useEffect, useState } from "react";
import { Edit, Eye, Search, Trash2, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";
import {
  createCustomer,
  deleteCustomer,
  getCustomers,
  updateCustomer,
} from "../api/customerApi";
import type { Customer, CustomerFormData } from "../types/customer";

const emptyForm: CustomerFormData = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  address: "",
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [formData, setFormData] = useState<CustomerFormData>(emptyForm);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadCustomers() {
    try {
      setLoading(true);
      setError("");

      const data = await getCustomers(search);
      setCustomers(data);
    } catch {
      setError("Impossible de charger les clients.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomers();
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

  function startEdit(customer: Customer) {
    setEditingCustomer(customer);

    setFormData({
      first_name: customer.first_name,
      last_name: customer.last_name,
      email: customer.email,
      phone: customer.phone ?? "",
      address: customer.address ?? "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingCustomer(null);
    setFormData(emptyForm);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      setSaving(true);
      setMessage("");
      setError("");

      if (editingCustomer) {
        const response = await updateCustomer(editingCustomer.id, formData);
        setMessage(response.message ?? "Client modifié avec succès.");
      } else {
        const response = await createCustomer(formData);
        setMessage(response.message ?? "Client créé avec succès.");
      }

      resetForm();
      await loadCustomers();
    } catch {
      setError(
        "Une erreur est survenue. Vérifie que l’email n’est pas déjà utilisé."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(customer: Customer) {
    const confirmed = window.confirm(
      `Voulez-vous vraiment supprimer le client "${customer.first_name} ${customer.last_name}" ?`
    );

    if (!confirmed) return;

    try {
      setMessage("");
      setError("");

      const response = await deleteCustomer(customer.id);
      setMessage(response.message ?? "Client supprimé avec succès.");

      await loadCustomers();
    } catch {
      setError(
        "Impossible de supprimer ce client. Il possède peut-être des commandes."
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Clients</h1>
          <p className="mt-1 text-slate-500">
            Gérez les informations des clients et leur historique.
          </p>
        </div>

        <div className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm">
          {customers.length} client(s)
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
            <UserPlus size={22} />
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {editingCustomer ? "Modifier un client" : "Ajouter un client"}
            </h2>
            <p className="text-sm text-slate-500">
              Renseignez les informations du client.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Prénom
            </label>
            <input
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500"
              placeholder="Ex: Erij"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Nom
            </label>
            <input
              name="last_name"
              value={formData.last_name}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500"
              placeholder="Ex: Ben Amor"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500"
              placeholder="client@example.com"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Téléphone
            </label>
            <input
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500"
              placeholder="Ex: 12345678"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Adresse
            </label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              className="min-h-12 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500"
              placeholder="Adresse du client..."
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
              : editingCustomer
              ? "Modifier"
              : "Ajouter"}
          </button>

          {editingCustomer && (
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
              placeholder="Rechercher par nom, email ou téléphone..."
            />
          </div>
        </div>

        {loading ? (
          <p className="py-8 text-center text-slate-500">
            Chargement des clients...
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-3">Client</th>
                  <th className="py-3">Email</th>
                  <th className="py-3">Téléphone</th>
                  <th className="py-3">Adresse</th>
                  <th className="py-3">Commandes</th>
                  <th className="py-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {customers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      Aucun client trouvé.
                    </td>
                  </tr>
                )}

                {customers.map((customer) => (
                  <tr key={customer.id} className="border-b border-slate-100">
                    <td className="py-4">
                      <p className="font-semibold text-slate-900">
                        {customer.first_name} {customer.last_name}
                      </p>
                    </td>

                    <td className="py-4 text-slate-600">{customer.email}</td>

                    <td className="py-4 text-slate-600">
                      {customer.phone || "-"}
                    </td>

                    <td className="py-4 text-slate-600">
                      {customer.address || "-"}
                    </td>

                    <td className="py-4">
                      <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">
                        {customer.orders_count ?? 0} commande(s)
                      </span>
                    </td>

                    <td className="py-4">
     <div className="flex justify-end gap-2">
  <Link
    to={`/customers/${customer.id}`}
    className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-indigo-600"
  >
    <Eye size={17} />
  </Link>

  <button
    onClick={() => startEdit(customer)}
    className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-indigo-600"
  >
    <Edit size={17} />
  </button>

  <button
    onClick={() => handleDelete(customer)}
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