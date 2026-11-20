"""chat_session 数据访问。"""

from __future__ import annotations

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import ChatSessionModel


async def get(session: AsyncSession, session_key: str) -> ChatSessionModel | None:
    result = await session.execute(
        select(ChatSessionModel).where(ChatSessionModel.session_key == session_key)
    )
    return result.scalar_one_or_none()


async def list_all(session: AsyncSession) -> list[ChatSessionModel]:
    result = await session.execute(
        select(ChatSessionModel).order_by(ChatSessionModel.updated_at.desc())
    )
    return list(result.scalars().all())


async def upsert(
    session: AsyncSession, session_key: str, messages: list, schema_json: str
) -> ChatSessionModel:
    model = await get(session, session_key)
    if model is None:
        model = ChatSessionModel(
            session_key=session_key, messages=messages, schema_json=schema_json
        )
        session.add(model)
    else:
        model.messages = messages
        model.schema_json = schema_json
        model.updated_at = func.now()
    await session.flush()
    await session.refresh(model)
    return model


async def delete_session(session: AsyncSession, session_key: str) -> int:
    result = await session.execute(
        delete(ChatSessionModel).where(ChatSessionModel.session_key == session_key)
    )
    return result.rowcount or 0
