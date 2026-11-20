"""Schema 管理 REST 端点。"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from .. import registry
from ..db import get_db
from ..responses import AppError, ErrorCode, ok
from ..services import schema_service
from ..utils import parse_iso_datetime

router = APIRouter(prefix="/api/schema", tags=["schema"])


@router.get("/components")
async def components():
    return ok({"components": registry.public_components()})


@router.get("")
async def list_schemas(
    formKey: str | None = Query(default=None),
    title: str | None = Query(default=None),
    startTime: str | None = Query(default=None),
    endTime: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    items = await schema_service.list_schemas(
        db,
        form_key=formKey,
        title=title,
        start_time=parse_iso_datetime(startTime, "startTime"),
        end_time=parse_iso_datetime(endTime, "endTime"),
    )
    return ok(items)


@router.post("/{form_key}/publish")
async def publish(form_key: str, request: Request, db: AsyncSession = Depends(get_db)):
    raw = await _json_body(request)
    return ok(await schema_service.publish_schema(db, form_key, raw))


@router.get("/{form_key}/versions")
async def versions(form_key: str, db: AsyncSession = Depends(get_db)):
    return ok(await schema_service.list_versions(db, form_key))


@router.post("/{form_key}/rollback")
async def rollback(form_key: str, request: Request, db: AsyncSession = Depends(get_db)):
    raw = await _json_body(request)
    version = raw.get("version")
    if not isinstance(version, int):
        raise AppError(ErrorCode.VALIDATION_ERROR, "version 必须是整数")
    return ok(await schema_service.rollback(db, form_key, version))


@router.delete("/{form_key}")
async def delete_schema(form_key: str, db: AsyncSession = Depends(get_db)):
    await schema_service.delete_schema(db, form_key)
    return ok({"deleted": True})


async def _json_body(request: Request) -> dict:
    try:
        raw = await request.json()
    except Exception as exc:  # noqa: BLE001
        raise AppError(ErrorCode.VALIDATION_ERROR, "请求体必须是合法 JSON") from exc
    if not isinstance(raw, dict):
        raise AppError(ErrorCode.VALIDATION_ERROR, "请求体必须是 JSON 对象")
    return raw
