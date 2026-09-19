from typing import Literal

from pydantic import BaseModel, Field


AssistantGenerationStatus = Literal["ok", "error"]


class AssistantGenerationRequest(BaseModel):
    question: str = Field(
        min_length=5,
        max_length=2000,
    )
    context: str = Field(
        min_length=1,
        max_length=30000,
    )
    intent: str | None = Field(
        default=None,
        max_length=100,
    )


class AssistantGenerationResponse(BaseModel):
    status: AssistantGenerationStatus
    answer: str | None = None
    llm_provider: str
    llm_model: str
    error_code: str | None = None