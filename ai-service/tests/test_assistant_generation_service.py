import unittest

from app.core.config import Settings
from app.providers.manager import LlmProviderManager
from app.schemas.llm import LlmResult
from app.services.assistant_generation_service import (
    AssistantGenerationService,
)


def llm_result(
    *,
    status: str,
    provider: str = "ollama_cloud",
    content: str | None = None,
    error_code: str | None = None,
) -> LlmResult:
    return LlmResult(
        status=status,
        provider=provider,
        model=f"{provider}-model",
        content=content,
        error_code=error_code,
        latency_ms=1,
    )


class FakeProvider:
    def __init__(self, name: str, result: LlmResult) -> None:
        self.name = name
        self.result = result
        self.calls = 0

    async def chat(self, messages, *, purpose, request_id=None):
        self.calls += 1
        return self.result


class FakeManager:
    def __init__(self, result: LlmResult) -> None:
        self.result = result
        self.calls = 0

    async def chat(self, messages, *, purpose, request_id=None):
        self.calls += 1
        return self.result


class AssistantGenerationServiceTest(
    unittest.IsolatedAsyncioTestCase
):
    async def test_valid_provider_answer_is_returned(self) -> None:
        manager = FakeManager(
            llm_result(status="ok", content="  Réponse utile.  ")
        )

        result = await self.generate(manager)

        self.assertEqual("ok", result.status)
        self.assertEqual("Réponse utile.", result.answer)
        self.assertEqual(1, manager.calls)

    async def test_provider_error_is_propagated(self) -> None:
        result = await self.generate(
            FakeManager(
                llm_result(
                    status="error",
                    error_code="provider_timeout",
                )
            )
        )

        self.assertEqual("error", result.status)
        self.assertIsNone(result.answer)
        self.assertEqual("provider_timeout", result.error_code)

    async def test_empty_provider_content_is_rejected(self) -> None:
        result = await self.generate(
            FakeManager(llm_result(status="ok", content=""))
        )

        self.assertEqual("error", result.status)
        self.assertIsNone(result.answer)
        self.assertEqual(
            "assistant_generation_failed",
            result.error_code,
        )

    async def test_whitespace_provider_content_is_rejected(self) -> None:
        result = await self.generate(
            FakeManager(llm_result(status="ok", content="   \n "))
        )

        self.assertEqual("error", result.status)
        self.assertIsNone(result.answer)

    async def test_disabled_fallback_does_not_call_fallback(self) -> None:
        primary = FakeProvider(
            "ollama_cloud",
            llm_result(
                status="error",
                error_code="provider_timeout",
            ),
        )
        fallback = FakeProvider(
            "ollama_local",
            llm_result(
                status="ok",
                provider="ollama_local",
                content="Réponse locale.",
            ),
        )
        manager = self.provider_manager(
            primary,
            fallback,
            allow_fallback=False,
        )

        result = await self.generate(manager)

        self.assertEqual("error", result.status)
        self.assertEqual(1, primary.calls)
        self.assertEqual(0, fallback.calls)

    async def test_explicit_fallback_is_used(self) -> None:
        primary = FakeProvider(
            "ollama_cloud",
            llm_result(
                status="error",
                error_code="provider_timeout",
            ),
        )
        fallback = FakeProvider(
            "ollama_local",
            llm_result(
                status="ok",
                provider="ollama_local",
                content="Réponse locale.",
            ),
        )
        manager = self.provider_manager(
            primary,
            fallback,
            allow_fallback=True,
        )

        result = await self.generate(manager)

        self.assertEqual("ok", result.status)
        self.assertEqual("Réponse locale.", result.answer)
        self.assertEqual("ollama_local", result.llm_provider)
        self.assertEqual(1, primary.calls)
        self.assertEqual(1, fallback.calls)

    async def test_fallback_error_is_propagated(self) -> None:
        primary = FakeProvider(
            "ollama_cloud",
            llm_result(
                status="error",
                error_code="primary_timeout",
            ),
        )
        fallback = FakeProvider(
            "ollama_local",
            llm_result(
                status="error",
                provider="ollama_local",
                error_code="fallback_unavailable",
            ),
        )
        manager = self.provider_manager(
            primary,
            fallback,
            allow_fallback=True,
        )

        result = await self.generate(manager)

        self.assertEqual("error", result.status)
        self.assertEqual("fallback_unavailable", result.error_code)
        self.assertEqual("ollama_local", result.llm_provider)

    async def generate(self, manager) -> object:
        return await AssistantGenerationService(manager).generate(
            question="Quels produits faut-il réapprovisionner ?",
            context="Le produit A dispose de deux unités.",
            intent="stock",
            request_id="assistant-test",
        )

    def provider_manager(
        self,
        primary: FakeProvider,
        fallback: FakeProvider,
        *,
        allow_fallback: bool,
    ) -> LlmProviderManager:
        settings = Settings(
            _env_file=None,
            llm_provider="ollama_cloud",
            allow_provider_fallback=allow_fallback,
            llm_fallback_provider="ollama_local",
        )
        return LlmProviderManager(
            providers=[primary, fallback],
            settings=settings,
        )


if __name__ == "__main__":
    unittest.main()
