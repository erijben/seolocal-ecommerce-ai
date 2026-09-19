from typing import Literal

from pydantic import BaseModel, Field


ChatRole = Literal["system", "user", "assistant"]

LlmPurpose = Literal[
    "assistant",
    "rag_answer",
    "report",
    "tool_routing",
]

LlmStatus = Literal["ok", "error"]


class ChatMessage(BaseModel):
    role: ChatRole
    content: str = Field(min_length=1)


class LlmResult(BaseModel):
    status: LlmStatus
    provider: str
    model: str
    content: str | None = None
    error_code: str | None = None
    latency_ms: int | None = None