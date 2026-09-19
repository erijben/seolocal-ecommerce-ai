from app.core.config import Settings, get_settings
from app.providers.base import LlmProvider
from app.schemas.llm import ChatMessage, LlmPurpose, LlmResult


class LlmProviderManager:
    def __init__(
        self,
        providers: list[LlmProvider],
        settings: Settings | None = None,
    ) -> None:
        self.settings = settings or get_settings()

        self._providers = {
            provider.name: provider
            for provider in providers
        }

    @property
    def available_provider_names(self) -> tuple[str, ...]:
        return tuple(self._providers.keys())

    async def chat(
        self,
        messages: list[ChatMessage],
        *,
        purpose: LlmPurpose,
        request_id: str | None = None,
    ) -> LlmResult:
        preferred_provider_name = self.settings.llm_provider

        preferred_provider = self._providers.get(
            preferred_provider_name
        )

        if preferred_provider is None:
            return self._configuration_error(
                provider_name=preferred_provider_name,
                error_code="provider_not_configured",
            )

        primary_result = await preferred_provider.chat(
            messages,
            purpose=purpose,
            request_id=request_id,
        )

        if primary_result.status == "ok":
            return primary_result

        if not self.settings.allow_provider_fallback:
            return primary_result

        fallback_provider_name = (
            self.settings.llm_fallback_provider
        )

        if (
            fallback_provider_name is None
            or fallback_provider_name == preferred_provider_name
        ):
            return primary_result

        fallback_provider = self._providers.get(
            fallback_provider_name
        )

        if fallback_provider is None:
            return primary_result

        return await fallback_provider.chat(
            messages,
            purpose=purpose,
            request_id=request_id,
        )

    def _configuration_error(
        self,
        *,
        provider_name: str,
        error_code: str,
    ) -> LlmResult:
        return LlmResult(
            status="error",
            provider=provider_name,
            model="not_configured",
            content=None,
            error_code=error_code,
            latency_ms=0,
        )