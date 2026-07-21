import type { AiUsedData } from "../types/ai";

export function getIntentLabel(intent?: string | null) {
  const labels: Record<string, string> = {
    stock_analysis: "Analyse de stock",
    sales_analysis: "Analyse des ventes",
    customer_analysis: "Analyse clients",
    product_analysis: "Analyse produits",
    marketing_advice: "Conseil marketing",
    general_analysis: "Analyse générale",
    stock_forecast: "Prévision de stock",
  };

  return labels[intent ?? ""] ?? "Analyse IA";
}

export function getProviderLabel(provider?: string | null) {
  const labels: Record<string, string> = {
    openai: "OpenAI",
    ollama: "Ollama local",
    none: "Réponse non générée",
    demo: "Réponse archivée",
    demo_fallback: "Réponse archivée",
    assistant_ai: "Assistant IA",
  };

  return labels[provider ?? ""] ?? "Assistant IA";
}

export function getProviderBadgeClass(provider?: string | null) {
  const baseClass = "rounded-full px-3 py-1 text-xs font-semibold";

  if (provider === "openai") {
    return `${baseClass} bg-indigo-50 text-indigo-700`;
  }

  if (provider === "ollama") {
    return `${baseClass} bg-violet-50 text-violet-700`;
  }

  if (
    provider === "none" ||
    provider === "demo" ||
    provider === "demo_fallback"
  ) {
    return `${baseClass} bg-slate-100 text-slate-600`;
  }

  return `${baseClass} bg-slate-50 text-slate-700`;
}

export function getUsedDataSummary(usedData: AiUsedData): string[] {
  const labels: string[] = [];

  if (usedData.has_stats) {
    labels.push("Données commerciales : disponibles");
  }

  if (usedData.top_products_count > 0) {
    labels.push(`Top produits analysés : ${usedData.top_products_count}`);
  }

  if (usedData.top_customers_count > 0) {
    labels.push(`Top clients analysés : ${usedData.top_customers_count}`);
  }

  if (usedData.low_stock_products_count > 0) {
    labels.push(
      `Produits en stock faible : ${usedData.low_stock_products_count}`
    );
  }

  if ((usedData.stock_forecast_products_count ?? 0) > 0) {
    labels.push(
      `Prévisions de stock : ${usedData.stock_forecast_products_count} produit(s)`
    );
  }

  if (usedData.stock_forecast_provider) {
    const engineLabels: Record<string, string> = {
      python_scikit_learn: "Service ML Python",
      laravel_baseline: "Prévision locale",
    };

    labels.push(
      `Moteur de prévision : ${engineLabels[usedData.stock_forecast_provider] ?? usedData.stock_forecast_provider}`
    );
  }

  if ((usedData.rag_chunks_count ?? 0) > 0) {
    labels.push("Base de connaissances : active");
    labels.push(`Passages internes consultés : ${usedData.rag_chunks_count}`);
  }

  if (
    Array.isArray(usedData.rag_sources) &&
    usedData.rag_sources.length > 0
  ) {
    labels.push(`Documents consultés : ${usedData.rag_sources.join(", ")}`);
  }

  if (labels.length === 0) {
    labels.push("Données utilisées : non précisées");
  }

  return labels;
}
 
