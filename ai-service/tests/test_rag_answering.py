import unittest
from uuid import uuid4

from app.rag.answering import RagAnswerService
from app.rag.search import (
    SemanticSearchHit,
    SemanticSearchResult,
)
from app.schemas.llm import LlmResult


def search_result(*, status="ok", hits=None, error_code=None):
    return SemanticSearchResult(
        status=status,
        hits=hits or [],
        provider="fake-embedding",
        model="fake-embedding-model",
        error_code=error_code,
    )


def hit(*, title, page, index, score):
    return SemanticSearchHit(
        chunk_id=uuid4(),
        document_id=uuid4(),
        document_title=title,
        chunk_index=index,
        page_number=page,
        content=f"Contenu {title}",
        distance=1.0 - score,
        score=score,
    )


class FakeSearchService:
    def __init__(self, result):
        self.result = result
        self.calls = []

    async def search(self, **kwargs):
        self.calls.append(kwargs)
        return self.result


class FakeLlmManager:
    def __init__(self, result):
        self.result = result
        self.calls = []

    async def chat(self, messages, *, purpose, request_id=None):
        self.calls.append((messages, purpose, request_id))
        return self.result


def llm_result(*, status="ok", content="Réponse [Source 1].", error_code=None):
    return LlmResult(
        status=status,
        provider="fake-llm",
        model="fake-llm-model",
        content=content,
        error_code=error_code,
        latency_ms=1,
    )


class RagAnswerServiceTest(unittest.IsolatedAsyncioTestCase):
    async def test_valid_search_calls_generation_and_propagates_options(self):
        tenant_id = uuid4()
        search = FakeSearchService(
            search_result(hits=[hit(title="A", page=2, index=3, score=0.9)])
        )
        llm = FakeLlmManager(llm_result(content="  Réponse utile.  "))

        result = await RagAnswerService(search, llm).answer(
            session=object(), tenant_id=tenant_id, question=" Question ",
            top_k=7, min_score=0.65, request_id="rag-test",
        )

        self.assertEqual("ok", result.status)
        self.assertEqual("Réponse utile.", result.answer)
        self.assertEqual(1, len(llm.calls))
        self.assertEqual("rag-test", llm.calls[0][2])
        self.assertEqual(tenant_id, search.calls[0]["tenant_id"])
        self.assertEqual(7, search.calls[0]["top_k"])
        self.assertEqual(0.65, search.calls[0]["min_score"])
        self.assertEqual("Question", search.calls[0]["query"])

    async def test_empty_search_skips_llm(self):
        result, llm = await self.answer_with(search_result(status="empty"))
        self.assertEqual("empty", result.status)
        self.assertEqual("knowledge_not_found", result.error_code)
        self.assertEqual([], llm.calls)

    async def test_search_error_is_propagated(self):
        result, llm = await self.answer_with(
            search_result(status="error", error_code="knowledge_search_failed")
        )
        self.assertEqual("error", result.status)
        self.assertEqual("knowledge_search_failed", result.error_code)
        self.assertEqual([], llm.calls)

    async def test_embedding_error_from_search_is_propagated(self):
        result, _ = await self.answer_with(
            search_result(status="error", error_code="query_embedding_failed")
        )
        self.assertEqual("query_embedding_failed", result.error_code)

    async def test_llm_error_is_propagated(self):
        result, _ = await self.answer_with(
            search_result(hits=[hit(title="A", page=1, index=0, score=0.8)]),
            llm_result(status="error", content=None, error_code="provider_timeout"),
        )
        self.assertEqual("error", result.status)
        self.assertEqual("provider_timeout", result.error_code)

    async def test_empty_llm_answer_is_rejected(self):
        result, _ = await self.answer_with(
            search_result(hits=[hit(title="A", page=1, index=0, score=0.8)]),
            llm_result(content=""),
        )
        self.assertEqual("error", result.status)
        self.assertEqual("answer_generation_failed", result.error_code)

    async def test_whitespace_llm_answer_is_rejected(self):
        result, _ = await self.answer_with(
            search_result(hits=[hit(title="A", page=1, index=0, score=0.8)]),
            llm_result(content="   \n "),
        )
        self.assertEqual("error", result.status)
        self.assertEqual("answer_generation_failed", result.error_code)

    async def test_citations_use_only_hits_and_preserve_order(self):
        first = hit(title="Premier", page=4, index=2, score=0.91)
        second = hit(title="Second", page=None, index=8, score=0.72)
        result, llm = await self.answer_with(search_result(hits=[first, second]))

        self.assertEqual([1, 2], [item.source_number for item in result.citations])
        self.assertEqual(
            [first.document_id, second.document_id],
            [item.document_id for item in result.citations],
        )
        self.assertEqual(["Premier", "Second"], [c.document_title for c in result.citations])
        self.assertEqual([4, None], [c.page_number for c in result.citations])
        self.assertEqual([0.91, 0.72], [c.score for c in result.citations])
        user_prompt = llm.calls[0][0][1].content
        self.assertIn("[Source 1]", user_prompt)
        self.assertIn("[Source 2]", user_prompt)

    async def answer_with(self, search_value, llm_value=None):
        search = FakeSearchService(search_value)
        llm = FakeLlmManager(llm_value or llm_result())
        result = await RagAnswerService(search, llm).answer(
            session=object(), tenant_id=uuid4(), question="Question",
        )
        return result, llm


if __name__ == "__main__":
    unittest.main()
