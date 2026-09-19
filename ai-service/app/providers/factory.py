from functools import lru_cache

from app.core.config import Settings, get_settings
from app.providers.manager import LlmProviderManager
from app.providers.ollama_cloud import OllamaCloudProvider
from app.providers.ollama_local import OllamaLocalProvider


def build_llm_provider_manager( #permet aux tests de créer un gestionnaire avec une configuration temporaire sans modifier .env.
    settings: Settings | None = None,
) -> LlmProviderManager:
    resolved_settings = settings or get_settings()

    providers = [
        OllamaLocalProvider(resolved_settings),
        OllamaCloudProvider(resolved_settings),
    ]

    return LlmProviderManager(
        providers=providers,
        settings=resolved_settings,
    )


@lru_cache
def get_llm_provider_manager() -> LlmProviderManager: #retourne une instance réutilisable par FastAPI.
    return build_llm_provider_manager()