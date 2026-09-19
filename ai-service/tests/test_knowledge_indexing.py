import unittest
from uuid import UUID, uuid4

from app.core.config import Settings
from app.models.knowledge_document import KnowledgeDocument
from app.rag.indexing import (
    KnowledgeIndexingError,
    KnowledgeIndexingService,
)
from app.rag.pdf_extractor import ExtractedPage, ExtractedPdf
from app.schemas.embeddings import EmbeddingResult


CHECKSUM = "a" * 64
OTHER_CHECKSUM = "b" * 64
TENANT_ID = UUID("123e4567-e89b-12d3-a456-426614174001")


class FakePdfExtractor:
    def __init__(self, checksum: str = CHECKSUM) -> None:
        text = (
            "Politique documentaire et conditions de retour. "
            * 20
        )
        self.result = ExtractedPdf(
            checksum_sha256=checksum,
            pages_count=1,
            extracted_pages_count=1,
            char_count=len(text),
            pages=(
                ExtractedPage(
                    page_number=1,
                    text=text,
                    char_count=len(text),
                ),
            ),
        )

    def extract(self, pdf_bytes: bytes) -> ExtractedPdf:
        return self.result


class FakeEmbeddingProvider:
    name = "fake_embedding"

    def __init__(self) -> None:
        self.calls = 0

    async def embed(
        self,
        texts: list[str],
        *,
        purpose: str,
        request_id: str | None = None,
    ) -> EmbeddingResult:
        self.calls += 1

        return EmbeddingResult(
            status="ok",
            provider=self.name,
            model="embeddinggemma",
            dimensions=768,
            embeddings=[
                [0.1] * 768
                for _ in texts
            ],
        )


class FakeSession:
    def __init__(self, scalar_results: list[object]) -> None:
        self.scalar_results = scalar_results
        self.added: list[object] = []
        self.execute_calls = 0
        self.commit_calls = 0
        self.rollback_calls = 0

    async def scalar(self, statement: object) -> object:
        return self.scalar_results.pop(0)

    def add(self, value: object) -> None:
        self.added.append(value)

    async def flush(self) -> None:
        for value in self.added:
            if (
                isinstance(value, KnowledgeDocument)
                and value.id is None
            ):
                value.id = uuid4()

    async def execute(self, statement: object) -> None:
        self.execute_calls += 1

    async def commit(self) -> None:
        self.commit_calls += 1

    async def rollback(self) -> None:
        self.rollback_calls += 1


class KnowledgeIndexingServiceTest(
    unittest.IsolatedAsyncioTestCase
):
    def service(
        self,
        provider: FakeEmbeddingProvider,
        checksum: str = CHECKSUM,
    ) -> KnowledgeIndexingService:
        settings = Settings(
            _env_file=None,
            embedding_batch_size=16,
            embedding_dimensions=768,
        )
        service = KnowledgeIndexingService(
            settings=settings,
            embedding_provider=provider,
        )
        service.pdf_extractor = FakePdfExtractor(checksum)

        return service

    async def test_initial_indexing_creates_document_and_chunks(
        self,
    ) -> None:
        provider = FakeEmbeddingProvider()
        session = FakeSession([None, None])

        result = await self.service(provider).index_pdf(
            session=session,
            tenant_id=TENANT_ID,
            title="Document initial",
            original_filename="initial.pdf",
            pdf_bytes=b"ignored",
            external_id="laravel-knowledge-document-1",
        )

        self.assertEqual("ready", result.status)
        self.assertEqual(1, provider.calls)
        self.assertEqual(1, session.commit_calls)
        self.assertGreaterEqual(len(session.added), 2)
        document = session.added[0]
        self.assertIsInstance(document, KnowledgeDocument)
        self.assertEqual("ready", document.status)

    async def test_ready_document_is_idempotent(
        self,
    ) -> None:
        provider = FakeEmbeddingProvider()
        existing = self.document(status="ready")
        session = FakeSession([existing, existing])

        result = await self.service(provider).index_pdf(
            session=session,
            tenant_id=TENANT_ID,
            title="Document existant",
            original_filename="existing.pdf",
            pdf_bytes=b"ignored",
            external_id=existing.external_id,
        )

        self.assertEqual(existing.id, result.document_id)
        self.assertEqual("ready", result.status)
        self.assertEqual(0, provider.calls)
        self.assertEqual([], session.added)
        self.assertEqual(0, session.execute_calls)
        self.assertEqual(0, session.commit_calls)

    async def test_failed_document_is_reused_on_retry(
        self,
    ) -> None:
        provider = FakeEmbeddingProvider()
        existing = self.document(status="failed")
        existing.error_message = "embedding:provider_timeout"
        session = FakeSession([existing, existing])

        result = await self.service(provider).index_pdf(
            session=session,
            tenant_id=TENANT_ID,
            title="Document relance",
            original_filename="retry.pdf",
            pdf_bytes=b"ignored",
            external_id=existing.external_id,
        )

        self.assertEqual(existing.id, result.document_id)
        self.assertEqual("ready", existing.status)
        self.assertIsNone(existing.error_message)
        self.assertEqual(1, session.execute_calls)
        self.assertEqual(1, provider.calls)
        self.assertEqual(1, session.commit_calls)
        self.assertFalse(
            any(
                isinstance(item, KnowledgeDocument)
                for item in session.added
            )
        )

    async def test_same_checksum_with_other_external_id_is_rejected(
        self,
    ) -> None:
        provider = FakeEmbeddingProvider()
        other = self.document(
            status="ready",
            external_id="laravel-knowledge-document-99",
        )
        session = FakeSession([None, other])

        with self.assertRaises(
            KnowledgeIndexingError
        ) as context:
            await self.service(provider).index_pdf(
                session=session,
                tenant_id=TENANT_ID,
                title="Duplicated content",
                original_filename="duplicate.pdf",
                pdf_bytes=b"ignored",
                external_id="laravel-knowledge-document-2",
            )

        self.assertEqual(
            "duplicate_document",
            context.exception.error_code,
        )
        self.assertEqual(0, provider.calls)

    async def test_same_external_id_with_changed_content_is_rejected(
        self,
    ) -> None:
        provider = FakeEmbeddingProvider()
        existing = self.document(status="ready")
        session = FakeSession([existing, None])

        with self.assertRaises(
            KnowledgeIndexingError
        ) as context:
            await self.service(
                provider,
                checksum=OTHER_CHECKSUM,
            ).index_pdf(
                session=session,
                tenant_id=TENANT_ID,
                title="Changed content",
                original_filename="changed.pdf",
                pdf_bytes=b"ignored",
                external_id=existing.external_id,
            )

        self.assertEqual(
            "duplicate_external_id",
            context.exception.error_code,
        )
        self.assertEqual(0, provider.calls)

    def document(
        self,
        *,
        status: str,
        external_id: str = "laravel-knowledge-document-1",
    ) -> KnowledgeDocument:
        return KnowledgeDocument(
            id=uuid4(),
            tenant_id=TENANT_ID,
            external_id=external_id,
            title="Existing document",
            original_filename="existing.pdf",
            source_type="pdf",
            mime_type="application/pdf",
            checksum_sha256=CHECKSUM,
            status=status,
            chunks_count=2 if status == "ready" else 0,
            embedding_model=(
                "embeddinggemma"
                if status == "ready"
                else None
            ),
            embedding_dimensions=(
                768
                if status == "ready"
                else None
            ),
            metadata_json={},
        )


if __name__ == "__main__":
    unittest.main()