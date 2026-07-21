import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  BookOpen,
  Database,
  FileText,
  Loader2,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";
import {
  deleteKnowledgeDocument,
  getApiErrorMessage,
  getKnowledgeDocuments,
  uploadKnowledgePdf,
} from "../api/knowledgeApi";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import EmptyState from "../components/ui/EmptyState";
import { useToast } from "../components/ui/ToastProvider";
import Modal from "../components/ui/Modal";
import StatusBadge from "../components/ui/StatusBadge";
import type {
  KnowledgeDocument,
  KnowledgeDocumentType,
} from "../types/knowledge";

export default function KnowledgeBasePage() {
  const toast = useToast();
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] =
    useState<KnowledgeDocument | null>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<KnowledgeDocumentType>("other");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const stats = useMemo(() => {
    const pdfDocuments = documents.filter((document) =>
      Boolean(document.original_filename)
    );

    return {
      pdfDocuments: pdfDocuments.length,
      activePdfDocuments: pdfDocuments.filter(
        (document) => document.status === "active"
      ).length,
      totalChunks: documents.reduce(
        (total, document) => total + getDocumentChunksCount(document),
        0
      ),
      failedExtractions: documents.filter(
        (document) => document.extraction_status === "failed"
      ).length,
    };
  }, [documents]);

  useEffect(() => {
    void fetchDocuments();
  }, []);

  async function fetchDocuments() {
    try {
      setLoading(true);
      setError(null);
      setDocuments(await getKnowledgeDocuments());
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  function resetUploadForm() {
    setTitle("");
    setType("other");
    setFile(null);
    setUploadError(null);
  }

  function openUploadModal() {
    resetUploadForm();
    setIsUploadOpen(true);
  }

  function closeUploadModal() {
    if (uploading) return;
    setIsUploadOpen(false);
    resetUploadForm();
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setUploadError("Ajoutez un fichier PDF avant de l’envoyer.");
      return;
    }

    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      setUploadError("Le fichier doit être au format PDF.");
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);
      await uploadKnowledgePdf({
        file,
        title,
        type,
        status: "active",
      });

      toast.success("PDF ajouté à la base de connaissances avec succès.");
      setIsUploadOpen(false);
      resetUploadForm();
      await fetchDocuments();
    } catch (requestError) {
      const message = getApiErrorMessage(requestError);
      setUploadError(message);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!documentToDelete) return;

    try {
      setDeleting(true);
      setDeleteError(null);
      await deleteKnowledgeDocument(documentToDelete.id);
      toast.success("Document supprimé avec succès.");
      setDocumentToDelete(null);
      await fetchDocuments();
    } catch (requestError) {
      const message = getApiErrorMessage(requestError);
      setDeleteError(message);
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Base de connaissances IA
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Gérez les documents internes utilisés par l’assistant IA.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => void fetchDocuments()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
          >
            <Database size={18} />
            Actualiser
          </button>
          <button
            type="button"
            onClick={openUploadModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <UploadCloud size={18} />
            Importer un PDF
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="PDFs importés"
          value={stats.pdfDocuments}
          description="Documents ajoutés par l’admin"
          icon={<FileText size={20} />}
        />
        <StatCard
          title="PDFs actifs"
          value={stats.activePdfDocuments}
          description="Utilisables par l’assistant IA"
          icon={<ShieldCheck size={20} />}
        />
        <StatCard
          title="Passages indexés"
          value={stats.totalChunks}
          description="Passages disponibles pour l’assistant"
          icon={<Database size={20} />}
        />
        <StatCard
          title="Documents à vérifier"
          value={stats.failedExtractions}
          description="PDFs à vérifier"
          icon={<AlertTriangle size={20} />}
        />
      </div>

      <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white p-3 text-indigo-600">
              <BookOpen size={22} />
            </div>
            <div>
              <h2 className="font-bold text-indigo-950">
                Utilisation des documents
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-indigo-800">
                Les PDF sont extraits, découpés en passages puis indexés afin
                que l’assistant puisse répondre à partir du contexte interne.
              </p>
            </div>
          </div>
          <div className="grid shrink-0 grid-cols-3 gap-2 text-center text-xs font-semibold text-indigo-800 lg:ml-auto">
            <ProcessStep number="1" title="Import" />
            <ProcessStep number="2" title="Préparation" />
            <ProcessStep number="3" title="Assistant" />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-slate-900">
            Documents PDF de la base IA
          </h2>
          <p className="text-sm text-slate-500">
            Documents disponibles pour enrichir les réponses de l’assistant.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl bg-slate-50 p-8 text-sm font-semibold text-slate-500">
            <Loader2 size={18} className="animate-spin" />
            Chargement des documents...
          </div>
        ) : documents.length === 0 ? (
          <div className="rounded-2xl bg-slate-50">
            <EmptyState
              icon={<FileText size={22} />}
              title="Aucun document trouvé"
              description="Importez un PDF pour alimenter la base de connaissances."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-3">Document</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Statut</th>
                  <th className="px-3 py-3">Préparation</th>
                  <th className="px-3 py-3">Passages</th>
                  <th className="px-3 py-3">Fichier</th>
                  <th className="px-3 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr
                    key={document.id}
                    className="border-b border-slate-100 transition-colors hover:bg-slate-50/80 last:border-0"
                  >
                    <td className="px-3 py-4">
                      <p className="font-bold text-slate-900">
                        {document.title}
                      </p>
                      <p className="text-xs text-slate-500">
                        Ajouté le {formatDate(document.created_at)}
                      </p>
                    </td>
                    <td className="px-3 py-4">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                        {getTypeLabel(document.type)}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <StatusBadge
                        variant={document.status === "active" ? "success" : "neutral"}
                      >
                        {document.status === "active" ? "Actif" : "Inactif"}
                      </StatusBadge>
                    </td>
                    <td className="px-3 py-4">
                      <ExtractionBadge status={document.extraction_status} />
                    </td>
                    <td className="px-3 py-4 font-bold text-slate-900">
                      {getDocumentChunksCount(document)}
                    </td>
                    <td className="px-3 py-4 text-slate-600">
                      {document.original_filename ? (
                        <>
                          <p className="font-medium text-slate-800">
                            {document.original_filename}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatFileSize(document.file_size ?? 0)}
                          </p>
                        </>
                      ) : (
                        <span className="text-slate-400">
                          Ancien document texte
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError(null);
                          setDocumentToDelete(document);
                        }}
                        className="inline-flex items-center justify-center rounded-xl border border-red-100 bg-red-50 p-2 text-red-600 transition hover:border-red-200 hover:bg-red-100"
                        title="Supprimer"
                        aria-label={`Supprimer le document ${document.title}`}
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={isUploadOpen}
        title="Importer un PDF"
        onClose={closeUploadModal}
        closeDisabled={uploading}
        size="md"
      >
        <form onSubmit={handleUpload}>
          <p className="mb-5 text-sm leading-6 text-slate-500">
            Le texte sera extrait et indexé dans la base de connaissances.
          </p>
          {uploadError && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              {uploadError}
            </div>
          )}
          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Titre du document
              </span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ex : Règles internes de réapprovisionnement"
                autoFocus
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Type
              </span>
              <input
                value={type}
                onChange={(event) =>
                  setType(event.target.value as KnowledgeDocumentType)
                }
                placeholder="Ex : juridique, RH, produit..."
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Fichier PDF
              </span>
              <input
                type="file"
                accept="application/pdf"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:bg-slate-100"
              />
            </label>
            {file && (
              <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                <span className="font-semibold text-slate-900">
                  Fichier sélectionné :
                </span>{" "}
                {file.name} — {formatFileSize(file.size)}
              </div>
            )}
          </div>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeUploadModal}
              disabled={uploading}
              className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading && <Loader2 size={18} className="animate-spin" />}
              {uploading ? "Préparation en cours..." : "Importer le PDF"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={documentToDelete !== null}
        title="Supprimer ce document ?"
        description={
          <>
            Le document{" "}
            <span className="font-semibold text-slate-900">
              {documentToDelete?.title}
            </span>{" "}
            et ses passages indexés seront définitivement supprimés.
            {deleteError && (
              <span className="mt-4 block rounded-xl border border-red-200 bg-red-50 p-3 font-medium text-red-700">
                {deleteError}
              </span>
            )}
          </>
        }
        onCancel={() => {
          if (!deleting) {
            setDocumentToDelete(null);
            setDeleteError(null);
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

function StatCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: number;
  description: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
          <p className="mt-2 text-sm text-slate-500">{description}</p>
        </div>
        <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600">
          {icon}
        </div>
      </div>
    </div>
  );
}

function ProcessStep({ number, title }: { number: string; title: string }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2">
      <span className="mr-1 text-indigo-600">{number}.</span>
      {title}
    </div>
  );
}

function ExtractionBadge({
  status,
}: {
  status?: KnowledgeDocument["extraction_status"] | null;
}) {
  if (status === "success") {
    return (
      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
        Succès
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
        Échec
      </span>
    );
  }

  return (
    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
      En attente
    </span>
  );
}

function getDocumentChunksCount(document: KnowledgeDocument) {
  return document.chunks_count ?? document.chunks?.length ?? 0;
}

function getTypeLabel(type: KnowledgeDocumentType) {
  return type || "Autre";
}

function formatFileSize(size: number) {
  if (!size) return "0 Ko";
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} Ko`;
  return `${(size / (1024 * 1024)).toFixed(2)} Mo`;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}
