//L’assistant IA utilise les mêmes résultats que stockforecast, mais il les transforme en réponse en langage naturel. comme un conseiller intelligent.
/*Il sert à répondre à :

Explique-moi quoi faire.
Quels produits dois-je réapprovisionner ?
Quelle action est prioritaire ?
Quels produits risquent une rupture*/ 

import { useEffect, useState, type FormEvent } from "react";
import { Bot, MessageCircle, Send } from "lucide-react";
import { askAi, getAiQuestions } from "../api/aiApi";
import type { AiQuestion } from "../types/ai";
import { cleanAiResponse } from "../utils/aiResponse";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { addRequestReference } from "../api/requestId";
import {
  getIntentLabel,
  getProviderBadgeClass,
  getProviderLabel,
  getUsedDataSummary,
} from "../utils/aiMetadata";

const suggestedQuestions = [
  "Quels produits dois-je réapprovisionner ?",
  "Quels sont mes meilleurs clients ?",
  "Quels produits se vendent le mieux ?",
  "Quelles actions marketing peux-tu me recommander ?",
  "Pourquoi les ventes ont-elles diminué sur certaines périodes ?",
  "Quelle est notre politique de retour ?",
"Quand un produit doit-il être réapprovisionné ?",
"Quelles règles faut-il vérifier avant une promotion ?",
];

export default function AiAssistantPage() {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<AiQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      try {
        const data = await getAiQuestions();
        if (!cancelled) {
          setHistory(data);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(addRequestReference(
            "Impossible de charger l’historique des questions IA.",
            requestError,
          ));
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      }
    }

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, []);

async function handleSubmit(e: FormEvent) {
  e.preventDefault();

  const currentQuestion = question.trim();

  if (currentQuestion.length < 5) {
    setError("La question doit contenir au moins 5 caractères.");
    return;
  }

  try {
    setLoading(true);
    setError("");

    const response = await askAi({
      question: currentQuestion,
    });

    const createdQuestion = response.data;

    setHistory((previous) => [
      createdQuestion,
      ...previous.filter((item) => item.id !== createdQuestion.id),
    ]);

    setQuestion("");

    try {
      const freshHistory = await getAiQuestions();
      setHistory(freshHistory);
    } catch {
      console.warn("Historique non rechargé après la réponse IA.");
    }
  } catch (requestError) {
    setError(addRequestReference(
      "Impossible de générer une réponse IA.",
      requestError,
    ));
  } finally {
    setLoading(false);
  }
}


  function formatDate(value: string) {
    return new Date(value).toLocaleString("fr-FR");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Assistant IA</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            Posez des questions sur les ventes, les stocks, les clients et les
            produits.
          </p>
        </div>

        <div className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm">
          {history.length} question(s)
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 dark:border-red-900/70 bg-red-50 dark:bg-red-950/40 p-4 text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm xl:col-span-2">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Bot size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Question à l’assistant
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                L’assistant IA analyse les données commerciales de la plateforme.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
         <textarea
  value={question}
  onChange={(e) => setQuestion(e.target.value)}
  disabled={loading || historyLoading}
  className="min-h-36 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-indigo-500 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-400 dark:disabled:bg-slate-800"
  placeholder="Ex: Quels produits dois-je réapprovisionner ?"
/>

         <button
  disabled={loading || historyLoading}
  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:bg-indigo-300 dark:disabled:bg-indigo-900/50 dark:disabled:text-indigo-300"
>
  <Send size={18} />
  {loading ? "Analyse en cours..." : "Envoyer à l’assistant IA"}
</button>
          </form>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">
            Questions suggérées
          </h2>

          <div className="space-y-3">
            {suggestedQuestions.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setQuestion(item)}
                className="w-full rounded-xl bg-slate-50 dark:bg-slate-950/60 px-4 py-3 text-left text-sm font-medium text-slate-700 dark:text-slate-200 transition hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-300"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">
          Historique des questions/réponses
        </h2>

        {historyLoading ? (
          <p className="py-8 text-center text-slate-500 dark:text-slate-400">
            Chargement de l’historique...
          </p>
        ) : history.length === 0 ? (
          <p className="py-8 text-center text-slate-500 dark:text-slate-400">
            Aucune question posée pour le moment.
          </p>
        ) : (
          <div className="space-y-4">
            {history.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4"
              >
                <div className="mb-3 flex items-start gap-3">
                  <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400">
                    <MessageCircle size={18} />
                  </div>

                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {item.question}
                    </p>

                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDate(item.created_at)}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2">
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
                </div>

                {item.used_data && (
                  <details className="mb-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                    <summary className="cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Données utilisées par l’assistant
                    </summary>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {getUsedDataSummary(item.used_data).map((label) => (
                        <div
                          key={label}
                          className="rounded-lg bg-slate-50 dark:bg-slate-950/60 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300"
                        >
                          {label}
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                <div className="ai-markdown overflow-x-auto rounded-2xl bg-white p-4 text-sm leading-7 dark:bg-slate-900">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {cleanAiResponse(item.answer ?? "")}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
