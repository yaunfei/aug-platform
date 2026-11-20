"""视图映射管理端点。"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..responses import AppError, ErrorCode, ok
from ..services import view_service
from ..services.ai.view_generator import generate_view_mapping

router = APIRouter(prefix="/api/view", tags=["view"])


@router.post("/generate")
async def generate(request: Request, db: AsyncSession = Depends(get_db)):
    body = await _json_body(request)
    doc_text = body.get("docText")
    form_key = body.get("formKey")
    if not isinstance(doc_text, str) or not 1 <= len(doc_text) <= 50000:
        raise AppError(ErrorCode.VALIDATION_ERROR, "docText 必须为 1-50000 字符")
    if not isinstance(form_key, str) or not form_key:
        raise AppError(ErrorCode.VALIDATION_ERROR, "formKey 必填")
    return ok(await generate_view_mapping(db, doc_text, form_key))


@router.get("")
async def list_views(formKey: str | None = Query(default=None), db: AsyncSession = Depends(get_db)):
    return ok(await view_service.list_views(db, formKey))


@router.post("/{view_key}/publish")
async def publish(view_key: str, request: Request, db: AsyncSession = Depends(get_db)):
    return ok(await view_service.publish_view(db, view_key, await _json_body(request)))


@router.get("/{view_key}/versions")
async def versions(view_key: str, db: AsyncSession = Depends(get_db)):
    return ok(await view_service.list_versions(db, view_key))


@router.post("/{view_key}/rollback")
async def rollback(view_key: str, request: Request, db: AsyncSession = Depends(get_db)):
    body = await _json_body(request)
    version = body.get("version")
    if not isinstance(version, int):
        raise AppError(ErrorCode.VALIDATION_ERROR, "version 必须是整数")
    return ok(await view_service.rollback(db, view_key, version))


@router.post("/{view_key}/test")
async def test_view(view_key: str, request: Request, db: AsyncSession = Depends(get_db)):
    return ok(await view_service.test_view(db, view_key, await _json_body(request)))


@router.get("/{view_key}")
async def get_view(view_key: str, db: AsyncSession = Depends(get_db)):
    return ok(await view_service.get_view(db, view_key))


@router.delete("/{view_key}")
async def delete_view(view_key: str, db: AsyncSession = Depends(get_db)):
    await view_service.delete_view(db, view_key)
    return ok({"deleted": True})


async def _json_body(request: Request) -> dict:
    try:
        raw = await request.json()
    except Exception as exc:  # noqa: BLE001
        raise AppError(ErrorCode.VALIDATION_ERROR, "请求体必须是合法 JSON") from exc
    if not isinstance(raw, dict):
        raise AppError(ErrorCode.VALIDATION_ERROR, "请求体必须是 JSON 对象")
    return raw
