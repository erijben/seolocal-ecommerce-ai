import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Bot,
  BrainCircuit,
  Clock,
  Database,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { getAiAgentInsights } from "../api/aiApi";
import type { AiAgentInsights } from "../types/ai";
import { addRequestReference } from "../api/requestId";
import {
  getIntentLabel,
  getProviderBadgeClass,
  getProviderLabel,
} from "../utils/aiMetadata";

export default function AiAgentInsightsPage() {
  const [insights, setInsights] = useState<AiAgentInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadInsights() {
    try {
      setLoading(true);
      setError("");

      const data = await getAiAgentInsights();
      setInsights(data);
    } catch (requestError) {
      setError(addRequestReference(
        "Impossible de charger l’activité de l’assistant IA.",
        requestError,
      ));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialInsights() {
      try {
        const data = await getAiAgentInsights();
        if (!cancelled) {
          setInsights(data);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(addRequestReference(
            "Impossible de charger l’activité de l’assistant IA.",
            requestError,
          ));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadInitialInsights();

    return () => {
      cancelled = true;
    };
  }, []);

  const maxIntentTotal = useMemo(() => {
    if (!insights?.intent_distribution.length) {
      return 1;
    }

    return Math.max(...insights.intent_distribution.map((item) => item.total));
  }, [insights]);

  const maxProviderTotal = useMemo(() => {
    if (!insights?.provider_distribution.length) {
      return 1;
    }

    return Math.max(...insights.provider_distribution.map((item) => item.total));
  }, [insights]);

  function formatDate(value?: string | null) {
    if (!value) {
      return "Aucune activité";
    }

    return new Date(value).toLocaleString("fr-FR");
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-slate-500 dark:text-slate-400 shadow-sm">
        Chargement du suivi de l’assistant IA...
      </div>
    );
  }

  if (error || !insights) {
    return (
      <div className="rounded-2xl border border-red-200 dark:border-red-900/70 bg-red-50 dark:bg-red-950/40 p-5 text-red-700 dark:text-red-300">
        {error || "Aucune donnée disponible pour l’assistant IA."}
      </div>
    );
  }

  const overview = insights.overview;

  const providerCount = (provider: string) =>
    insights.provider_distribution.find(
      (item) => item.provider === provider,
    )?.total ?? 0;

  const ollamaCount = providerCount("ollama");
  const archivedCount =
    providerCount("demo") + providerCount("demo_fallback");

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            Suivi de l’assistant IA
          </h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            Activité et utilisation de l’assistant IA.
          </p>
        </div>

        <button
          type="button"
          onClick={loadInsights}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-800/70"
        >
          <Activity size={18} />
          Actualiser
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InsightCard
          title="Questions IA"
          value={overview.total_questions}
          description="Total des interactions avec l’assistant"
          icon={<MessageCircle size={22} />}
        />

        <InsightCard
          title="Ollama local"
          value={ollamaCount}
          description="Réponses générées localement"
          icon={<Bot size={22} />}
        />

        <InsightCard
          title="OpenAI"
          value={overview.openai_count}
          description="Réponses générées via OpenAI"
          icon={<ShieldCheck size={22} />}
        />

        <InsightCard
          title="Réponses archivées"
          value={archivedCount}
          description="Anciennes réponses conservées dans l’historique"
          icon={<Database size={22} />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm xl:col-span-2">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <BrainCircuit size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Sujets les plus demandés
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Répartition des demandes adressées à l’assistant IA.
              </p>
            </div>
          </div>

          {insights.intent_distribution.length === 0 ? (
            <p className="py-8 text-center text-slate-500 dark:text-slate-400">
              Aucun sujet détecté pour le moment.
            </p>
          ) : (
            <div className="space-y-4">
              {insights.intent_distribution.map((item) => {
                const width = Math.max((item.total / maxIntentTotal) * 100, 8);

                return (
                  <div key={item.intent}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {getIntentLabel(item.intent)}
                      </span>
                      <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                        {item.total}
                      </span>
                    </div>

                    <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-indigo-600"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Clock size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Dernière activité
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Dernière question posée à l’assistant.
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/60 p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Dernière interaction</p>
            <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
              {formatDate(overview.last_question_at)}
            </p>
          </div>

          <div className="mt-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Sujet le plus fréquent</p>
            <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
              {overview.most_used_intent
                ? getIntentLabel(overview.most_used_intent)
                : "Aucun sujet"}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {overview.most_used_intent_count} occurrence(s)
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <BarChart3 size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Moteurs utilisés
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Moteurs ayant généré les réponses.
              </p>
            </div>
          </div>

          {insights.provider_distribution.length === 0 ? (
            <p className="py-8 text-center text-slate-500 dark:text-slate-400">
              Aucun moteur utilisé.
            </p>
          ) : (
            <div className="space-y-4">
              {insights.provider_distribution.map((item) => {
                const width = Math.max((item.total / maxProviderTotal) * 100, 8);

                return (
                  <div key={item.provider}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className={getProviderBadgeClass(item.provider)}>
                        {getProviderLabel(item.provider)}
                      </span>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {item.total}
                      </span>
                    </div>

                    <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-slate-700"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm xl:col-span-2">
          <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">
            Dernières questions
          </h2>

          {insights.recent_questions.length === 0 ? (
            <p className="py-8 text-center text-slate-500 dark:text-slate-400">
              Aucune question récente.
            </p>
          ) : (
            <div className="space-y-3">
              {insights.recent_questions.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4"
                >
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    {item.question}
                  </p>

                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {formatDate(item.created_at)}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.intent && (
                      <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                        {getIntentLabel(item.intent)}
                      </span>
                    )}

                    {item.provider && (
                      <span className={getProviderBadgeClass(item.provider)}>
                        {getProviderLabel(item.provider)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type InsightCardProps = {
  title: string;
  value: number;
  description: string;
  icon: React.ReactNode;
};

function InsightCard({ title, value, description, icon }: InsightCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
          {icon}
        </div>
      </div>

      <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  );
}
