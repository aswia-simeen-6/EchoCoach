"""
db.py - Async SQLAlchemy engine + session factory.

Defaults to SQLite (file: echocoach.db next to main.py).
Override with DATABASE_URL env var to use Postgres in production:
  DATABASE_URL=postgresql+asyncpg://user:pass@host/dbname
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from config import settings

_DATABASE_URL = getattr(settings, "database_url", None) or "sqlite+aiosqlite:///./echocoach.db"

engine = create_async_engine(
    _DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False} if "sqlite" in _DATABASE_URL else {},
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def init_db() -> None:
    """Create all tables on startup if they don't exist."""
    async with engine.begin() as conn:
        from models import db_models  # noqa: F401 — registers ORM models
        await conn.run_sync(Base.metadata.create_all)
