#fabrique du provider d’embeddings :rendra possible l’ajout ultérieur d’un provider cloud ou privé sans modifier le service RAG.

from functools import lru_cache

from app.core.config import get_settings
from app.embeddings.base import EmbeddingProvider
from app.embeddings.ollama_local import (
    OllamaLocalEmbeddingProvider,
)


@lru_cache
def get_embedding_provider() -> EmbeddingProvider:
    settings = get_settings()

    if settings.embedding_provider == "ollama_local":
        return OllamaLocalEmbeddingProvider(
            settings=settings
        )

    raise RuntimeError(
        "Configured embedding provider is not supported."
    )