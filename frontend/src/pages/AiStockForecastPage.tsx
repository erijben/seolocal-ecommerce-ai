//cette page est comme un tableau de bord ML.
//utile quand l’admin veut voir les chiffres précis.

/*Elle sert à répondre à :

Quels sont les résultats du modèle ?
Quels produits sont critiques ?
Quelle quantité recommander ?
Quelle est la tendance ?
Quel est le score R² */

//La page Stock Forecast aide à surveiller

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Boxes,
  PackageCheck,
  RefreshCcw,
  TrendingUp,
} from "lucide-react";
import { getAiStockForecast } from "../api/aiApi";
import type {
  AiStockForecast,
  AiStockForecastProduct,
  StockRiskLevel,
} from "../types/ai";

export default function AiStockForecastPage() {
  const [forecast, setForecast] = useState<AiStockForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadForecast() {
    try {
      setLoading(true);
      setError("");

      const data = await getAiStockForecast();
      setForecast(data);
    } catch {
      setError("Impossible de charger les prévisions de stock.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadForecast();
  }, []);

  const criticalProducts = useMemo(() => {
    return forecast?.products.filter((item) => item.risk_level === "critical") ?? [];
  }, [forecast]);

  const topRiskProducts = useMemo(() => {
    return forecast?.products.slice(0, 5) ?? [];
  }, [forecast]);

  function formatDate(value: string) {
    return new Date(value).toLocaleDateString("fr-FR");
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-slate-500 dark:text-slate-400 shadow-sm">
        Chargement des prévisions de stock...
      </div>
    );
  }

  if (error || !forecast) {
    return (
      <div className="rounded-2xl border border-red-200 dark:border-red-900/70 bg-red-50 dark:bg-red-950/40 p-5 text-red-700 dark:text-red-300">
        {error || "Aucune donnée de prévision disponible."}
      </div>
    );
  }

  const summary = forecast.summary;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            Prévisions de stock IA
          </h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            Analyse prédictive du risque de rupture, de la demande future et des
            quantités recommandées.
          </p>
          <p className="mt-2 text-xs font-medium text-slate-400 dark:text-slate-500">
            Fenêtre d’analyse : {forecast.analysis_window_days} jours — du{" "}
            {formatDate(forecast.analysis_start_date)} au{" "}
            {formatDate(forecast.analysis_end_date)}
          </p>
        </div>

        <button
          type="button"
          onClick={loadForecast}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-800/70"
        >
          <RefreshCcw size={18} />
          Actualiser
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ForecastCard
          title="Produits analysés"
          value={summary.total_products_analyzed}
          description="Produits actifs inclus dans la prévision"
          icon={<Boxes size={22} />}
        />

        <ForecastCard
          title="Critiques"
          value={summary.critical_count}
          description="Stock inférieur ou égal au seuil"
          icon={<AlertTriangle size={22} />}
          variant="critical"
        />

        <ForecastCard
          title="Risque élevé"
          value={summary.high_count}
          description="Rupture possible à court terme"
          icon={<Activity size={22} />}
          variant="high"
        />

        <ForecastCard
          title="Stock stable"
          value={summary.low_count}
          description="Aucune action urgente"
          icon={<PackageCheck size={22} />}
          variant="low"
        />
      </div>


<details className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
  <summary className="cursor-pointer list-none font-semibold text-slate-700 dark:text-slate-200">
    Détails techniques de la prévision
    <span className="ml-2 text-xs font-normal text-slate-400 dark:text-slate-500">
      moteur, version et période
    </span>
  </summary>
  <div className="mt-5 flex flex-col justify-between gap-4 border-t border-slate-100 dark:border-slate-800 pt-5 lg:flex-row lg:items-center">
    <div>
      <h2 className="text-lg font-bold text-indigo-900 dark:text-indigo-100">
        Méthode de prévision
      </h2>
      <p className="mt-1 text-sm text-indigo-700 dark:text-indigo-300">
        Les prévisions sont générées à partir des ventes journalières traitées
        par le service de prévision de la plateforme.
      </p>
    </div>

    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl bg-white dark:bg-slate-900 px-4 py-3">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Moteur utilisé</p>
        <p className="mt-1 font-bold text-slate-900 dark:text-slate-100">
          {getForecastProviderLabel(forecast.provider)}
        </p>
      </div>

      <div className="rounded-xl bg-white dark:bg-slate-900 px-4 py-3">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Version du modèle</p>
        <p className="mt-1 font-bold text-slate-900 dark:text-slate-100">
          {forecast.model_version ??
            (forecast.provider === "laravel_baseline"
              ? "Prévision locale"
              : "Non renseignée")}
        </p>
      </div>

      <div className="rounded-xl bg-white dark:bg-slate-900 px-4 py-3">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Période de prévision</p>
        <p className="mt-1 font-bold text-slate-900 dark:text-slate-100">
          {forecast.forecast_horizon_days ?? 30} jours
        </p>
      </div>
    </div>
  </div>
</details>


      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm xl:col-span-2">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <TrendingUp size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Produits à risque prioritaire
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Classement basé sur le stock actuel, le seuil d’alerte et la
                vitesse de vente.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {topRiskProducts.map((product) => (
              <RiskProductCard key={product.product_id} product={product} />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <BarChart3 size={22} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Résumé décisionnel
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Lecture rapide des actions à mener.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <DecisionItem
              label="Produits à réapprovisionner"
              value={criticalProducts.length}
            />
            <DecisionItem
              label="Quantité totale recommandée"
              value={criticalProducts.reduce(
                (total, product) =>
                  total + product.recommended_restock_quantity,
                0
              )}
            />
            <DecisionItem
              label="Produit le plus urgent"
              value={criticalProducts[0]?.product_name ?? "Aucun"}
            />
          </div>

          <div className="mt-5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 p-4 text-sm leading-6 text-indigo-800 dark:text-indigo-200">
            {getForecastMethodDescription(forecast.provider)}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">
          Détail des prévisions par produit
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="py-3 pr-4 font-semibold">Produit</th>
                <th className="py-3 pr-4 font-semibold">Catégorie</th>
                <th className="py-3 pr-4 font-semibold">Stock</th>
                <th className="py-3 pr-4 font-semibold">Seuil</th>
                <th className="py-3 pr-4 font-semibold">Vendues</th>
                <th className="py-3 pr-4 font-semibold">Demande 30j</th>
                <th className="py-3 pr-4 font-semibold">Jours rupture</th>
                <th className="py-3 pr-4 font-semibold">Risque</th>
                <th className="py-3 pr-4 font-semibold">Réassort</th>
                <th className="py-3 font-semibold">Action</th>
              </tr>
            </thead>

            <tbody>
              {forecast.products.map((product) => (
                <tr
                  key={product.product_id}
                  className="border-b border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-200"
                >
                  <td className="py-4 pr-4 font-semibold text-slate-900 dark:text-slate-100">
                    {product.product_name}
                  </td>
                  <td className="py-4 pr-4">{product.category ?? "-"}</td>
                  <td className="py-4 pr-4">{product.current_stock}</td>
                  <td className="py-4 pr-4">
                    {product.stock_alert_threshold}
                  </td>
                  <td className="py-4 pr-4">{product.total_sold}</td>
                  <td className="py-4 pr-4">
                    {product.projected_demand_30_days}
                  </td>
                  <td className="py-4 pr-4">
                    {product.days_until_stockout === null
                      ? "N/A"
                      : `${product.days_until_stockout} j`}
                  </td>
                  <td className="py-4 pr-4">
                    <span className={getRiskBadgeClass(product.risk_level)}>
                      {getRiskLabel(product.risk_level)}
                    </span>
                  </td>
                  <td className="py-4 pr-4 font-semibold text-indigo-700 dark:text-indigo-300">
                    {product.recommended_restock_quantity}
                  </td>
                  <td className="py-4">{product.recommended_action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

type ForecastCardProps = {
  title: string;
  value: number;
  description: string;
  icon: ReactNode;
  variant?: StockRiskLevel;
};

function ForecastCard({
  title,
  value,
  description,
  icon,
  variant,
}: ForecastCardProps) {
  const styles =
    variant === "critical"
      ? {
          card: "border-red-200 dark:border-red-900/70 bg-red-50/50 dark:bg-red-950/25",
          icon: "bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300",
          value: "text-red-950 dark:text-red-100",
        }
      : variant === "high"
      ? {
          card: "border-orange-200 dark:border-orange-900/70 bg-orange-50/50 dark:bg-orange-950/25",
          icon: "bg-orange-100 dark:bg-orange-950/70 text-orange-700 dark:text-orange-300",
          value: "text-orange-950 dark:text-orange-100",
        }
      : variant === "medium"
      ? {
          card: "border-amber-200 dark:border-amber-900/70 bg-amber-50/50 dark:bg-amber-950/25",
          icon: "bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300",
          value: "text-amber-950 dark:text-amber-100",
        }
      : variant === "low"
      ? {
          card: "border-emerald-200 dark:border-emerald-900/70 bg-emerald-50/50 dark:bg-emerald-950/25",
          icon: "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300",
          value: "text-emerald-950 dark:text-emerald-100",
        }
      : {
          card: "border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/30",
          icon: "bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300",
          value: "text-indigo-950 dark:text-indigo-100",
        };

  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${styles.card}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
          <p className={`mt-2 text-3xl font-bold ${styles.value}`}>{value}</p>
        </div>

        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${styles.icon}`}
        >
          {icon}
        </div>
      </div>

      <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  );
}

function RiskProductCard({ product }: { product: AiStockForecastProduct }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-slate-900 dark:text-slate-100">
              {product.product_name}
            </h3>
            <span className={getRiskBadgeClass(product.risk_level)}>
              {getRiskLabel(product.risk_level)}
            </span>
          </div>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {product.category} — stock actuel : {product.current_stock}, seuil :{" "}
            {product.stock_alert_threshold}
          </p>
        </div>

        <div className="rounded-xl bg-white dark:bg-slate-900 px-4 py-3 text-sm font-semibold text-indigo-700 dark:text-indigo-300">
          Réassort recommandé : {product.recommended_restock_quantity}
        </div>
      </div>

     <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
  <MiniMetric label="Vendues" value={product.total_sold} />
  <MiniMetric
    label="Demande estimée 30j"
    value={product.projected_demand_30_days}
  />
  <MiniMetric
    label="Jours avant rupture"
    value={
      product.days_until_stockout === null
        ? "N/A"
        : `${product.days_until_stockout} j`
    }
  />
  <MiniMetric
    label="Modèle de prévision"
    value={getMlModelLabel(product.ml_model)}
  />
  <MiniMetric
    label="Confiance"
    value={getConfidenceLabel(product.ml_confidence)}
  />
  <MiniMetric
    label="Tendance"
    value={getTrendLabel(product.trend)}
  />
</div>

{product.r2_score !== undefined && product.r2_score !== null && (
  <div className="mt-3 rounded-xl bg-white dark:bg-slate-900 p-3 text-sm text-slate-600 dark:text-slate-300">
    Score de fiabilité du modèle :{" "}
    {product.mae !== undefined &&
  product.mae !== null &&
  product.rmse !== undefined &&
  product.rmse !== null && (
    <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3 dark:border-blue-900/60 dark:bg-blue-950/30">
      <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
        Validation temporelle
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <MiniMetric
          label="Erreur moyenne MAE"
          value={`${product.mae.toLocaleString("fr-FR")} unité(s)/jour`}
        />
        <MiniMetric
          label="Erreur RMSE"
          value={`${product.rmse.toLocaleString("fr-FR")} unité(s)/jour`}
        />

        <MiniMetric
          label="Période de validation"
          value={
            product.validation_days
              ? `${product.validation_days} jours`
              : "N/A"
          }
        />
      </div>

      <p className="mt-3 text-xs leading-5 text-blue-700 dark:text-blue-300">
        Ces erreurs sont mesurées sur les jours les plus récents, exclus de
        l’entraînement utilisé pour cette évaluation.
      </p>
    </div>
  )}
    <span className="font-semibold text-slate-900 dark:text-slate-100">
      {product.r2_score}
    </span>
    <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">
      Plus le score est proche de 1, plus le modèle explique bien les données
      historiques.
    </span>
  </div>
)}

      <p className="mt-4 rounded-xl bg-white dark:bg-slate-900 p-3 text-sm text-slate-600 dark:text-slate-300">
        {product.recommended_action}
      </p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-white dark:bg-slate-900 p-3">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 font-bold text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

function DecisionItem({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/60 p-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

function getRiskLabel(risk: StockRiskLevel) {
  const labels: Record<StockRiskLevel, string> = {
    critical: "Critique",
    high: "Élevé",
    medium: "Moyen",
    low: "Faible",
  };

  return labels[risk];
}

function getRiskBadgeClass(risk: StockRiskLevel) {
  const classes: Record<StockRiskLevel, string> = {
    critical:
      "rounded-full bg-red-50 dark:bg-red-950/40 px-3 py-1 text-xs font-semibold text-red-700 dark:text-red-300",
    high: "rounded-full bg-orange-50 dark:bg-orange-950/40 px-3 py-1 text-xs font-semibold text-orange-700 dark:text-orange-300",
    medium:
      "rounded-full bg-amber-50 dark:bg-amber-950/40 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300",
    low: "rounded-full bg-green-50 dark:bg-green-950/40 px-3 py-1 text-xs font-semibold text-green-700 dark:text-green-300",
  };

  return classes[risk];
}


function getMlModelLabel(model?: string) {
  const labels: Record<string, string> = {
    linear_regression: "Régression linéaire",
    moving_average_fallback: "Moyenne mobile",
  };

  return labels[model ?? ""] ?? "N/A";
}

function getForecastProviderLabel(provider?: string | null) {
  const labels: Record<string, string> = {
    python_scikit_learn: "Service ML Python",
    laravel_baseline: "Prévision locale",
  };

  return labels[provider ?? "laravel_baseline"] ?? "Prévision locale";
}

function getForecastMethodDescription(provider?: string | null) {
  if (provider === "python_scikit_learn") {
    return "Les prévisions sont générées par le service ML Python à partir des ventes historiques, du stock actuel et de la demande estimée.";
  }

  if (provider === "laravel_baseline") {
    return "Une prévision locale est utilisée temporairement lorsque le service de prévision n’est pas disponible.";
  }

  return "Les prévisions sont calculées à partir des données commerciales disponibles.";
}

function getConfidenceLabel(confidence?: string) {
  const labels: Record<string, string> = {
    high: "Élevée",
    medium: "Moyenne",
    low: "Faible",
  };

  return labels[confidence ?? ""] ?? "N/A";
}

function getTrendLabel(trend?: string) {
  const labels: Record<string, string> = {
    increasing: "Hausse",
    decreasing: "Baisse",
    stable: "Stable",
  };

  return labels[trend ?? ""] ?? "N/A";
}
