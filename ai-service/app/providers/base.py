from abc import ABC, abstractmethod

from app.schemas.llm import ChatMessage, LlmPurpose, LlmResult


class LlmProvider(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        """Retourner le nom technique du provider."""

    @abstractmethod
    async def chat(  #la méthode est async car Les appels Ollama sont des appels réseau. Pendant qu’un provider répond, FastAPI pourra continuer à traiter d’autres requêtes au lieu de bloquer complètement le service.
        self,
        messages: list[ChatMessage],
        *,
        purpose: LlmPurpose,
        request_id: str | None = None,
    ) -> LlmResult:
        """Générer une réponse à partir d’une conversation."""