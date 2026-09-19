from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.api_key import ApiKey
from app.security.api_keys import (
    API_KEY_PREFIX,
    generate_api_key,
    hash_api_key,
)


async def create_api_key(
    session: AsyncSession,
    tenant_id: UUID,
    name: str,
    expires_at: datetime | None = None,
) -> tuple[ApiKey, str]:
    generated_key = generate_api_key()

    api_key = ApiKey(
        tenant_id=tenant_id,
        name=name,
        key_prefix=generated_key.prefix,
        key_hash=generated_key.hash,
        expires_at=expires_at,
    )

    session.add(api_key)
    await session.flush()

    return api_key, generated_key.plain_text


async def authenticate_api_key(
    session: AsyncSession,
    plain_text: str,
) -> ApiKey | None:
    if (
        not plain_text.startswith(API_KEY_PREFIX)
        or len(plain_text) < 32
        or len(plain_text) > 128
    ):
        return None

    statement = (
        select(ApiKey)
        .options(selectinload(ApiKey.tenant))
        .where(
            ApiKey.key_hash == hash_api_key(plain_text),
            ApiKey.is_active.is_(True),
            ApiKey.revoked_at.is_(None),
        )
    )

    result = await session.execute(statement)
    api_key = result.scalar_one_or_none()

    if api_key is None:
        return None

    now = datetime.now(timezone.utc)

    if (
        api_key.expires_at is not None
        and api_key.expires_at <= now
    ):
        return None

    if api_key.tenant.status != "active":
        return None

    api_key.last_used_at = now
    await session.commit()

    return api_key