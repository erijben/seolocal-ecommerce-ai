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
    } catch {
      setError("Impossible de charger les statistiques de l’agent IA.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInsights();
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
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
        Chargement des insights de l’agent IA...
      </div>
    );
  }

  if (error || !insights) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
        {error || "Aucune donnée disponible pour l’agent IA."}
      </div>
    );
  }

  const overview = insights.overview;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            AI Agent Insights
          </h1>
          <p className="mt-1 text-slate-500">
            Observabilité de l’agent IA : intentions, provider, fallback et
            dernières interactions.
          </p>
        </div>

        <button
          type="button"
          onClick={loadInsights}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <Activity size={18} />
          Actualiser
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InsightCard
          title="Questions IA"
          value={overview.total_questions}
          description="Total des interactions avec l’agent"
          icon={<MessageCircle size={22} />}
        />

        <InsightCard
          title="OpenAI"
          value={overview.openai_count}
          description="Réponses générées par le provider cloud"
          icon={<Bot size={22} />}
        />

        <InsightCard
          title="Fallback"
          value={overview.fallback_count}
          description="Bascule automatique si OpenAI est indisponible"
          icon={<ShieldCheck size={22} />}
        />

        <InsightCard
          title="Démo locale"
          value={overview.demo_count}
          description="Analyse locale intelligente sans clé API"
          icon={<Database size={22} />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <BrainCircuit size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Distribution des intentions
              </h2>
              <p className="text-sm text-slate-500">
                Montre les sujets les plus demandés à l’agent IA.
              </p>
            </div>
          </div>

          {insights.intent_distribution.length === 0 ? (
            <p className="py-8 text-center text-slate-500">
              Aucune intention détectée pour le moment.
            </p>
          ) : (
            <div className="space-y-4">
              {insights.intent_distribution.map((item) => {
                const width = Math.max((item.total / maxIntentTotal) * 100, 8);

                return (
                  <div key={item.intent}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-slate-700">
                        {getIntentLabel(item.intent)}
                      </span>
                      <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                        {item.total}
                      </span>
                    </div>

                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
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

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Clock size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Dernière activité
              </h2>
              <p className="text-sm text-slate-500">
                Dernière question posée à l’agent.
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Dernière interaction</p>
            <p className="mt-1 font-semibold text-slate-900">
              {formatDate(overview.last_question_at)}
            </p>
          </div>

          <div className="mt-4 rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Intention dominante</p>
            <p className="mt-1 font-semibold text-slate-900">
              {overview.most_used_intent
                ? getIntentLabel(overview.most_used_intent)
                : "Aucune intention"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {overview.most_used_intent_count} occurrence(s)
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <BarChart3 size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Providers IA
              </h2>
              <p className="text-sm text-slate-500">
                Source utilisée pour générer les réponses.
              </p>
            </div>
          </div>

          {insights.provider_distribution.length === 0 ? (
            <p className="py-8 text-center text-slate-500">
              Aucun provider détecté.
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
                      <span className="text-sm font-semibold text-slate-700">
                        {item.total}
                      </span>
                    </div>

                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
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

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <h2 className="mb-4 text-lg font-bold text-slate-900">
            Dernières questions
          </h2>

          {insights.recent_questions.length === 0 ? (
            <p className="py-8 text-center text-slate-500">
              Aucune question récente.
            </p>
          ) : (
            <div className="space-y-3">
              {insights.recent_questions.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <p className="font-semibold text-slate-900">
                    {item.question}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {formatDate(item.created_at)}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.intent && (
                      <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
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
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          {icon}
        </div>
      </div>

      <p className="text-sm text-slate-500">{description}</p>
    </div>
  );
}