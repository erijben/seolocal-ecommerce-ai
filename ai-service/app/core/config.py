from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict
from app.embeddings.constants import EMBEDDING_DIMENSIONS


EnvironmentName = Literal["local", "test", "production"]
LlmProviderName = Literal["ollama_local", "ollama_cloud"]
EmbeddingProviderName = Literal["ollama_local"]


class Settings(BaseSettings):
    app_name: str = "SmartCommerce AI Service"
    app_version: str = "0.1.0"
    environment: EnvironmentName = "local"

    postgres_host: str = "127.0.0.1"
    postgres_port: int = Field(
        default=5433,
        ge=1,
        le=65535,
    )
    postgres_db: str = "smartcommerce_ai"
    postgres_user: str = "smartcommerce_ai"
    postgres_password: SecretStr | None = None

    embedding_provider: EmbeddingProviderName = "ollama_local"
    embedding_model: str = "embeddinggemma"
    embedding_dimensions: int = Field(
        default=EMBEDDING_DIMENSIONS,
        ge=1,
        le=4096,
    )
    embedding_batch_size: int = Field(
        default=16,
        ge=1,
        le=128,
    )
    embedding_connect_timeout_seconds: float = Field(
        default=3.0,
        gt=0,
        le=60,
    )
    embedding_read_timeout_seconds: float = Field(
        default=120.0,
        gt=0,
        le=600,
    )

    rag_chunk_size_chars: int = Field(
        default=1200,
        ge=200,
        le=8000,
    )
    rag_chunk_overlap_chars: int = Field(
        default=200,
        ge=0,
        le=2000,
    )
    rag_min_chunk_size_chars: int = Field(
        default=80,
        ge=1,
        le=1000,
    )
    # Explicit limits prevent oversized or abnormal PDF uploads.
    rag_max_upload_bytes: int = Field(
        default=20_971_520,
        ge=1024,
        le=104_857_600,
    )
    rag_max_pdf_pages: int = Field(
        default=200,
        ge=1,
        le=2000,
    )
    rag_min_extracted_chars: int = Field(
        default=50,
        ge=1,
        le=10_000,
    )
    rag_top_k: int = Field(
        default=5,
        ge=1,
        le=20,
    )

    rag_min_score: float = Field(
        default=0.40,
        ge=0.0,
        le=1.0,
    )

    llm_provider: LlmProviderName = "ollama_cloud"
    # Provider fallback is opt-in to prevent implicit data transfers.
    allow_provider_fallback: bool = False
    llm_fallback_provider: LlmProviderName | None = None
    ollama_local_base_url: str = "http://127.0.0.1:11434"
    ollama_cloud_base_url: str = "https://ollama.com"
    ollama_local_model: str = "llama3.2:1b"
    ollama_cloud_model: str = "gpt-oss:20b"
    ollama_api_key: SecretStr | None = None
    ollama_connect_timeout_seconds: float = Field(
        default=3.0,
        gt=0,
        le=60,
    )
    ollama_read_timeout_seconds: float = Field(
        default=120.0,
        gt=0,
        le=600,
    )

    ollama_temperature: float = Field(
        default=0.2,
        ge=0,
        le=2,
    )
    ollama_num_predict: int = Field(
        default=1200,
        ge=1,
        le=8192,
    )
    ollama_num_ctx: int = Field(
        default=4096,
        ge=512,
        le=131072,
    )
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="SMARTCOMMERCE_AI_",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
