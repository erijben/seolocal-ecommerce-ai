import axiosClient from "./axiosClient";
import type {
  AiQuestion,
  AiReport,
  AskAiData,
  GenerateReportData,
} from "../types/ai";

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data: T;
};

export async function generateAiReport(data: GenerateReportData) {
  const response = await axiosClient.post<ApiResponse<AiReport>>(
    "/ai/generate-report",
    data
  );

  return response.data;
}

export async function askAi(data: AskAiData) {
  const response = await axiosClient.post<ApiResponse<AiQuestion>>(
    "/ai/ask",
    data
  );

  return response.data;
}

export async function getAiReports() {
  const response = await axiosClient.get<ApiResponse<AiReport[]>>(
    "/ai/reports"
  );

  return response.data.data;
}

export async function getAiQuestions() {
  const response = await axiosClient.get<ApiResponse<AiQuestion[]>>(
    "/ai/questions"
  );

  return response.data.data;
}