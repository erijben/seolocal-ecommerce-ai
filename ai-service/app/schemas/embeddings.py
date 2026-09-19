#le contrat d’embeddings

from typing import Literal

from pydantic import BaseModel, Field


EmbeddingPurpose = Literal["document", "query"]  #document : passages indexés ; query : question recherchée
EmbeddingStatus = Literal["ok", "error"]


class EmbeddingResult(BaseModel):
    status: EmbeddingStatus
    provider: str
    model: str
    dimensions: int
    embeddings: list[list[float]] = Field(
        default_factory=list
    )
    error_code: str | None = None
    latency_ms: int | None = None