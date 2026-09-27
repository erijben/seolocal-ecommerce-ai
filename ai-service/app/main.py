from fastapi import FastAPI

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.request_id import RequestIdMiddleware

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description=(
        "Service IA indépendant pour les plateformes e-commerce."
    ),
    version=settings.app_version,
)

app.include_router(
    api_router,
    prefix="/api/v1",
)

app.add_middleware(
    RequestIdMiddleware,
    service_name="smartcommerce-ai-service",
)
