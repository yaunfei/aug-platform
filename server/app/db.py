"""数据库引擎与会话。"""

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from .config import settings


def _create_engine(url: str) -> AsyncEngine:
    kwargs: dict = {"pool_pre_ping": True}
    if url.startswith("sqlite"):
        kwargs = {}
    # 中文关键字检索依赖未转义 JSON 文本（仅 SQLite 存储层受影响）
    kwargs["json_serializer"] = lambda obj: __import__("json").dumps(obj, ensure_ascii=False)
    return create_async_engine(url, **kwargs)


engine: AsyncEngine = _create_engine(settings.sqlalchemy_url)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


def configure_engine(url: str | None = None) -> AsyncEngine:
    """测试用：重建引擎（保持模块级引用）。"""
    global engine, SessionLocal
    engine = _create_engine(url or settings.sqlalchemy_url)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    return engine


async def get_db() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
