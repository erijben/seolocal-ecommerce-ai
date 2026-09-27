import unittest

from app.core.config import Settings
from app.providers.manager import LlmProviderManager
from app.schemas.llm import ChatMessage, LlmResult


class FakeProvider:
    def __init__(self, name: str, result: LlmResult) -> None:
        self.name = name
        self.result = result
        self.calls = 0

    async def chat(self, messages, *, purpose, request_id=None):
        self.calls += 1
        return self.result


def result(
    provider: str,
    *,
    status: str,
    error_code: str | None = None,
) -> LlmResult:
    return LlmResult(
        status=status,
        provider=provider,
        model=f"{provider}-model",
        content="Réponse" if status == "ok" else None,
        error_code=error_code,
        latency_ms=1,
    )


class LlmProviderManagerTest(unittest.IsolatedAsyncioTestCase):
    async def test_configured_primary_provider_is_selected(self) -> None:
        primary = FakeProvider(
            "ollama_cloud",
            result("ollama_cloud", status="ok"),
        )
        other = FakeProvider(
            "ollama_local",
            result("ollama_local", status="ok"),
        )

        response = await self.chat(
            self.manager([other, primary])
        )

        self.assertEqual("ollama_cloud", response.provider)
        self.assertEqual(1, primary.calls)
        self.assertEqual(0, other.calls)

    async def test_missing_configured_provider_returns_error(self) -> None:
        local = FakeProvider(
            "ollama_local",
            result("ollama_local", status="ok"),
        )

        response = await self.chat(self.manager([local]))

        self.assertEqual("error", response.status)
        self.assertEqual("provider_not_configured", response.error_code)
        self.assertEqual(0, local.calls)

    async def test_primary_error_without_fallback_is_returned(self) -> None:
        primary = FakeProvider(
            "ollama_cloud",
            result(
                "ollama_cloud",
                status="error",
                error_code="primary_timeout",
            ),
        )
        fallback = FakeProvider(
            "ollama_local",
            result("ollama_local", status="ok"),
        )

        response = await self.chat(
            self.manager([primary, fallback])
        )

        self.assertEqual("primary_timeout", response.error_code)
        self.assertEqual(0, fallback.calls)

    async def test_explicit_fallback_is_used(self) -> None:
        primary, fallback = self.failing_primary_and_fallback(
            fallback_status="ok"
        )

        response = await self.chat(
            self.manager(
                [primary, fallback],
                allow_fallback=True,
                fallback_name="ollama_local",
            )
        )

        self.assertEqual("ok", response.status)
        self.assertEqual("ollama_local", response.provider)
        self.assertEqual(1, fallback.calls)

    async def test_only_configured_fallback_is_used(self) -> None:
        primary, fallback = self.failing_primary_and_fallback(
            fallback_status="ok"
        )
        arbitrary = FakeProvider(
            "arbitrary",
            result("arbitrary", status="ok"),
        )

        response = await self.chat(
            self.manager(
                [arbitrary, primary, fallback],
                allow_fallback=True,
                fallback_name="ollama_local",
            )
        )

        self.assertEqual("ollama_local", response.provider)
        self.assertEqual(0, arbitrary.calls)

    async def test_fallback_error_is_returned(self) -> None:
        primary, fallback = self.failing_primary_and_fallback(
            fallback_status="error"
        )

        response = await self.chat(
            self.manager(
                [primary, fallback],
                allow_fallback=True,
                fallback_name="ollama_local",
            )
        )

        self.assertEqual("error", response.status)
        self.assertEqual("fallback_failed", response.error_code)
        self.assertEqual("ollama_local", response.provider)

    async def test_no_arbitrary_provider_is_selected(self) -> None:
        primary = FakeProvider(
            "ollama_cloud",
            result(
                "ollama_cloud",
                status="error",
                error_code="primary_failed",
            ),
        )
        arbitrary = FakeProvider(
            "arbitrary",
            result("arbitrary", status="ok"),
        )

        response = await self.chat(
            self.manager(
                [primary, arbitrary],
                allow_fallback=True,
                fallback_name=None,
            )
        )

        self.assertEqual("primary_failed", response.error_code)
        self.assertEqual(0, arbitrary.calls)

    def manager(
        self,
        providers: list[FakeProvider],
        *,
        allow_fallback: bool = False,
        fallback_name: str | None = "ollama_local",
    ) -> LlmProviderManager:
        settings = Settings(
            _env_file=None,
            llm_provider="ollama_cloud",
            allow_provider_fallback=allow_fallback,
            llm_fallback_provider=fallback_name,
        )
        return LlmProviderManager(
            providers=providers,
            settings=settings,
        )

    def failing_primary_and_fallback(
        self,
        *,
        fallback_status: str,
    ) -> tuple[FakeProvider, FakeProvider]:
        primary = FakeProvider(
            "ollama_cloud",
            result(
                "ollama_cloud",
                status="error",
                error_code="primary_failed",
            ),
        )
        fallback = FakeProvider(
            "ollama_local",
            result(
                "ollama_local",
                status=fallback_status,
                error_code=(
                    "fallback_failed"
                    if fallback_status == "error"
                    else None
                ),
            ),
        )
        return primary, fallback

    async def chat(self, manager: LlmProviderManager) -> LlmResult:
        return await manager.chat(
            [ChatMessage(role="user", content="Question")],
            purpose="assistant",
            request_id="manager-test",
        )


if __name__ == "__main__":
    unittest.main()
