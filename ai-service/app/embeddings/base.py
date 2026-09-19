from abc import ABC, abstractmethod

from app.schemas.embeddings import (
    EmbeddingPurpose,
    EmbeddingResult,
)


class EmbeddingProvider(ABC):
    name: str

    @abstractmethod
    async def embed(
        self,
        texts: list[str],
        purpose: EmbeddingPurpose,
        request_id: str | None = None,
    ) -> EmbeddingResult:
        raise NotImplementedError