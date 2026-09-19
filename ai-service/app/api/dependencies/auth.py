from typing import Annotated

from fastapi import (
    Depends,
    HTTPException,
    Security,
    status,
)
from fastapi.security import APIKeyHeader
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.models.tenant import Tenant
from app.services.api_key_service import authenticate_api_key


api_key_header = APIKeyHeader(
    name="X-API-Key",
    auto_error=False,
)


async def require_tenant(
    api_key: Annotated[
        str | None,
        Security(api_key_header),
    ],
    session: Annotated[
        AsyncSession,
        Depends(get_db_session),
    ],
) -> Tenant:
    if api_key is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key.",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    api_key_record = await authenticate_api_key(
        session=session,
        plain_text=api_key,
    )

    if api_key_record is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key.",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    return api_key_record.tenant