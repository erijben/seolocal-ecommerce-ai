from time import perf_counter

import httpx

from app.core.config import Settings, get_settings
from app.providers.base import LlmProvider
from app.schemas.llm import ChatMessage, LlmPurpose, LlmResult


class OllamaCloudProvider(LlmProvider):
    def __init__(
        self,
        settings: Settings | None = None,
    ) -> None:
        self.settings = settings or get_settings()

    @property
    def name(self) -> str:
        return "ollama_cloud"

    async def chat(
        self,
        messages: list[ChatMessage],
        *,
        purpose: LlmPurpose,
        request_id: str | None = None,
    ) -> LlmResult:
        started_at = perf_counter()

        api_key = self._get_api_key()

        if api_key is None:
            return self._error_result(
                error_code="provider_credentials_missing",
                started_at=started_at,
            )

        base_url = self.settings.ollama_cloud_base_url.rstrip("/")
        endpoint = f"{base_url}/api/chat"

        timeout = httpx.Timeout(
            connect=self.settings.ollama_connect_timeout_seconds,
            read=self.settings.ollama_read_timeout_seconds,
            write=30.0,
            pool=5.0,
        )

        payload = {
            "model": self.settings.ollama_cloud_model,
            "messages": [
                message.model_dump()
                for message in messages
            ],
            "stream": False,
            "options": {
                "temperature": self.settings.ollama_temperature,
                "num_predict": self.settings.ollama_num_predict,
                "num_ctx": self.settings.ollama_num_ctx,
            },
        }

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(
                timeout=timeout,
                headers=headers,
            ) as client:
                response = await client.post(
                    endpoint,
                    json=payload,
                )

            if response.status_code in {401, 403}:
                return self._error_result(
                    error_code="provider_authentication_failed",
                    started_at=started_at,
                )

            if response.status_code == 429:
                return self._error_result(
                    error_code="provider_rate_limited",
                    started_at=started_at,
                )

            response.raise_for_status()

            response_data = response.json()

            done = response_data.get("done")
            done_reason = response_data.get("done_reason")

            if done is False:
                return self._error_result(
                    error_code="incomplete_response",
                    started_at=started_at,
                )

            if done_reason == "length":
                return self._error_result(
                    error_code="response_truncated",
                    started_at=started_at,
                )

            content = response_data.get("message", {}).get("content")

            if not isinstance(content, str) or not content.strip():
                return self._error_result(
                    error_code="empty_response",
                    started_at=started_at,
                )

            return LlmResult(
                status="ok",
                provider=self.name,
                model=self.settings.ollama_cloud_model,
                content=content.strip(),
                latency_ms=self._elapsed_ms(started_at),
            )

        except httpx.TimeoutException:
            return self._error_result(
                error_code="provider_timeout",
                started_at=started_at,
            )

        except httpx.HTTPStatusError:
            return self._error_result(
                error_code="provider_http_error",
                started_at=started_at,
            )

        except httpx.RequestError:
            return self._error_result(
                error_code="provider_unavailable",
                started_at=started_at,
            )

        except ValueError:
            return self._error_result(
                error_code="invalid_provider_response",
                started_at=started_at,
            )

    def _get_api_key(self) -> str | None:
        secret = self.settings.ollama_api_key

        if secret is None:
            return None

        value = secret.get_secret_value().strip()

        return value or None

    def _error_result(
        self,
        *,
        error_code: str,
        started_at: float,
    ) -> LlmResult:
        return LlmResult(
            status="error",
            provider=self.name,
            model=self.settings.ollama_cloud_model,
            content=None,
            error_code=error_code,
            latency_ms=self._elapsed_ms(started_at),
        )

    @staticmethod
    def _elapsed_ms(started_at: float) -> int:
        return int((perf_counter() - started_at) * 1000)