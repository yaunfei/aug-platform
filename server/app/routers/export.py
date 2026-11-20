"""CSV 流式导出端点。"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import SessionLocal, get_db
from ..repositories import record_repo
from ..services import export_service, schema_service
from ..utils import parse_filters, parse_iso_datetime

router = APIRouter(prefix="/api/form", tags=["export"])


@router.get("/{form_key}/export")
async def export_csv(
    form_key: str,
    startTime: str | None = Query(default=None),
    endTime: str | None = Query(default=None),
    keyword: str | None = Query(default=None),
    filters: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    schema_data = await schema_service.get_schema(db, form_key)
    schema = schema_data["schema"]
    parsed_filters = parse_filters(filters)
    parsed_start = parse_iso_datetime(startTime, "startTime")
    parsed_end = parse_iso_datetime(endTime, "endTime")
    total = await record_repo.count(
        db,
        form_key,
        start_time=parsed_start,
        end_time=parsed_end,
        keyword=keyword,
        filters=parsed_filters,
    )

    async def generator():
        async with SessionLocal() as stream_db:
            async for chunk in export_service.stream_csv(
                stream_db,
                form_key,
                schema,
                start_time=parsed_start,
                end_time=parsed_end,
                keyword=keyword,
                filters=parsed_filters,
            ):
                yield chunk

    headers = {
        "Content-Disposition": export_service.content_disposition(form_key),
        "Cache-Control": "no-cache, no-transform",
    }
    if total > export_service.MAX_EXPORT_ROWS:
        headers["X-Truncated"] = "true"
    return StreamingResponse(
        generator(),
        media_type="text/csv; charset=utf-8",
        headers=headers,
    )
