"""pytest 全局夹具：SQLite 独立测试库 + mock AI + ASGI 客户端。"""

from __future__ import annotations

import os
import uuid
from pathlib import Path

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:////tmp/aug_platform_test.db")
os.environ.setdefault("AI_PROVIDER", "mock")
os.environ.setdefault("AUTH_ENABLED", "false")
os.environ.setdefault("WEBHOOK_ENABLED", "false")
os.environ.setdefault("LOG_LEVEL", "WARNING")

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import delete  # noqa: E402

from app.config import settings  # noqa: E402
from app.db import engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import (  # noqa: E402
    ChatSessionModel,
    FormRecordModel,
    FormSchemaModel,
    ViewConfigModel,
    Base,
)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _database():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture(autouse=True)
async def _clean_tables():
    async with engine.begin() as conn:
        for model in (FormRecordModel, FormSchemaModel, ChatSessionModel, ViewConfigModel):
            await conn.execute(delete(model))
    yield


@pytest.fixture(autouse=True)
def _mock_ai(monkeypatch):
    monkeypatch.setattr(settings, "ai_provider", "mock")
    monkeypatch.setattr(settings, "auth_enabled", False)
    monkeypatch.setattr(settings, "webhook_enabled", False)
    yield


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as http:
        yield http


@pytest.fixture
def form_key_factory():
    def make(prefix: str = "test") -> str:
        return f"{prefix}_{uuid.uuid4().hex[:8]}"

    return make


@pytest.fixture
def upload_dir(tmp_path, monkeypatch):
    from app.routers import upload as upload_router

    target = Path(tmp_path) / "uploads"
    target.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(
        upload_router, "uploads_dir", lambda: target
    )
    return target
