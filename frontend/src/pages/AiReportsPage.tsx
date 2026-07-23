import { useEffect, useState } from "react";
import axios from "axios";
import { Bot, FileText, Sparkles } from "lucide-react";
import { generateAiReport, getAiReports } from "../api/aiApi";
import type { AiPeriod, AiReport, AiReportType } from "../types/ai";
import EmptyState from "../components/ui/EmptyState";
import { useToast } from "../components/ui/ToastProvider";
import { cleanAiReportResponse } from "../utils/aiResponse";
import ReactMarkdown from "react-markdown";
const reportTypeLabels: Record<AiReportType, string> = {
  sales_report: "Rapport de ventes",
  stock_recommendation: "Recommandations de stock",
  customer_analysis: "Analyse des clients",
  marketing_recommendation: "Recommandations marketing",
};

const periodLabels: Record<AiPeriod, string> = {
  daily: "Journalier",
  weekly: "Hebdomadaire",
  monthly: "Mensuel",
  yearly: "Annuel",
};

export default function AiReportsPage() {
  const toast = useToast();
  const [reports, setReports] = useState<AiReport[]>([]);
  const [type, setType] = useState<AiReportType>("sales_report");
  const [period, setPeriod] = useState<AiPeriod>("monthly");
  const [selectedReport, setSelectedReport] = useState<AiReport | null>(null);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  async function loadReports() {
    try {
      setLoading(true);
      const data = await getAiReports();
      setReports(data);

      if (!selectedReport && data.length > 0) {
        setSelectedReport(data[0]);
      }
    } catch {
      setError("Impossible de charger les rapports IA.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, []);

  async function handleGenerateReport(e: React.FormEvent) {
    e.preventDefault();

    try {
      setGenerating(true);
      setError("");

      const response = await generateAiReport({
        type,
        period,
      });

      toast.success(response.message ?? "Rapport IA généré avec succès.");
      setSelectedReport(response.data);
      await loadReports();
    } catch (requestError) {
      const message = axios.isAxiosError<{ message?: string }>(requestError)
        ? requestError.response?.data?.message
        : null;

      toast.error(message ?? "Génération du rapport IA impossible.");
    } finally {
      setGenerating(false);
    }
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleString("fr-FR");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Rapports IA</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            Générez des analyses commerciales à partir des données du dashboard.
          </p>
        </div>

        <div className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm">
          {reports.length} rapport(s)
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 dark:border-red-900/70 bg-red-50 dark:bg-red-950/40 p-4 text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="space-y-6">
        <form
          onSubmit={handleGenerateReport}
          className="rounded-2xl border border-indigo-100 dark:border-indigo-900 bg-gradient-to-r from-white dark:from-slate-900 to-indigo-50/40 dark:to-indigo-950/30 p-5 shadow-sm"
        >
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Sparkles size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Générer un rapport
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Choisissez le type d’analyse IA.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Type de rapport
              </label>

              <select
                value={type}
                onChange={(e) => setType(e.target.value as AiReportType)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-400"
              >
                {Object.entries(reportTypeLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Période
              </label>

              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as AiPeriod)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-400"
              >
                {Object.entries(periodLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <button
              disabled={generating}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300 dark:disabled:bg-indigo-900/50 dark:disabled:text-indigo-300 md:w-auto"
            >
              <Bot size={18} />
              {generating ? "Génération..." : "Générer le rapport"}
            </button>
          </div>
        </form>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">
            Rapport mis en avant
          </h2>

          {!selectedReport ? (
            <EmptyState
              icon={<FileText size={22} />}
              title="Aucun rapport disponible"
              description="Générez un rapport pour afficher une première analyse commerciale."
            />
          ) : (
            <div>
              <div className="mb-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 p-4">
                <p className="font-bold text-slate-900 dark:text-slate-100">
                  {selectedReport.title}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {formatDate(selectedReport.generated_at)}
                </p>
              </div>


<div className="ai-markdown whitespace-pre-line rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-7 dark:border-slate-800 dark:bg-slate-950">
  <ReactMarkdown>
    {cleanAiReportResponse(selectedReport.content)}
  </ReactMarkdown>
</div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900 bg-gradient-to-r from-white dark:from-slate-900 to-indigo-50/40 dark:to-indigo-950/30 p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">
          Historique des rapports
        </h2>

        {loading ? (
          <p className="py-8 text-center text-slate-500 dark:text-slate-400">
            Chargement des rapports...
          </p>
        ) : reports.length === 0 ? (
          <EmptyState
            icon={<FileText size={22} />}
            title="Aucun rapport généré"
            description="Utilisez le formulaire ci-dessus pour créer votre première analyse."
          />
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <button
                key={report.id}
                type="button"
                onClick={() => setSelectedReport(report)}
                className={`flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left transition ${
                  selectedReport?.id === report.id
                    ? "border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/50"
                    : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400">
                    <FileText size={18} />
                  </div>

                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {report.title}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {formatDate(report.generated_at)}
                    </p>
                  </div>
                </div>

                <span className="hidden rounded-full bg-white dark:bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 md:block">
                  {reportTypeLabels[report.type]}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
