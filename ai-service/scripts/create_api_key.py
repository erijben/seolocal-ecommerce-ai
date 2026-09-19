import argparse
import asyncio
from pathlib import Path

from sqlalchemy import select

from app.core.database import (
    get_engine,
    get_session_factory,
)
from app.models.api_key import ApiKey
from app.models.tenant import Tenant
from app.services.api_key_service import create_api_key


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Create an API key for an existing tenant "
            "and write it to a local protected file."
        )
    )
    parser.add_argument(
        "--tenant-slug",
        required=True,
    )
    parser.add_argument(
        "--key-name",
        required=True,
    )
    parser.add_argument(
        "--output",
        required=True,
        help=(
            "Local output file. The file must not already exist."
        ),
    )

    return parser.parse_args()


async def create_key_for_tenant(
    tenant_slug: str,
    key_name: str,
    output_path: str,
) -> None:
    normalized_slug = tenant_slug.strip().lower()
    normalized_key_name = key_name.strip()
    destination = Path(output_path).resolve()

    if not normalized_slug:
        raise ValueError("Tenant slug cannot be empty.")

    if not normalized_key_name:
        raise ValueError("API key name cannot be empty.")

    if destination.exists():
        raise RuntimeError(
            "Output file already exists. Refusing to overwrite it."
        )

    session_factory = get_session_factory()
    file_created = False

    async with session_factory() as session:
        try:
            tenant = await session.scalar(
                select(Tenant).where(
                    Tenant.slug == normalized_slug
                )
            )

            if tenant is None:
                raise RuntimeError("Tenant not found.")

            existing_key = await session.scalar(
                select(ApiKey).where(
                    ApiKey.tenant_id == tenant.id,
                    ApiKey.name == normalized_key_name,
                )
            )

            if existing_key is not None:
                raise RuntimeError(
                    "An API key with this name already exists."
                )

            api_key, plain_text = await create_api_key(
                session=session,
                tenant_id=tenant.id,
                name=normalized_key_name,
            )

            destination.parent.mkdir(
                parents=True,
                exist_ok=True,
            )

            with destination.open(
                mode="x",
                encoding="utf-8",
                newline="\n",
            ) as output_file:
                output_file.write(plain_text)
                output_file.write("\n")

            file_created = True
            plain_text = ""

            await session.commit()

            print("API key created successfully.")
            print(f"Tenant slug: {tenant.slug}")
            print(f"API key prefix: {api_key.key_prefix}")
            print(f"Secret written to: {destination}")
            print("The complete key was not displayed.")
        except Exception:
            await session.rollback()

            if file_created and destination.exists():
                destination.unlink()

            raise


async def main() -> None:
    arguments = parse_arguments()

    try:
        await create_key_for_tenant(
            tenant_slug=arguments.tenant_slug,
            key_name=arguments.key_name,
            output_path=arguments.output,
        )
    finally:
        await get_engine().dispose()


if __name__ == "__main__":
    asyncio.run(main())