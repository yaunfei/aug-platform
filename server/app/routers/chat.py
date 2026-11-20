"""对话助手与会话持久化端点。"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import SessionLocal, get_db
from ..responses import AppError, ErrorCode, ok
from ..services import chat_session_service
from ..services.ai.chat import ChatService

router = APIRouter(prefix="/api/assistant", tags=["assistant"])


class ChatMessage(BaseModel):
    role: str
    content: str
    proposedSchema: dict | None = None


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1)
    currentSchema: dict | None = None


@router.post("/chat")
async def chat(body: ChatRequest, db: AsyncSession = Depends(get_db)):
    service = ChatService(db)
    result = await service.handle(
        [m.model_dump(exclude_none=True) for m in body.messages], body.currentSchema
    )
    return ok(result)


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


@router.post("/chat/stream")
async def chat_stream(body: ChatRequest):
    messages = [m.model_dump(exclude_none=True) for m in body.messages]
    current_schema = body.currentSchema

    async def event_source() -> AsyncIterator[str]:
        # 不能使用 Depends(get_db)：会话会在流式响应结束前被关闭
        try:
            async with SessionLocal() as session:
                service = ChatService(session)
                async for event in service.stream(messages, current_schema):
                    if event.get("type") == "final":
                        event = {"type": "final", "data": event.get("data")}
                    yield _sse(event)
        except AppError as exc:
            yield _sse({"type": "error", "errorCode": exc.code, "message": exc.message})
        except Exception as exc:  # noqa: BLE001
            yield _sse({"type": "error", "errorCode": ErrorCode.INTERNAL_ERROR, "message": str(exc)})

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/sessions")
async def list_sessions(db: AsyncSession = Depends(get_db)):
    return ok(await chat_session_service.list_sessions(db))


@router.get("/sessions/{session_key}")
async def get_session(session_key: str, db: AsyncSession = Depends(get_db)):
    return ok(await chat_session_service.get_session(db, session_key))


@router.put("/sessions/{session_key}")
async def save_session(session_key: str, request: Request, db: AsyncSession = Depends(get_db)):
    try:
        body = await request.json()
    except Exception as exc:  # noqa: BLE001
        raise AppError(ErrorCode.VALIDATION_ERROR, "请求体必须是合法 JSON") from exc
    return ok(await chat_session_service.save_session(db, session_key, body or {}))


@router.delete("/sessions/{session_key}")
async def delete_session(session_key: str, db: AsyncSession = Depends(get_db)):
    await chat_session_service.delete_session(db, session_key)
    return ok({"deleted": True})
