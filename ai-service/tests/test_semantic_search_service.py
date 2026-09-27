import unittest
from types import SimpleNamespace
from uuid import uuid4

from sqlalchemy.sql.elements import TextClause

from app.core.config import Settings
from app.rag.search import SemanticSearchService
from app.schemas.embeddings import EmbeddingResult


class FakeEmbeddingProvider:
    def __init__(self, result):
        self.result = result
        self.calls = []

    async def embed(self, texts, purpose, request_id=None):
        self.calls.append((texts, purpose, request_id))
        return self.result


class FakeRowsResult:
    def __init__(self, rows):
        self.rows = rows

    def all(self):
        return self.rows


class FakeSession:
    def __init__(self, rows=()):
        self.rows = rows
        self.statements = []

    async def execute(self, statement):
        self.statements.append(statement)
        if isinstance(statement, TextClause):
            return FakeRowsResult([])
        return FakeRowsResult(self.rows)


def embedding_result(*, status="ok", embeddings=None, error_code=None):
    return EmbeddingResult(
        status=status,
        provider="fake-embedding",
        model="fake-model",
        dimensions=768,
        embeddings=[[0.0] * 768] if embeddings is None else embeddings,
        error_code=error_code,
        latency_ms=1,
    )


class SemanticSearchServiceTest(unittest.IsolatedAsyncioTestCase):
    def service(self, provider):
        return SemanticSearchService(
            settings=Settings(_env_file=None, rag_top_k=5, rag_min_score=0.4),
            embedding_provider=provider,
        )

    async def test_embedding_search_respects_tenant_limit_score_and_order(self):
        tenant_id = uuid4()
        rows = [
            SimpleNamespace(chunk_id=uuid4(), document_id=uuid4(),
                            document_title="Premier", chunk_index=0,
                            page_number=1, content="A", distance=0.10),
            SimpleNamespace(chunk_id=uuid4(), document_id=uuid4(),
                            document_title="Sous seuil", chunk_index=1,
                            page_number=2, content="B", distance=0.60),
        ]
        provider = FakeEmbeddingProvider(embedding_result())
        session = FakeSession(rows)

        result = await self.service(provider).search(
            session=session, tenant_id=tenant_id, query="  demande  ",
            top_k=50, min_score=0.5, request_id="search-test",
        )

        self.assertEqual("ok", result.status)
        self.assertEqual(["Premier"], [item.document_title for item in result.hits])
        self.assertEqual((['demande'], 'query', 'search-test'), provider.calls[0])
        statement = session.statements[1]
        self.assertEqual(20, statement._limit_clause.value)
        compiled = statement.compile()
        self.assertEqual(tenant_id, compiled.params["tenant_id_1"])
        self.assertEqual(tenant_id, compiled.params["tenant_id_2"])
        sql = str(statement)
        self.assertIn("knowledge_documents.status", sql)
        self.assertIn("ORDER BY", sql)

    async def test_embedding_provider_error_stops_before_database(self):
        provider = FakeEmbeddingProvider(
            embedding_result(status="error", embeddings=[], error_code="embedding_timeout")
        )
        session = FakeSession()
        result = await self.service(provider).search(
            session=session, tenant_id=uuid4(), query="demande",
        )
        self.assertEqual("error", result.status)
        self.assertEqual("embedding_timeout", result.error_code)
        self.assertEqual([], session.statements)

    async def test_empty_embedding_is_rejected_without_lexical_fallback(self):
        provider = FakeEmbeddingProvider(embedding_result(embeddings=[]))
        session = FakeSession()
        result = await self.service(provider).search(
            session=session, tenant_id=uuid4(), query="demande",
        )
        self.assertEqual("error", result.status)
        self.assertEqual("query_embedding_failed", result.error_code)
        self.assertEqual(1, len(provider.calls))
        self.assertEqual([], session.statements)

    async def test_no_database_rows_returns_empty(self):
        session = FakeSession()
        result = await self.service(
            FakeEmbeddingProvider(embedding_result())
        ).search(session=session, tenant_id=uuid4(), query="demande")
        self.assertEqual("empty", result.status)
        self.assertEqual([], result.hits)


if __name__ == "__main__":
    unittest.main()
