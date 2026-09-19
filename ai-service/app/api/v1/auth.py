from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.dependencies.auth import require_tenant
from app.models.tenant import Tenant


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


class TenantContextResponse(BaseModel):
    tenant_id: UUID
    name: str
    slug: str


@router.get(
    "/context",
    response_model=TenantContextResponse,
    summary="Return the authenticated tenant context",
)
async def get_tenant_context(
    tenant: Annotated[
        Tenant,
        Depends(require_tenant),
    ],
) -> TenantContextResponse:
    return TenantContextResponse(
        tenant_id=tenant.id,
        name=tenant.name,
        slug=tenant.slug,
    )