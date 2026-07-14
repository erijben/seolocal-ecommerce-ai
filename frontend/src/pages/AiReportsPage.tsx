import { useEffect, useState } from "react";
import { Bot, FileText, Sparkles } from "lucide-react";
import { generateAiReport, getAiReports } from "../api/aiApi";
import type { AiPeriod, AiReport, AiReportType } from "../types/ai";
import { cleanAiResponse, isDemoAiResponse } from "../utils/aiResponse";
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
  const [reports, setReports] = useState<AiReport[]>([]);
  const [type, setType] = useState<AiReportType>("sales_report");
  const [period, setPeriod] = useState<AiPeriod>("monthly");
  const [selectedReport, setSelectedReport] = useState<AiReport | null>(null);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");
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
      setMessage("");
      setError("");

      const response = await generateAiReport({
        type,
        period,
      });

      setMessage(response.message ?? "Rapport IA généré avec succès.");
      setSelectedReport(response.data);
      await loadReports();
    } catch {
      setError("Impossible de générer le rapport IA.");
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
          <h1 className="text-3xl font-bold text-slate-900">Rapports IA</h1>
          <p className="mt-1 text-slate-500">
            Générez des analyses commerciales à partir des données du dashboard.
          </p>
        </div>

        <div className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm">
          {reports.length} rapport(s)
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

      <div className="grid gap-6 xl:grid-cols-3">
        <form
          onSubmit={handleGenerateReport}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Sparkles size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Générer un rapport
              </h2>
              <p className="text-sm text-slate-500">
                Choisissez le type d’analyse IA.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Type de rapport
              </label>

              <select
                value={type}
                onChange={(e) => setType(e.target.value as AiReportType)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500"
              >
                {Object.entries(reportTypeLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Période
              </label>

              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as AiPeriod)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500"
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
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:bg-indigo-300"
            >
              <Bot size={18} />
              {generating ? "Génération..." : "Générer le rapport"}
            </button>
          </div>
        </form>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <h2 className="mb-4 text-lg font-bold text-slate-900">
            Rapport sélectionné
          </h2>

          {!selectedReport ? (
            <p className="py-8 text-center text-slate-500">
              Aucun rapport sélectionné.
            </p>
          ) : (
            <div>
              <div className="mb-4 rounded-2xl bg-slate-50 p-4">
                <p className="font-bold text-slate-900">
                  {selectedReport.title}
                </p>
                <p className="text-sm text-slate-500">
                  {formatDate(selectedReport.generated_at)}
                </p>
              </div>

             {isDemoAiResponse(selectedReport.content) && (
  <div className="mb-3 inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
    Mode démo intelligent
  </div>
)}

<div className="whitespace-pre-line rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-7 text-slate-700">
  {cleanAiResponse(selectedReport.content)}
</div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-slate-900">
          Historique des rapports
        </h2>

        {loading ? (
          <p className="py-8 text-center text-slate-500">
            Chargement des rapports...
          </p>
        ) : reports.length === 0 ? (
          <p className="py-8 text-center text-slate-500">
            Aucun rapport généré pour le moment.
          </p>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <button
                key={report.id}
                type="button"
                onClick={() => setSelectedReport(report)}
                className={`flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left transition ${
                  selectedReport?.id === report.id
                    ? "border-indigo-300 bg-indigo-50"
                    : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-indigo-600">
                    <FileText size={18} />
                  </div>

                  <div>
                    <p className="font-semibold text-slate-900">
                      {report.title}
                    </p>
                    <p className="text-sm text-slate-500">
                      {formatDate(report.generated_at)}
                    </p>
                  </div>
                </div>

                <span className="hidden rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 md:block">
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