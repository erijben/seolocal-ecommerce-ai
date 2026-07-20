export type AiReportType =
  | "sales_report"
  | "stock_recommendation"
  | "customer_analysis"
  | "marketing_recommendation";

export type AiPeriod = "daily" | "weekly" | "monthly" | "yearly";

export type AiIntent =
  | "stock_analysis"
  | "sales_analysis"
  | "customer_analysis"
  | "product_analysis"
  | "marketing_advice"
  | "general_analysis";

export type AiProvider =
  | "openai"
  | "ollama"
  | "none"
  | "assistant_ai"
  | "demo"
  | "demo_fallback";
export type AiUsedData = {
  tools_used?: string[];
  router_provider?: string | null;
  router_confidence?: number | null;
  has_stats: boolean;
  sales_periods_count: number;
  top_products_count: number;
  top_customers_count: number;
  orders_status_count: number;
  low_stock_products_count: number;
  stock_forecast_products_count?: number;
stock_forecast_provider?: string | null;
rag_chunks_count?: number;
rag_sources?: string[];
};

export type AiReport = {
  id: number;
  user_id: number;
  title: string;
  type: AiReportType;
  content: string;
  generated_at: string;
  created_at?: string;
};

export type AiQuestion = {
  id: number;
  user_id: number;
  question: string;
  intent?: AiIntent | string | null;
  provider?: AiProvider | string | null;
  used_data?: AiUsedData | null;
  answer: string;
  created_at: string;
};

export type GenerateReportData = {
  type: AiReportType;
  period: AiPeriod;
};

export type AskAiData = {
  question: string;
};

export type AiAgentOverview = {
  total_questions: number;
  openai_count: number;
  demo_count: number;
  fallback_count: number;
  most_used_intent: string | null;
  most_used_intent_count: number;
  last_question_at: string | null;
};

export type AiIntentDistributionItem = {
  intent: string;
  total: number;
};

export type AiProviderDistributionItem = {
  provider: string;
  total: number;
};

export type AiRecentQuestion = {
  id: number;
  question: string;
  intent: string | null;
  provider: string | null;
  created_at: string;
};

export type AiAgentInsights = {
  overview: AiAgentOverview;
  intent_distribution: AiIntentDistributionItem[];
  provider_distribution: AiProviderDistributionItem[];
  recent_questions: AiRecentQuestion[];
};



export type StockRiskLevel = "critical" | "high" | "medium" | "low";

export type MlModel = "linear_regression" | "moving_average_fallback";

export type MlConfidence = "high" | "medium" | "low";

export type TrendDirection = "increasing" | "decreasing" | "stable";

export type AiStockForecastSummary = {
  total_products_analyzed: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
};

export type AiStockForecastProduct = {
  product_id: number;
  product_name: string;
  category: string | null;
  price: number;
  current_stock: number;
  stock_alert_threshold: number;
  total_sold: number;
  total_revenue: number;
  daily_sales_velocity: number;
  weekly_demand_estimate: number;
  projected_demand_30_days: number;
  days_until_stockout: number | null;
  risk_level: StockRiskLevel;
  recommended_restock_quantity: number;
  recommended_action: string;

  ml_model?: MlModel | string;
  ml_confidence?: MlConfidence | string;
  trend?: TrendDirection | string;
  r2_score?: number | null;
};

export type AiStockForecast = {
  provider?: string;
  model_version?: string;
  analysis_window_days: number;
  forecast_horizon_days?: number;
  analysis_start_date: string;
  analysis_end_date: string;
  summary: AiStockForecastSummary;
  products: AiStockForecastProduct[];
};
