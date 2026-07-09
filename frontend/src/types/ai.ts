export type AiReportType =
  | "sales_report"
  | "stock_recommendation"
  | "customer_analysis"
  | "marketing_recommendation";

export type AiPeriod = "daily" | "weekly" | "monthly" | "yearly";

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