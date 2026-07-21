import { useEffect, useState, type ReactNode } from "react";
import { Edit, Eye, Loader2, Search, Trash2, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";
import {
  createCustomer,
  deleteCustomer,
  getCustomers,
  updateCustomer,
} from "../api/customerApi";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import EmptyState from "../components/ui/EmptyState";
import Modal from "../components/ui/Modal";
import { useToast } from "../components/ui/ToastProvider";
import type { Customer, CustomerFormData } from "../types/customer";

const emptyForm: CustomerFormData = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  address: "",
};

export default function CustomersPage() {
  const toast = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [formData, setFormData] = useState<CustomerFormData>(emptyForm);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [deleteError, setDeleteError] = useState("");

  async function loadCustomers() {
    try {
      setLoading(true);
      setError("");
      setCustomers(await getCustomers(search));
    } catch {
      setError("Impossible de charger les clients.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCustomers();
  }, [search]);

  function handleChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  }

  function openCreateModal() {
    setEditingCustomer(null);
    setFormData(emptyForm);
    setFormError("");
    setIsFormOpen(true);
  }

  function openEditModal(customer: Customer) {
    setEditingCustomer(customer);
    setFormData({
      first_name: customer.first_name,
      last_name: customer.last_name,
      email: customer.email,
      phone: customer.phone ?? "",
      address: customer.address ?? "",
    });
    setFormError("");
    setIsFormOpen(true);
  }

  function closeFormModal() {
    if (saving) return;
    setIsFormOpen(false);
    setEditingCustomer(null);
    setFormData(emptyForm);
    setFormError("");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    try {
      setSaving(true);
      setFormError("");
      const response = editingCustomer
        ? await updateCustomer(editingCustomer.id, formData)
        : await createCustomer(formData);

      toast.success(
        response.message ??
          (editingCustomer
            ? "Client modifié avec succès."
            : "Client créé avec succès.")
      );
      setIsFormOpen(false);
      setEditingCustomer(null);
      setFormData(emptyForm);
      await loadCustomers();
    } catch {
      setFormError(
        "Une erreur est survenue. Vérifiez que l’adresse email n’est pas déjà utilisée."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!customerToDelete) return;

    try {
      setDeleting(true);
      setDeleteError("");
      const response = await deleteCustomer(customerToDelete.id);
      toast.success(response.message ?? "Client supprimé avec succès.");
      setCustomerToDelete(null);
      await loadCustomers();
    } catch {
      setDeleteError(
        "Impossible de supprimer ce client. Il possède peut-être des commandes."
      );
      toast.error("Impossible de supprimer ce client.");
    } finally {
      setDeleting(false);
    }
  }

  const fieldClass =
    "w-full rounded-xl border border-slate-200 px-4 py-3 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50";

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Clients</h1>
          <p className="mt-1 text-slate-500">
            Gérez les informations des clients et leur historique.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="rounded-xl bg-indigo-50 px-5 py-3 text-sm font-semibold text-indigo-700">
            {customers.length} client(s)
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <UserPlus size={19} />
            Ajouter un client
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
              placeholder="Rechercher par nom, email ou téléphone..."
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-slate-500">
            <Loader2 size={18} className="animate-spin" />
            Chargement des clients...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
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
                    <td colSpan={6}>
                      <EmptyState
                        icon={<UserPlus size={22} />}
                        title="Aucun client trouvé"
                        description="Ajoutez un client ou modifiez votre recherche."
                      />
                    </td>
                  </tr>
                )}
                {customers.map((customer) => {
                  const customerName = `${customer.first_name} ${customer.last_name}`;

                  return (
                    <tr
                      key={customer.id}
                      className="border-b border-slate-100 transition-colors hover:bg-slate-50/80 last:border-0"
                    >
                      <td className="py-4 font-semibold text-slate-900">
                        {customerName}
                      </td>
                      <td className="py-4 text-slate-600">{customer.email}</td>
                      <td className="py-4 text-slate-600">
                        {customer.phone || "-"}
                      </td>
                      <td className="max-w-xs truncate py-4 text-slate-600">
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
                            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
                            title="Voir les détails"
                            aria-label={`Voir les détails du client ${customerName}`}
                          >
                            <Eye size={17} />
                          </Link>
                          <button
                            type="button"
                            onClick={() => openEditModal(customer)}
                            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
                            title="Modifier"
                            aria-label={`Modifier le client ${customerName}`}
                          >
                            <Edit size={17} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteError("");
                              setCustomerToDelete(customer);
                            }}
                            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                            title="Supprimer"
                            aria-label={`Supprimer le client ${customerName}`}
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={isFormOpen}
        title={editingCustomer ? "Modifier un client" : "Ajouter un client"}
        onClose={closeFormModal}
        closeDisabled={saving}
        size="lg"
      >
        <form onSubmit={handleSubmit}>
          <p className="mb-5 text-sm text-slate-500">
            Renseignez les informations du client.
          </p>
          {formError && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              {formError}
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <CustomerField label="Prénom" htmlFor="customer-first-name">
              <input
                id="customer-first-name"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                className={fieldClass}
                placeholder="Ex : Erij"
                autoFocus
                required
              />
            </CustomerField>
            <CustomerField label="Nom" htmlFor="customer-last-name">
              <input
                id="customer-last-name"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                className={fieldClass}
                placeholder="Ex : Ben Amor"
                required
              />
            </CustomerField>
            <CustomerField label="Email" htmlFor="customer-email">
              <input
                id="customer-email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className={fieldClass}
                placeholder="nom@entreprise.com"
                required
              />
            </CustomerField>
            <CustomerField label="Téléphone" htmlFor="customer-phone">
              <input
                id="customer-phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className={fieldClass}
                placeholder="Ex : 12345678"
              />
            </CustomerField>
            <div className="md:col-span-2">
              <CustomerField label="Adresse" htmlFor="customer-address">
                <textarea
                  id="customer-address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  rows={4}
                  className={`${fieldClass} resize-y`}
                  placeholder="Adresse du client..."
                />
              </CustomerField>
            </div>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeFormModal}
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
              {saving && <Loader2 size={17} className="animate-spin" />}
              {saving
                ? "Enregistrement..."
                : editingCustomer
                ? "Enregistrer"
                : "Ajouter"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={customerToDelete !== null}
        title="Supprimer ce client ?"
        description={
          <>
            Le client{" "}
            <span className="font-semibold text-slate-900">
              {customerToDelete?.first_name} {customerToDelete?.last_name}
            </span>{" "}
            sera définitivement supprimé. Cette opération peut échouer s’il
            possède encore des commandes.
            {deleteError && (
              <span className="mt-4 block rounded-xl border border-red-200 bg-red-50 p-3 font-medium text-red-700">
                {deleteError}
              </span>
            )}
          </>
        }
        onCancel={() => {
          if (!deleting) {
            setCustomerToDelete(null);
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

function CustomerField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-2 block text-sm font-medium text-slate-700"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
