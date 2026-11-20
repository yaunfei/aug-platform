"""记录 CRUD 与查询端点。"""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db import get_db
from ..responses import AppError, ErrorCode, ok, page
from ..services import record_service, schema_service
from ..services.webhook import send_submit_webhook
from ..utils import parse_filters, parse_iso_datetime

router = APIRouter(prefix="/api/form", tags=["record"])


@router.get("/{form_key}/schema")
async def form_schema(form_key: str, version: int | None = Query(default=None), db: AsyncSession = Depends(get_db)):
    return ok(await schema_service.get_schema(db, form_key, version))


@router.post("/{form_key}/submit")
async def submit(
    form_key: str,
    request: Request,
    background: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    payload = await _json_body(request)
    record = await record_service.submit_record(db, form_key, payload)
    if settings.webhook_enabled:
        background.add_task(
            send_submit_webhook,
            {
                "formKey": record["formKey"],
                "recordId": record["id"],
                "schemaVersion": record["schemaVersion"],
                "data": record["data"],
                "createdAt": record["createdAt"],
            },
        )
    return ok(record)


@router.get("/{form_key}/records")
async def list_records(
    form_key: str,
    current: int = Query(default=1),
    pageSize: int = Query(default=20),
    startTime: str | None = Query(default=None),
    endTime: str | None = Query(default=None),
    keyword: str | None = Query(default=None),
    filters: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    result = await record_service.list_records(
        db,
        form_key,
        current=current,
        page_size=pageSize,
        start_time=parse_iso_datetime(startTime, "startTime"),
        end_time=parse_iso_datetime(endTime, "endTime"),
        keyword=keyword,
        filters=parse_filters(filters),
    )
    return page(result["data"], result["total"], result["current"], result["pageSize"])


@router.get("/{form_key}/records/{record_id}")
async def record_detail(form_key: str, record_id: int, db: AsyncSession = Depends(get_db)):
    return ok(await record_service.get_record(db, form_key, record_id))


@router.put("/{form_key}/records/{record_id}")
async def update_record(
    form_key: str, record_id: int, request: Request, db: AsyncSession = Depends(get_db)
):
    payload = await _json_body(request)
    return ok(await record_service.update_record(db, form_key, record_id, payload))


@router.delete("/{form_key}/records/{record_id}")
async def delete_record(form_key: str, record_id: int, db: AsyncSession = Depends(get_db)):
    await record_service.delete_record(db, form_key, record_id)
    return ok({"deleted": True})


async def _json_body(request: Request):
    try:
        return await request.json()
    except Exception as exc:  # noqa: BLE001
        raise AppError(ErrorCode.VALIDATION_ERROR, "请求体必须是合法 JSON") from exc
