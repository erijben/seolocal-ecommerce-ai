from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field
from datetime import datetime

class KnowledgeSearchRequest(BaseModel):
    query: str = Field(
        min_length=2,
        max_length=2000,
    )
    top_k: int | None = Field(
        default=None,
        ge=1,
        le=20,
    )
    min_score: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
    )


class KnowledgeSearchHitResponse(BaseModel):
    chunk_id: UUID
    document_id: UUID
    document_title: str
    chunk_index: int
    page_number: int | None
    content: str
    score: float
    distance: float


class KnowledgeSearchResponse(BaseModel):
    status: Literal["ok", "empty", "error"]
    hits: list[KnowledgeSearchHitResponse]
    provider: str | None
    model: str | None
    error_code: str | None = None

class KnowledgeDocumentIndexResponse(BaseModel): #retourne seulement le résultat opérationnel de l’indexation.
    document_id: UUID
    status: Literal["ready"]
    chunks_count: int
    pages_count: int
    provider: str
    model: str

class RagQuestionRequest(BaseModel):
    question: str = Field(
        min_length=2,
        max_length=4000,
    )
    top_k: int | None = Field(
        default=None,
        ge=1,
        le=10,
    )
    min_score: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
    )


class RagCitationResponse(BaseModel):
    source_number: int
    document_id: UUID
    document_title: str
    page_number: int | None
    chunk_index: int
    score: float


class RagAnswerResponse(BaseModel):
    status: Literal["ok", "empty", "error"]
    answer: str | None
    citations: list[RagCitationResponse]
    retrieval_provider: str | None
    retrieval_model: str | None
    llm_provider: str | None
    llm_model: str | None
    error_code: str | None = None

class KnowledgeDocumentSummaryResponse(BaseModel):
    document_id: UUID
    external_id: str | None
    title: str
    original_filename: str
    checksum_sha256: str
    status: str
    chunks_count: int
    embedding_model: str | None
    embedding_dimensions: int | None
    error_message: str | None
    indexed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class KnowledgeDocumentListResponse(BaseModel):
    documents: list[KnowledgeDocumentSummaryResponse]
    total: int


class KnowledgeDocumentDeleteResponse(BaseModel):
    document_id: UUID
    status: Literal["deleted"]