#service d’indexation PDF

from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.embeddings.base import EmbeddingProvider
from app.embeddings.factory import get_embedding_provider
from app.models.knowledge_chunk import KnowledgeChunk
from app.models.knowledge_document import KnowledgeDocument
from app.rag.chunking import TextChunker
from app.rag.pdf_extractor import (
    ExtractedPage,
    PdfExtractionError,
    PdfExtractor,
)


@dataclass(frozen=True)
class PreparedChunk:
    index: int
    content: str
    content_hash: str
    char_count: int
    page_number: int


@dataclass(frozen=True)
class IndexingResult:
    document_id: UUID
    status: str
    chunks_count: int
    pages_count: int
    provider: str
    model: str


class KnowledgeIndexingError(Exception):
    def __init__(
        self,
        error_code: str,
        document_id: UUID | None = None,
    ) -> None:
        self.error_code = error_code
        self.document_id = document_id
        super().__init__(error_code)


class KnowledgeIndexingService:
    def __init__(
        self,
        settings: Settings | None = None,
        embedding_provider: EmbeddingProvider | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.embedding_provider = (
            embedding_provider
            or get_embedding_provider()
        )
        self.pdf_extractor = PdfExtractor(
            settings=self.settings
        )
        self.chunker = TextChunker(
            settings=self.settings
        )

    async def index_pdf(
        self,
        session: AsyncSession,
        tenant_id: UUID,
        title: str,
        original_filename: str,
        pdf_bytes: bytes,
        external_id: str | None = None,
        metadata: dict[str, object] | None = None,
        request_id: str | None = None,
    ) -> IndexingResult:
        normalized_title = title.strip()

        if not normalized_title:
            raise KnowledgeIndexingError(
                "invalid_title"
            )

        try:
            extracted_pdf = self.pdf_extractor.extract(
                pdf_bytes
            )
        except PdfExtractionError as exception:
            raise KnowledgeIndexingError(
                exception.error_code
            ) from exception

        existing_external_id = None

        if external_id is not None:
            existing_external_id = await session.scalar(
                select(KnowledgeDocument).where(
                    KnowledgeDocument.tenant_id
                    == tenant_id,
                    KnowledgeDocument.external_id
                    == external_id,
                )
            )

        existing_checksum = await session.scalar(
            select(KnowledgeDocument).where(
                KnowledgeDocument.tenant_id == tenant_id,
                KnowledgeDocument.checksum_sha256
                == extracted_pdf.checksum_sha256,
            )
        )

        if (
            existing_external_id is not None
            and existing_checksum is not None
            and existing_external_id.id
            != existing_checksum.id
        ):
            raise KnowledgeIndexingError(
                "document_conflict",
                document_id=existing_external_id.id,
            )

        if existing_external_id is not None:
            if (
                existing_external_id.checksum_sha256
                != extracted_pdf.checksum_sha256
            ):
                raise KnowledgeIndexingError(
                    "duplicate_external_id",
                    document_id=existing_external_id.id,
                )

            if existing_external_id.status == "ready":
                return IndexingResult(
                    document_id=existing_external_id.id,
                    status=existing_external_id.status,
                    chunks_count=(
                        existing_external_id.chunks_count
                    ),
                    pages_count=extracted_pdf.pages_count,
                    provider=self.embedding_provider.name,
                    model=(
                        existing_external_id.embedding_model
                        or self.settings.embedding_model
                    ),
                )

            if existing_external_id.status != "failed":
                raise KnowledgeIndexingError(
                    "document_conflict",
                    document_id=existing_external_id.id,
                )

        elif existing_checksum is not None:
            raise KnowledgeIndexingError(
                "duplicate_document",
                document_id=existing_checksum.id,
            )
        prepared_chunks = self._prepare_chunks(
            extracted_pdf.pages
        )

        if not prepared_chunks:
            raise KnowledgeIndexingError(
                "no_chunks_generated"
            )

        ingestion_metadata = {
            **(metadata or {}),
            "ingestion": {
                "pages_count": extracted_pdf.pages_count,
                "extracted_pages_count": (
                    extracted_pdf.extracted_pages_count
                ),
                "extracted_char_count": (
                    extracted_pdf.char_count
                ),
            },
        }

        if existing_external_id is not None:
            document = existing_external_id
            document.title = normalized_title
            document.original_filename = original_filename
            document.mime_type = "application/pdf"
            document.status = "processing"
            document.chunks_count = 0
            document.embedding_model = None
            document.embedding_dimensions = None
            document.metadata_json = ingestion_metadata
            document.error_message = None
            document.indexed_at = None

            await session.execute(
                delete(KnowledgeChunk).where(
                    KnowledgeChunk.document_id
                    == document.id,
                    KnowledgeChunk.tenant_id
                    == tenant_id,
                )
            )
        else:
            document = KnowledgeDocument(
                tenant_id=tenant_id,
                external_id=external_id,
                title=normalized_title,
                original_filename=original_filename,
                source_type="pdf",
                mime_type="application/pdf",
                checksum_sha256=(
                    extracted_pdf.checksum_sha256
                ),
                status="processing",
                metadata_json=ingestion_metadata,
            )

            session.add(document)

        try:
            await session.flush()

            vectors: list[list[float]] = []
            embedding_model = ""

            for batch_start in range(
                0,
                len(prepared_chunks),
                self.settings.embedding_batch_size,
            ):
                batch = prepared_chunks[
                    batch_start:
                    batch_start
                    + self.settings.embedding_batch_size
                ]

                embedding_result = (
                    await self.embedding_provider.embed(
                        [
                            chunk.content
                            for chunk in batch
                        ],
                        purpose="document",
                        request_id=request_id,
                    )
                )

                if embedding_result.status != "ok":
                    provider_error = (
                        embedding_result.error_code
                        or "unknown"
                    )
                    document.status = "failed"
                    document.error_message = (
                        f"embedding:{provider_error}"
                    )
                    await session.commit()

                    raise KnowledgeIndexingError(
                        f"embedding_{provider_error}",
                        document_id=document.id,
                    )

                vectors.extend(
                    embedding_result.embeddings
                )
                embedding_model = (
                    embedding_result.model
                )

            if len(vectors) != len(prepared_chunks):
                document.status = "failed"
                document.error_message = (
                    "embedding:count_mismatch"
                )
                await session.commit()

                raise KnowledgeIndexingError(
                    "embedding_count_mismatch",
                    document_id=document.id,
                )

            for chunk, vector in zip(
                prepared_chunks,
                vectors,
                strict=True,
            ):
                session.add(
                    KnowledgeChunk(
                        document_id=document.id,
                        tenant_id=tenant_id,
                        chunk_index=chunk.index,
                        content=chunk.content,
                        content_hash=chunk.content_hash,
                        char_count=chunk.char_count,
                        token_count=None,
                        page_number=chunk.page_number,
                        embedding_model=embedding_model,
                        embedding=vector,
                        metadata_json={},
                    )
                )

            document.status = "ready"
            document.chunks_count = len(
                prepared_chunks
            )
            document.embedding_model = embedding_model
            document.embedding_dimensions = (
                self.settings.embedding_dimensions
            )
            document.error_message = None
            document.indexed_at = datetime.now(
                timezone.utc
            )

            await session.commit()

            return IndexingResult(
                document_id=document.id,
                status=document.status,
                chunks_count=document.chunks_count,
                pages_count=extracted_pdf.pages_count,
                provider=self.embedding_provider.name,
                model=embedding_model,
            )

        except KnowledgeIndexingError:
            raise

        except IntegrityError as exception:
            await session.rollback()
            raise KnowledgeIndexingError(
                "document_conflict"
            ) from exception

        except Exception:
            await session.rollback()
            raise

    def _prepare_chunks(
        self,
        pages: tuple[ExtractedPage, ...],
    ) -> list[PreparedChunk]:
        prepared_chunks: list[PreparedChunk] = []
        global_index = 0

        for page in pages:
            page_chunks = self.chunker.split(
                page.text
            )

            for chunk in page_chunks:
                prepared_chunks.append(
                    PreparedChunk(
                        index=global_index,
                        content=chunk.content,
                        content_hash=(
                            chunk.content_hash
                        ),
                        char_count=chunk.char_count,
                        page_number=page.page_number,
                    )
                )
                global_index += 1

        return prepared_chunks