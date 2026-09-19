#Ce provider refuse explicitement :une liste vide ;un batch trop grand ;un texte vide ;une quantité de vecteurs incorrecte ;un vecteur différent de 768 dimensions ;

from math import isfinite
from time import perf_counter

import httpx

from app.core.config import Settings, get_settings
from app.embeddings.base import EmbeddingProvider
from app.schemas.embeddings import (
    EmbeddingPurpose,
    EmbeddingResult,
)


class OllamaLocalEmbeddingProvider(EmbeddingProvider):
    def __init__(
        self,
        settings: Settings | None = None,
    ) -> None:
        self.settings = settings or get_settings()

    @property
    def name(self) -> str:
        return "ollama_local"

    async def embed(
        self,
        texts: list[str],
        purpose: EmbeddingPurpose,
        request_id: str | None = None,
    ) -> EmbeddingResult:
        started_at = perf_counter()

        if not texts:
            return self._error_result(
                error_code="empty_input",
                started_at=started_at,
            )

        if len(texts) > self.settings.embedding_batch_size:
            return self._error_result(
                error_code="batch_size_exceeded",
                started_at=started_at,
            )

        normalized_texts = [
            text.strip()
            for text in texts
        ]

        if any(not text for text in normalized_texts):
            return self._error_result(
                error_code="invalid_input",
                started_at=started_at,
            )

        base_url = self.settings.ollama_local_base_url.rstrip("/")
        endpoint = f"{base_url}/api/embed"

        timeout = httpx.Timeout(
            connect=(
                self.settings
                .embedding_connect_timeout_seconds
            ),
            read=self.settings.embedding_read_timeout_seconds,
            write=30.0,
            pool=5.0,
        )

        payload = {
            "model": self.settings.embedding_model,
            "input": normalized_texts,
            "truncate": False,
        }

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    endpoint,
                    json=payload,
                )

            response.raise_for_status()
            response_data = response.json()

            embeddings = self._validate_embeddings(
                raw_embeddings=response_data.get("embeddings"),
                expected_count=len(normalized_texts),
            )

            if embeddings is None:
                return self._error_result(
                    error_code="invalid_provider_response",
                    started_at=started_at,
                )

            return EmbeddingResult(
                status="ok",
                provider=self.name,
                model=self.settings.embedding_model,
                dimensions=self.settings.embedding_dimensions,
                embeddings=embeddings,
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

    def _validate_embeddings(
        self,
        raw_embeddings: object,
        expected_count: int,
    ) -> list[list[float]] | None:
        if (
            not isinstance(raw_embeddings, list)
            or len(raw_embeddings) != expected_count
        ):
            return None

        validated_embeddings: list[list[float]] = []

        for raw_vector in raw_embeddings:
            if (
                not isinstance(raw_vector, list)
                or len(raw_vector)
                != self.settings.embedding_dimensions
            ):
                return None

            try:
                vector = [
                    float(value)
                    for value in raw_vector
                ]
            except (TypeError, ValueError):
                return None

            if not all(isfinite(value) for value in vector):
                return None

            validated_embeddings.append(vector)

        return validated_embeddings

    def _error_result(
        self,
        *,
        error_code: str,
        started_at: float,
    ) -> EmbeddingResult:
        return EmbeddingResult(
            status="error",
            provider=self.name,
            model=self.settings.embedding_model,
            dimensions=self.settings.embedding_dimensions,
            embeddings=[],
            error_code=error_code,
            latency_ms=self._elapsed_ms(started_at),
        )

    @staticmethod
    def _elapsed_ms(started_at: float) -> int:
        return int((perf_counter() - started_at) * 1000)