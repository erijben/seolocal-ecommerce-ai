from collections.abc import AsyncIterator
from functools import lru_cache


from sqlalchemy import URL, text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


def build_database_url() -> URL:
    settings = get_settings()

    if settings.postgres_password is None:
        raise RuntimeError(
            "PostgreSQL password is not configured."
        )

    password = settings.postgres_password.get_secret_value()

    if not password:
        raise RuntimeError(
            "PostgreSQL password is not configured."
        )

    return URL.create( #encode correctement les caractères spéciaux du mot de passe ;
        drivername="postgresql+asyncpg",
        username=settings.postgres_user,
        password=password,
        host=settings.postgres_host,
        port=settings.postgres_port,
        database=settings.postgres_db,
    )


@lru_cache
def get_engine() -> AsyncEngine:
    engine = create_async_engine(
        build_database_url(),
        pool_pre_ping=True,  #détecte les connexions PostgreSQL devenues invalides ;
        echo=False,
    )

    return engine


@lru_cache
def get_session_factory() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(
        bind=get_engine(),
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )


async def get_db_session() -> AsyncIterator[AsyncSession]:
    session_factory = get_session_factory()

    async with session_factory() as session:
        yield session


async def check_database_connection() -> bool:
    async with get_engine().connect() as connection:
        await connection.execute(text("SELECT 1"))

    return True