from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    summary="Vérifier l’état du service IA",
)
def health_check() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "smartcommerce-ai-service",
        "version": "0.1.0",
    }