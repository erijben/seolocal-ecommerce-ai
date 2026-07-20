import axios from "axios";
import api from "./axiosClient";
import type {
  KnowledgeDocument,
  KnowledgeDocumentStatus,
  KnowledgeDocumentType,
  KnowledgeSearchResult,
} from "../types/knowledge";

type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data: T;
};

export type UploadKnowledgePdfData = {
  file: File;
  title?: string;
  type?: KnowledgeDocumentType;
  status?: KnowledgeDocumentStatus;
};

export async function getKnowledgeDocuments() {
  const response = await api.get<ApiResponse<KnowledgeDocument[]>>(
    "/knowledge-documents"
  );

  return response.data.data;
}

export async function uploadKnowledgePdf(data: UploadKnowledgePdfData) {
  const formData = new FormData();

  formData.append("file", data.file);
  if (data.type?.trim()) {
    formData.append("type", data.type.trim());
  }
  formData.append("status", data.status ?? "active");

  if (data.title?.trim()) {
    formData.append("title", data.title.trim());
  }

  const response = await api.post<ApiResponse<KnowledgeDocument>>(
    "/knowledge-documents/upload-pdf",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  return response.data.data;
}

export async function deleteKnowledgeDocument(id: number) {
  await api.delete(`/knowledge-documents/${id}`);
}

export async function searchKnowledge(query: string, limit = 5) {
  const response = await api.post<ApiResponse<KnowledgeSearchResult[]>>(
    "/knowledge-search",
    {
      query,
      limit,
    }
  );

  return response.data.data;
}

export function getApiErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | {
          message?: string;
          errors?: Record<string, string[]>;
        }
      | undefined;

    if (data?.errors) {
      return Object.values(data.errors).flat().join(" ");
    }

    return data?.message ?? "Une erreur est survenue.";
  }

  return "Une erreur est survenue.";
}