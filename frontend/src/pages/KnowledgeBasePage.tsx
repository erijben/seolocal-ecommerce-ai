import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
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
import type {
  KnowledgeDocument,
  KnowledgeDocumentType,
} from "../types/knowledge";

export default function KnowledgeBasePage() {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<KnowledgeDocumentType>("other");
  const [file, setFile] = useState<File | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const stats = useMemo(() => {
    const pdfDocuments = documents.filter((document) =>
      Boolean(document.original_filename)
    );

    const activePdfDocuments = pdfDocuments.filter(
      (document) => document.status === "active"
    ).length;

    const totalChunks = documents.reduce((total, document) => {
      return total + getDocumentChunksCount(document);
    }, 0);

    const failedExtractions = documents.filter(
      (document) => document.extraction_status === "failed"
    ).length;

    return {
      pdfDocuments: pdfDocuments.length,
      activePdfDocuments,
      totalChunks,
      failedExtractions,
    };
  }, [documents]);

  useEffect(() => {
    void fetchDocuments();
  }, []);

  async function fetchDocuments() {
    try {
      setLoading(true);
      setError(null);

      const data = await getKnowledgeDocuments();

      setDocuments(data);
    } catch (error) {
      setError(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setError("Ajoute un fichier PDF avant d’envoyer.");
      return;
    }

    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      setError("Le fichier doit être au format PDF.");
      return;
    }

    try {
      setUploading(true);
      setError(null);
      setSuccessMessage(null);

      await uploadKnowledgePdf({
        file,
        title,
        type,
        status: "active",
      });

      setSuccessMessage("PDF ajouté à la base de connaissances avec succès.");
      setTitle("");
      setType("other");
      setFile(null);

      const fileInput = document.getElementById(
        "knowledge-pdf-file"
      ) as HTMLInputElement | null;

      if (fileInput) {
        fileInput.value = "";
      }

      await fetchDocuments();
    } catch (error) {
      setError(getApiErrorMessage(error));
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(documentToDelete: KnowledgeDocument) {
    const confirmed = window.confirm(
      `Supprimer le document "${documentToDelete.title}" ?`
    );

    if (!confirmed) {
      return;
    }

    try {
      setError(null);
      setSuccessMessage(null);

      await deleteKnowledgeDocument(documentToDelete.id);

      setDocuments((currentDocuments) =>
        currentDocuments.filter(
          (document) => document.id !== documentToDelete.id
        )
      );

      setSuccessMessage("Document supprimé avec succès.");
    } catch (error) {
      setError(getApiErrorMessage(error));
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
            Importez les documents PDF internes qui seront utilisés par
            l’assistant IA pour répondre aux questions métier.
          </p>
        </div>

        <button
          onClick={() => void fetchDocuments()}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <Database size={18} />
          Actualiser
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
          {successMessage}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
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
          description="Chunks disponibles pour le RAG"
          icon={<Database size={20} />}
        />

        <StatCard
          title="Erreurs extraction"
          value={stats.failedExtractions}
          description="PDFs à vérifier"
          icon={<AlertTriangle size={20} />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <form
          onSubmit={handleUpload}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-1"
        >
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600">
              <UploadCloud size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Ajouter un PDF
              </h2>
              <p className="text-sm text-slate-500">
                Le texte sera extrait puis envoyé à la base RAG.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Titre du document
              </span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ex: Règles internes de réapprovisionnement"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Type
              </span>
              <input
                value={type}
                onChange={(event) => setType(event.target.value)}
                placeholder="Ex: juridique, RH, produit..."
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Fichier PDF
              </span>
              <input
                id="knowledge-pdf-file"
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

            <button
              type="submit"
              disabled={uploading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {uploading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Extraction en cours...
                </>
              ) : (
                <>
                  <UploadCloud size={18} />
                  Ajouter à la base IA
                </>
              )}
            </button>
          </div>
        </form>

        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-6 xl:col-span-2">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-white p-3 text-indigo-600">
              <BookOpen size={24} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-indigo-950">
                Comment ces PDF sont utilisés ?
              </h2>

              <p className="mt-2 text-sm leading-6 text-indigo-800">
                Après l’import, Laravel extrait le texte du PDF, découpe le
                contenu en passages indexés, puis l’assistant IA peut utiliser
                ces passages pour répondre aux questions de l’admin.
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <ProcessStep
                  number="1"
                  title="Import PDF"
                  description="L’admin ajoute un document interne."
                />

                <ProcessStep
                  number="2"
                  title="Indexation"
                  description="Le texte est extrait et découpé en chunks."
                />

                <ProcessStep
                  number="3"
                  title="Assistant IA"
                  description="L’assistant répond à partir des documents."
                />
              </div>

              <p className="mt-5 rounded-xl bg-white p-4 text-sm font-medium text-indigo-900">
                Pour tester la réponse finale, allez directement dans la page
                Assistant IA et posez une question liée aux documents importés.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-slate-900">
            Documents PDF de la base IA
          </h2>
          <p className="text-sm text-slate-500">
            Liste des documents utilisés par l’assistant IA pour répondre avec
            le contexte interne de l’entreprise.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl bg-slate-50 p-8 text-sm font-semibold text-slate-500">
            <Loader2 size={18} className="animate-spin" />
            Chargement des documents...
          </div>
        ) : documents.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 p-8 text-center">
            <AlertTriangle className="mx-auto text-slate-400" size={32} />
            <h3 className="mt-3 font-bold text-slate-900">
              Aucun PDF ajouté
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Ajoutez votre premier document PDF pour alimenter l’assistant IA.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-3">Document</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Statut</th>
                  <th className="px-3 py-3">Extraction</th>
                  <th className="px-3 py-3">Chunks</th>
                  <th className="px-3 py-3">Fichier</th>
                  <th className="px-3 py-3 text-right">Action</th>
                </tr>
              </thead>

              <tbody>
                {documents.map((document) => (
                  <tr
                    key={document.id}
                    className="border-b border-slate-100 last:border-0"
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
                      <span
                        className={
                          document.status === "active"
                            ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"
                            : "rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600"
                        }
                      >
                        {document.status === "active" ? "Actif" : "Inactif"}
                      </span>
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
                        onClick={() => void handleDelete(document)}
                        className="inline-flex items-center justify-center rounded-xl bg-red-50 p-2 text-red-600 transition hover:bg-red-100"
                        title="Supprimer"
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

function ProcessStep({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-4">
      <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
        {number}
      </div>
      <p className="font-bold text-slate-900">{title}</p>
      <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
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
  if (!size) {
    return "0 Ko";
  }

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} Ko`;
  }

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