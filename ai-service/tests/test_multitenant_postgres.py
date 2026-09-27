import os
from datetime import datetime, timedelta, timezone
import hashlib
import unittest
from uuid import UUID, uuid4

import httpx
from sqlalchemy import delete, func, select

from app.core.config import Settings
from app.core.database import (
    get_engine,
    get_session_factory,
)
from app.main import app
from app.models.api_key import ApiKey
from app.models.knowledge_chunk import KnowledgeChunk
from app.models.knowledge_document import KnowledgeDocument
from app.models.tenant import Tenant
from app.rag.search import SemanticSearchService
from app.schemas.embeddings import EmbeddingResult
from app.security.api_keys import hash_api_key


POSTGRES_TESTS_ENABLED = (
    os.getenv("SMARTCOMMERCE_TEST_POSTGRES") == "1"
)

TENANT_A_ID = UUID("a1450000-0000-4000-8000-000000000001")
TENANT_B_ID = UUID("b1450000-0000-4000-8000-000000000002")
TENANT_SUSPENDED_ID = UUID(
    "c1450000-0000-4000-8000-000000000003"
)
DOCUMENT_A_ID = UUID("a1450000-1111-4111-8111-000000000001")
DOCUMENT_B_ID = UUID("b1450000-2222-4222-8222-000000000002")
UNKNOWN_DOCUMENT_ID = UUID(
    "d1450000-3333-4333-8333-000000000003"
)

KEY_A = "scai_p145_tenant_a_valid_key_000000000000001"
KEY_B = "scai_p145_tenant_b_valid_key_000000000000002"
KEY_INACTIVE = "scai_p145_inactive_key_00000000000000003"
KEY_REVOKED = "scai_p145_revoked_key_000000000000000004"
KEY_EXPIRED = "scai_p145_expired_key_000000000000000005"
KEY_SUSPENDED = "scai_p145_suspended_key_00000000000000006"
KEY_INVALID = "scai_p145_invalid_key_not_stored_000000000007"

TEST_TENANT_IDS = (
    TENANT_A_ID,
    TENANT_B_ID,
    TENANT_SUSPENDED_ID,
)


class FakeEmbeddingProvider:
    name = "fake_embedding"

    def __init__(self, vector: list[float]) -> None:
        self.vector = vector

    async def embed(
        self,
        texts: list[str],
        *,
        purpose: str,
        request_id: str | None = None,
    ) -> EmbeddingResult:
        return EmbeddingResult(
            status="ok",
            provider=self.name,
            model="fake-768",
            dimensions=768,
            embeddings=[self.vector for _ in texts],
        )


