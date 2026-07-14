import { useEffect, useState } from "react";
import { Bot, MessageCircle, Send } from "lucide-react";
import { askAi, getAiQuestions } from "../api/aiApi";
import type { AiQuestion } from "../types/ai";
import { cleanAiResponse, isDemoAiResponse } from "../utils/aiResponse";
const suggestedQuestions = [
  "Quels produits dois-je réapprovisionner ?",
  "Quels sont mes meilleurs clients ?",
  "Quels produits se vendent le mieux ?",
  "Quelles actions marketing peux-tu me recommander ?",
  "Pourquoi les ventes ont-elles diminué sur certaines périodes ?",
];

export default function AiAssistantPage() {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<AiQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadHistory() {
    try {
      setHistoryLoading(true);
      const data = await getAiQuestions();
      setHistory(data);
    } catch {
      setError("Impossible de charger l’historique des questions IA.");
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (question.trim().length < 5) {
      setError("La question doit contenir au moins 5 caractères.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      await askAi({
        question,
      });

      setQuestion("");
      await loadHistory();
    } catch {
      setError("Impossible de générer une réponse IA.");
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
          <h1 className="text-3xl font-bold text-slate-900">Assistant IA</h1>
          <p className="mt-1 text-slate-500">
            Posez des questions sur les ventes, les stocks, les clients et les produits.
          </p>
        </div>

        <div className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm">
          {history.length} question(s)
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Bot size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Question à l’assistant
              </h2>
              <p className="text-sm text-slate-500">
                L’IA analyse les données préparées par Laravel.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="min-h-36 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-indigo-500"
              placeholder="Ex: Quels produits dois-je réapprovisionner ?"
            />

            <button
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:bg-indigo-300"
            >
              <Send size={18} />
              {loading ? "Analyse en cours..." : "Envoyer à l’IA"}
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900">
            Questions suggérées
          </h2>

          <div className="space-y-3">
            {suggestedQuestions.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setQuestion(item)}
                className="w-full rounded-xl bg-slate-50 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-slate-900">
          Historique des questions/réponses
        </h2>

        {historyLoading ? (
          <p className="py-8 text-center text-slate-500">
            Chargement de l’historique...
          </p>
        ) : history.length === 0 ? (
          <p className="py-8 text-center text-slate-500">
            Aucune question posée pour le moment.
          </p>
        ) : (
          <div className="space-y-4">
            {history.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="mb-3 flex items-start gap-3">
                  <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                    <MessageCircle size={18} />
                  </div>

                  <div>
                    <p className="font-semibold text-slate-900">
                      {item.question}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDate(item.created_at)}
                    </p>
                  </div>
                </div>

           {isDemoAiResponse(item.answer) && (
  <div className="mb-3 inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
    Mode démo intelligent
  </div>
)}

<div className="whitespace-pre-line rounded-xl bg-white p-4 text-sm leading-7 text-slate-700">
  {cleanAiResponse(item.answer)}
</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}