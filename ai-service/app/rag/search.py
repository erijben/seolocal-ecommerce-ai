#le service de recherche sémantique dans les documents de connaissance (RAG) :
#reçoit une requête textuelle d’un client ;


from dataclasses import dataclass
import logging
from typing import Literal
from uuid import UUID

from sqlalchemy import and_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.embeddings.base import EmbeddingProvider
from app.embeddings.factory import get_embedding_provider
from app.models.knowledge_chunk import KnowledgeChunk
from app.models.knowledge_document import KnowledgeDocument


logger = logging.getLogger(__name__)

SearchStatus = Literal["ok", "empty", "error"]


@dataclass(frozen=True)
class SemanticSearchHit:
    chunk_id: UUID
    document_id: UUID
    document_title: str
    chunk_index: int
    page_number: int | None
    content: str
    distance: float
    score: float


@dataclass(frozen=True)
class SemanticSearchResult:
    status: SearchStatus
    hits: list[SemanticSearchHit]
    provider: str | None
    model: str | None
    error_code: str | None = None


class SemanticSearchService:
    def __init__(
        self,
        settings: Settings | None = None,
        embedding_provider: EmbeddingProvider | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.embedding_provider = (
            embedding_provider or get_embedding_provider()
        )

    async def search(
        self,
        session: AsyncSession,
        tenant_id: UUID,  #appliqué aux passages et aux documents
        query: str,
        top_k: int | None = None,
        min_score: float | None = None,
        request_id: str | None = None,
    ) -> SemanticSearchResult:
        normalized_query = query.strip()

        if not normalized_query:
            return SemanticSearchResult(
                status="error",
                hits=[],
                provider=None,
                model=None,
                error_code="empty_query",
            )

        result_limit = max(
            1,
            min(
                top_k or self.settings.rag_top_k,  #top_k est limité à 20 pour éviter une récupération excessive
                20,
            ),
        )

        effective_min_score = (
    self.settings.rag_min_score
    if min_score is None
    else min_score
)

        normalized_min_score = max(
    0.0,
    min(float(effective_min_score), 1.0),
)

        embedding_result = await self.embedding_provider.embed(
            [normalized_query],
            purpose="query",
            request_id=request_id,
        )

        if (
            embedding_result.status != "ok"
            or not embedding_result.embeddings
        ):
            logger.warning(
                "Semantic query embedding failed",
                extra={
                    "request_id": request_id,
                    "tenant_id": str(tenant_id),
                    "provider": embedding_result.provider,
                    "model": embedding_result.model,
                    "error_code": embedding_result.error_code,
                },
            )

            return SemanticSearchResult(
                status="error",
                hits=[],
                provider=embedding_result.provider,
                model=embedding_result.model,
                error_code=(
                    embedding_result.error_code
                    or "query_embedding_failed"
                ),
            )

        query_vector = embedding_result.embeddings[0]

        distance_expression = (
            KnowledgeChunk.embedding.cosine_distance(query_vector)
        )

        statement = (
            select(
                KnowledgeChunk.id.label("chunk_id"),
                KnowledgeChunk.document_id.label("document_id"),
                KnowledgeDocument.title.label("document_title"),
                KnowledgeChunk.chunk_index.label("chunk_index"),
                KnowledgeChunk.page_number.label("page_number"),
                KnowledgeChunk.content.label("content"),
                distance_expression.label("distance"),
            )
            .join(
                KnowledgeDocument,
                and_(
                    KnowledgeDocument.id
                    == KnowledgeChunk.document_id,
                    KnowledgeDocument.tenant_id
                    == KnowledgeChunk.tenant_id,
                ),
            )
            .where(
                KnowledgeChunk.tenant_id == tenant_id,
                KnowledgeDocument.tenant_id == tenant_id,
                KnowledgeDocument.status == "ready",   #seuls les documents ready participent à la recherche
            )
            .order_by(distance_expression)
            .limit(result_limit)
        )

        await session.execute(
            text(
                "SET LOCAL hnsw.iterative_scan = 'relaxed_order'"   #améliore les recherches filtrées par tenant avec pgvector 0.8.5.
            )
        )

        rows = (
            await session.execute(statement)
        ).all()

        hits: list[SemanticSearchHit] = []

        for row in rows:
            distance = float(row.distance)
            score = max(
                0.0,
                min(1.0, 1.0 - distance),
            )

            if score < normalized_min_score:
                continue

            hits.append(
                SemanticSearchHit(
                    chunk_id=row.chunk_id,
                    document_id=row.document_id,
                    document_title=row.document_title,
                    chunk_index=row.chunk_index,
                    page_number=row.page_number,
                    content=row.content,
                    distance=round(distance, 6),
                    score=round(score, 6),
                )
            )

        status: SearchStatus = "ok" if hits else "empty"  #le service retourne empty si aucun passage ne respecte le seuil

        logger.info(
            "Semantic knowledge search finished",
            extra={
                "request_id": request_id,
                "tenant_id": str(tenant_id),
                "provider": embedding_result.provider,
                "model": embedding_result.model,
                "hits_count": len(hits),
            },
        )

        return SemanticSearchResult(
            status=status,
            hits=hits,
            provider=embedding_result.provider,
            model=embedding_result.model,
            error_code=None,
        )