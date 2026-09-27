import unittest
from types import SimpleNamespace
from unittest.mock import patch
from uuid import UUID, uuid4

import httpx

from app.api.dependencies.auth import require_tenant
from app.core.database import get_db_session
from app.main import app
from app.rag.answering import RagAnswerResult


VALID_REQUEST_ID = "71530000-0000-4000-8000-000000000001"
DOCUMENT_ID = "71530000-0000-4000-8000-000000000002"


class FakeSession:
    async def scalar(self, statement):
        return None


class FakeRagAnswerService:
    def __init__(self, result=None, exception=None):
        self.result = result
        self.exception = exception
        self.calls = []

    async def answer(self, **kwargs):
        self.calls.append(kwargs)
        if self.exception is not None:
            raise self.exception
        return self.result


def rag_result(*, status="ok", error_code=None):
    return RagAnswerResult(
        status=status,
        answer="Réponse utile." if status == "ok" else None,
        citations=[],
        retrieval_provider="fake-embedding",
        retrieval_model="fake-model",
        llm_provider="fake-llm" if status == "ok" else None,
        llm_model="fake-model" if status == "ok" else None,
        error_code=error_code,
    )


class RequestIdMiddlewareTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        async def fake_session():
            yield FakeSession()

        async def fake_tenant():
            return SimpleNamespace(
                id=uuid4(), name="Tenant test", slug="tenant-test"
            )

        app.dependency_overrides[get_db_session] = fake_session
        app.dependency_overrides[require_tenant] = fake_tenant
        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://test",
        )

    async def asyncTearDown(self):
        await self.client.aclose()
        app.dependency_overrides.clear()

    async def test_valid_id_is_preserved_through_assistant(self):
        fake = FakeRagAnswerService(rag_result())
        with patch("app.api.v1.assistant.RagAnswerService", return_value=fake):
            response = await self.client.post(
                "/api/v1/assistant/ask",
                headers={"X-Request-ID": VALID_REQUEST_ID},
                json={"question": "Question valide"},
            )

        self.assertEqual(200, response.status_code)
        self.assertEqual(VALID_REQUEST_ID, response.headers["X-Request-ID"])
        self.assertEqual(VALID_REQUEST_ID, fake.calls[0]["request_id"])

    async def test_missing_id_is_generated_on_health(self):
        response = await self.client.get("/api/v1/health")
        self.assertEqual(200, response.status_code)
        self.assert_canonical_uuid(response.headers["X-Request-ID"])

    async def test_invalid_and_oversized_ids_are_replaced(self):
        for invalid_id in ("invalid", "x" * 500):
            with self.subTest(invalid_id=invalid_id[:10]):
                response = await self.client.get(
                    "/api/v1/health",
                    headers={"X-Request-ID": invalid_id},
                )
                resolved = response.headers["X-Request-ID"]
                self.assert_canonical_uuid(resolved)
                self.assertNotEqual(invalid_id, resolved)

    async def test_auth_context_success_preserves_id(self):
        response = await self.client.get(
            "/api/v1/auth/context",
            headers={"X-Request-ID": VALID_REQUEST_ID},
        )
        self.assertEqual(200, response.status_code)
        self.assertEqual(VALID_REQUEST_ID, response.headers["X-Request-ID"])

    async def test_auth_401_has_request_id(self):
        app.dependency_overrides.pop(require_tenant)
        response = await self.client.get("/api/v1/auth/context")
        self.assertEqual(401, response.status_code)
        self.assertEqual("Invalid or missing API key.", response.json()["detail"])
        self.assert_canonical_uuid(response.headers["X-Request-ID"])

    async def test_knowledge_404_preserves_body_and_request_id(self):
        response = await self.client.delete(
            f"/api/v1/knowledge/documents/{DOCUMENT_ID}",
            headers={"X-Request-ID": VALID_REQUEST_ID},
        )
        self.assertEqual(404, response.status_code)
        self.assertEqual("document_not_found", response.json()["detail"]["code"])
        self.assertEqual(VALID_REQUEST_ID, response.headers["X-Request-ID"])

    async def test_validation_422_keeps_detail_list_and_request_id(self):
        response = await self.client.post(
            "/api/v1/assistant/ask",
            headers={"X-Request-ID": VALID_REQUEST_ID},
            json={"question": "x"},
        )
        self.assertEqual(422, response.status_code)
        self.assertIsInstance(response.json()["detail"], list)
        self.assertEqual(VALID_REQUEST_ID, response.headers["X-Request-ID"])

    async def test_business_503_preserves_body_and_request_id(self):
        fake = FakeRagAnswerService(
            rag_result(status="error", error_code="provider_timeout")
        )
        with patch("app.api.v1.assistant.RagAnswerService", return_value=fake):
            response = await self.client.post(
                "/api/v1/assistant/ask",
                headers={"X-Request-ID": VALID_REQUEST_ID},
                json={"question": "Question valide"},
            )
        self.assertEqual(503, response.status_code)
        self.assertEqual("provider_timeout", response.json()["detail"]["code"])
        self.assertEqual(VALID_REQUEST_ID, response.headers["X-Request-ID"])

    async def test_unexpected_500_is_generic_logged_and_correlated(self):
        fake = FakeRagAnswerService(exception=RuntimeError("internal secret"))
        with self.assertLogs("app.core.request_id", level="ERROR") as logs:
            with patch("app.api.v1.assistant.RagAnswerService", return_value=fake):
                response = await self.client.post(
                    "/api/v1/assistant/ask",
                    headers={"X-Request-ID": VALID_REQUEST_ID},
                    json={"question": "Question valide"},
                )

        self.assertEqual(500, response.status_code)
        self.assertEqual({"detail": "Internal Server Error"}, response.json())
        self.assertNotIn("internal secret", response.text)
        self.assertEqual(VALID_REQUEST_ID, response.headers["X-Request-ID"])
        self.assertTrue(
            any(record.request_id == VALID_REQUEST_ID for record in logs.records)
        )

    def assert_canonical_uuid(self, value):
        self.assertEqual(36, len(value))
        self.assertEqual(value.lower(), str(UUID(value)))


if __name__ == "__main__":
    unittest.main()
