import argparse
import asyncio
import re

from sqlalchemy import select

from app.core.database import (
    get_engine,
    get_session_factory,
)
from app.models.tenant import Tenant
from app.services.api_key_service import create_api_key


SLUG_PATTERN = re.compile(
    r"^[a-z0-9][a-z0-9-]{2,99}$"
)


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Create a SmartCommerce AI tenant "
            "and its first API key."
        )
    )
    parser.add_argument(
        "--name",
        required=True,
        help="Customer platform name.",
    )
    parser.add_argument(
        "--slug",
        required=True,
        help="Stable lowercase tenant identifier.",
    )
    parser.add_argument(
        "--key-name",
        default="development",
        help="Human-readable API key name.",
    )

    return parser.parse_args()


async def provision_tenant(
    name: str,
    slug: str,
    key_name: str,
) -> None:
    normalized_name = name.strip()
    normalized_slug = slug.strip().lower()
    normalized_key_name = key_name.strip()

    if not normalized_name:
        raise ValueError("Tenant name cannot be empty.")

    if not SLUG_PATTERN.fullmatch(normalized_slug):
        raise ValueError(
            "Slug must contain only lowercase letters, "
            "digits and hyphens."
        )

    if not normalized_key_name:
        raise ValueError("API key name cannot be empty.")

    session_factory = get_session_factory()

    async with session_factory() as session:
        try:
            existing_tenant = await session.scalar(
                select(Tenant).where(
                    Tenant.slug == normalized_slug
                )
            )

            if existing_tenant is not None:
                raise RuntimeError(
                    "A tenant with this slug already exists."
                )

            tenant = Tenant(
                name=normalized_name,
                slug=normalized_slug,
            )
            session.add(tenant)
            await session.flush()

            api_key, plain_text = await create_api_key(
                session=session,
                tenant_id=tenant.id,
                name=normalized_key_name,
            )

            await session.commit()

            print()
            print("Tenant created successfully.")
            print(f"Tenant ID: {tenant.id}")
            print(f"Tenant slug: {tenant.slug}")
            print(f"API key prefix: {api_key.key_prefix}")
            print()
            print("API KEY - DISPLAYED ONCE:")
            print(plain_text)
            print()
            print(
                "Store this key securely. "
                "It cannot be recovered from the database."
            )
        except Exception:
            await session.rollback()
            raise


async def main() -> None:
    arguments = parse_arguments()

    try:
        await provision_tenant(
            name=arguments.name,
            slug=arguments.slug,
            key_name=arguments.key_name,
        )
    finally:
        await get_engine().dispose()


if __name__ == "__main__":
    asyncio.run(main())