"""对话会话持久化服务。"""

from __future__ import annotations

import re

from sqlalchemy.ext.asyncio import AsyncSession

from ..repositories import chat_session_repo
from ..responses import AppError, ErrorCode
from ..utils import iso

SESSION_KEY_RE = re.compile(r"^[a-z][a-z0-9_]{1,63}$")


def validate_session_key(session_key: str) -> None:
    if session_key == "__draft__":
        return
    if not SESSION_KEY_RE.match(session_key or ""):
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            "sessionKey 必须为 __draft__ 或匹配 ^[a-z][a-z0-9_]{1,63}$",
        )


def session_title(messages: list) -> str:
    for message in messages or []:
        if isinstance(message, dict) and message.get("role") == "user":
            content = str(message.get("content") or "").strip()
            if content:
                return content.splitlines()[0][:30]
    return "新会话"


def serialize(model) -> dict:
    return {
        "sessionKey": model.session_key,
        "messages": model.messages or [],
        "schemaJson": model.schema_json or "",
        "title": session_title(model.messages or []),
        "createdAt": iso(model.created_at),
        "updatedAt": iso(model.updated_at),
    }


async def list_sessions(db: AsyncSession) -> list[dict]:
    models = await chat_session_repo.list_all(db)
    return [serialize(m) for m in models]


async def get_session(db: AsyncSession, session_key: str) -> dict:
    validate_session_key(session_key)
    model = await chat_session_repo.get(db, session_key)
    if model is None:
        raise AppError(ErrorCode.VALIDATION_ERROR, f"会话 {session_key} 不存在")
    return serialize(model)


async def save_session(db: AsyncSession, session_key: str, body: dict) -> dict:
    validate_session_key(session_key)
    messages = body.get("messages")
    if not isinstance(messages, list):
        raise AppError(ErrorCode.VALIDATION_ERROR, "messages 必须是数组")
    schema_json = body.get("schemaJson") or ""
    if not isinstance(schema_json, str):
        raise AppError(ErrorCode.VALIDATION_ERROR, "schemaJson 必须是字符串")
    model = await chat_session_repo.upsert(db, session_key, messages, schema_json)
    await db.commit()
    await db.refresh(model)
    return serialize(model)


async def delete_session(db: AsyncSession, session_key: str) -> None:
    validate_session_key(session_key)
    await chat_session_repo.delete_session(db, session_key)
    await db.commit()