@unittest.skipUnless(
    POSTGRES_TESTS_ENABLED,
    "Set SMARTCOMMERCE_TEST_POSTGRES=1 to run PostgreSQL tests.",
)
class MultiTenantPostgresTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        await self.cleanup()
        await self.setup_data()

    async def asyncTearDown(self) -> None:
        try:
            await self.cleanup()
        finally:
            await get_engine().dispose()

    async def test_missing_and_rejected_api_keys_return_401(self) -> None:
        cases = (
            ("missing", None),
            ("invalid", KEY_INVALID),
            ("inactive", KEY_INACTIVE),
            ("revoked", KEY_REVOKED),
            ("expired", KEY_EXPIRED),
            ("suspended tenant", KEY_SUSPENDED),
        )

        async with self.client() as client:
            for label, key in cases:
                with self.subTest(label=label):
                    response = await client.get(
                        "/api/v1/auth/context",
                        headers=self.headers(key),
                    )
                    self.assertEqual(401, response.status_code)

    async def test_each_key_resolves_only_its_tenant(self) -> None:
        async with self.client() as client:
            response_a = await client.get(
                "/api/v1/auth/context",
                headers=self.headers(KEY_A),
            )
            response_b = await client.get(
                "/api/v1/auth/context",
                headers=self.headers(KEY_B),
            )

        self.assertEqual(200, response_a.status_code)
        self.assertEqual(200, response_b.status_code)
        self.assertEqual(str(TENANT_A_ID), response_a.json()["tenant_id"])
        self.assertEqual(str(TENANT_B_ID), response_b.json()["tenant_id"])

    async def test_each_tenant_lists_only_its_document(self) -> None:
        async with self.client() as client:
            response_a = await client.get(
                "/api/v1/knowledge/documents",
                headers=self.headers(KEY_A),
            )
            response_b = await client.get(
                "/api/v1/knowledge/documents",
                headers=self.headers(KEY_B),
            )

        self.assertEqual(200, response_a.status_code)
        self.assertEqual(200, response_b.status_code)
        self.assertEqual(
            {str(DOCUMENT_A_ID)},
            self.document_ids(response_a),
        )
        self.assertEqual(
            {str(DOCUMENT_B_ID)},
            self.document_ids(response_b),
        )

    async def test_cross_tenant_delete_is_indistinguishable_and_safe(
        self,
    ) -> None:
        async with self.client() as client:
            foreign_for_a = await client.delete(
                f"/api/v1/knowledge/documents/{DOCUMENT_B_ID}",
                headers=self.headers(KEY_A),
            )
            unknown_for_a = await client.delete(
                f"/api/v1/knowledge/documents/{UNKNOWN_DOCUMENT_ID}",
                headers=self.headers(KEY_A),
            )
            foreign_for_b = await client.delete(
                f"/api/v1/knowledge/documents/{DOCUMENT_A_ID}",
                headers=self.headers(KEY_B),
            )
            unknown_for_b = await client.delete(
                f"/api/v1/knowledge/documents/{UNKNOWN_DOCUMENT_ID}",
                headers=self.headers(KEY_B),
            )

        for response in (
            foreign_for_a,
            unknown_for_a,
            foreign_for_b,
            unknown_for_b,
        ):
            self.assertEqual(404, response.status_code)

        self.assertEqual(foreign_for_a.json(), unknown_for_a.json())
        self.assertEqual(foreign_for_b.json(), unknown_for_b.json())

        session_factory = get_session_factory()
        async with session_factory() as session:
            remaining = await session.scalar(
                select(func.count())
                .select_from(KnowledgeDocument)
                .where(
                    KnowledgeDocument.id.in_(
                        [DOCUMENT_A_ID, DOCUMENT_B_ID]
                    )
                )
            )

        self.assertEqual(2, remaining)

    async def test_pgvector_search_never_crosses_tenants(self) -> None:
        vector_a = [1.0] + [0.0] * 767
        vector_b = [-1.0] + [0.0] * 767
        session_factory = get_session_factory()

        async with session_factory() as session:
            result_a = await SemanticSearchService(
                settings=Settings(_env_file=None),
                embedding_provider=FakeEmbeddingProvider(vector_a),
            ).search(
                session=session,
                tenant_id=TENANT_A_ID,
                query="tenant A",
                top_k=10,
                min_score=0,
            )
            result_b = await SemanticSearchService(
                settings=Settings(_env_file=None),
                embedding_provider=FakeEmbeddingProvider(vector_b),
            ).search(
                session=session,
                tenant_id=TENANT_B_ID,
                query="tenant B",
                top_k=10,
                min_score=0,
            )

        self.assertEqual("ok", result_a.status)
        self.assertEqual("ok", result_b.status)
        self.assertEqual(
            {DOCUMENT_A_ID},
            {hit.document_id for hit in result_a.hits},
        )
        self.assertEqual(
            {DOCUMENT_B_ID},
            {hit.document_id for hit in result_b.hits},
        )

    async def setup_data(self) -> None:
        now = datetime.now(timezone.utc)
        session_factory = get_session_factory()

        async with session_factory() as session:
            session.add_all(
                [
                    Tenant(
                        id=TENANT_A_ID,
                        name="P1.4.5 Tenant A",
                        slug="p145-tenant-a",
                        status="active",
                    ),
                    Tenant(
                        id=TENANT_B_ID,
                        name="P1.4.5 Tenant B",
                        slug="p145-tenant-b",
                        status="active",
                    ),
                    Tenant(
                        id=TENANT_SUSPENDED_ID,
                        name="P1.4.5 Suspended Tenant",
                        slug="p145-tenant-suspended",
                        status="suspended",
                    ),
                ]
            )
            await session.flush()
            session.add_all(
                [
                    self.api_key(
                        "a1450000-1000-4000-8000-000000000001",
                        TENANT_A_ID,
                        "valid-a",
                        KEY_A,
                    ),
                    self.api_key(
                        "b1450000-1000-4000-8000-000000000002",
                        TENANT_B_ID,
                        "valid-b",
                        KEY_B,
                    ),
                    self.api_key(
                        "a1450000-2000-4000-8000-000000000001",
                        TENANT_A_ID,
                        "inactive",
                        KEY_INACTIVE,
                        is_active=False,
                    ),
                    self.api_key(
                        "a1450000-3000-4000-8000-000000000001",
                        TENANT_A_ID,
                        "revoked",
                        KEY_REVOKED,
                        revoked_at=now,
                    ),
                    self.api_key(
                        "a1450000-4000-4000-8000-000000000001",
                        TENANT_A_ID,
                        "expired",
                        KEY_EXPIRED,
                        expires_at=now - timedelta(minutes=5),
                    ),
                    self.api_key(
                        "c1450000-1000-4000-8000-000000000003",
                        TENANT_SUSPENDED_ID,
                        "suspended",
                        KEY_SUSPENDED,
                    ),
                ]
            )
            session.add_all(
                [
                    self.document(
                        DOCUMENT_A_ID,
                        TENANT_A_ID,
                        "A",
                    ),
                    self.document(
                        DOCUMENT_B_ID,
                        TENANT_B_ID,
                        "B",
                    ),
                ]
            )
            await session.flush()
            session.add_all(
                [
                    self.chunk(
                        DOCUMENT_A_ID,
                        TENANT_A_ID,
                        "Tenant A content",
                        [1.0] + [0.0] * 767,
                    ),
                    self.chunk(
                        DOCUMENT_B_ID,
                        TENANT_B_ID,
                        "Tenant B content",
                        [-1.0] + [0.0] * 767,
                    ),
                ]
            )
            await session.commit()

    async def cleanup(self) -> None:
        session_factory = get_session_factory()
        async with session_factory() as session:
            await session.execute(
                delete(Tenant).where(
                    Tenant.id.in_(TEST_TENANT_IDS)
                )
            )
            await session.commit()

    @staticmethod
    def api_key(
        key_id: str,
        tenant_id: UUID,
        name: str,
        plain_text: str,
        *,
        is_active: bool = True,
        revoked_at: datetime | None = None,
        expires_at: datetime | None = None,
    ) -> ApiKey:
        return ApiKey(
            id=UUID(key_id),
            tenant_id=tenant_id,
            name=name,
            key_prefix=plain_text[:16],
            key_hash=hash_api_key(plain_text),
            is_active=is_active,
            revoked_at=revoked_at,
            expires_at=expires_at,
        )

    @staticmethod
    def document(
        document_id: UUID,
        tenant_id: UUID,
        suffix: str,
    ) -> KnowledgeDocument:
        return KnowledgeDocument(
            id=document_id,
            tenant_id=tenant_id,
            external_id=f"p145-document-{suffix.lower()}",
            title=f"Document {suffix}",
            original_filename=f"document-{suffix.lower()}.pdf",
            source_type="pdf",
            mime_type="application/pdf",
            checksum_sha256=suffix.lower() * 64,
            status="ready",
            chunks_count=1,
            embedding_model="fake-768",
            embedding_dimensions=768,
            metadata_json={},
        )

    @staticmethod
    def chunk(
        document_id: UUID,
        tenant_id: UUID,
        content: str,
        embedding: list[float],
    ) -> KnowledgeChunk:
        return KnowledgeChunk(
            id=uuid4(),
            document_id=document_id,
            tenant_id=tenant_id,
            chunk_index=0,
            content=content,
            content_hash=hashlib.sha256(
                content.encode("utf-8")
            ).hexdigest(),
            char_count=len(content),
            page_number=1,
            embedding_model="fake-768",
            embedding=embedding,
            metadata_json={},
        )

    @staticmethod
    def client() -> httpx.AsyncClient:
        return httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://testserver",
        )

    @staticmethod
    def headers(key: str | None) -> dict[str, str]:
        return {"X-API-Key": key} if key is not None else {}

    @staticmethod
    def document_ids(response: httpx.Response) -> set[str]:
        return {
            item["document_id"]
            for item in response.json()["documents"]
        }


if __name__ == "__main__":
    unittest.main()
