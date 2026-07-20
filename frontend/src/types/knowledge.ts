export type KnowledgeDocumentType = string;

export type KnowledgeDocumentStatus = "active" | "inactive";

export type KnowledgeExtractionStatus = "pending" | "success" | "failed";

export type KnowledgeChunk = {
  id: number;
  knowledge_document_id: number;
  chunk_index: number;
  content: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type KnowledgeDocument = {
  id: number;
  title: string;
  type: KnowledgeDocumentType;
  content?: string;
  status: KnowledgeDocumentStatus;
  created_by?: number | null;

  original_filename?: string | null;
  file_path?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
  extraction_status?: KnowledgeExtractionStatus | null;
  extraction_error?: string | null;

  chunks_count?: number;
  chunks?: KnowledgeChunk[];

  created_at: string;
  updated_at: string;
};

export type KnowledgeSearchResult = {
  chunk_id: number;
  document_id: number;
  document_title: string;
  document_type: KnowledgeDocumentType;
  chunk_index: number;
  content: string;
  score: number;
};