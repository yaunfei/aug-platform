"""CSV 流式导出：UTF-8 BOM + 50000 行上限。"""

from __future__ import annotations

import csv
import io
import json
from datetime import datetime, timezone
from urllib.parse import quote

from sqlalchemy.ext.asyncio import AsyncSession

from ..contracts import flatten_columns
from ..repositories import record_repo

MAX_EXPORT_ROWS = 50000


def _columns_for_export(schema: dict) -> list[dict]:
    return flatten_columns(schema.get("columns") or [])


def build_header(schema: dict) -> list[str]:
    titles = [str(col.get("title") or col.get("dataIndex")) for col in _columns_for_export(schema)]
    return titles + ["id", "createdAt"]


def _date_range_text(value) -> str:
    if isinstance(value, (list, tuple)) and len(value) >= 2:
        return f"{value[0] or ''} ~ {value[1] or ''}"
    return "" if value is None else str(value)


def render_cell(col: dict, data: dict):
    value = data.get(col.get("dataIndex"))
    if value is None:
        return ""
    value_type = col.get("valueType")
    if value_type == "dateRange":
        return _date_range_text(value)
    enum = col.get("valueEnum") or {}
    if enum:
        if isinstance(value, (list, tuple)):
            texts = []
            for item in value:
                entry = enum.get(str(item))
                texts.append(entry.get("text", str(item)) if isinstance(entry, dict) else str(item))
            return "、".join(texts)
        entry = enum.get(str(value))
        if isinstance(entry, dict):
            return entry.get("text", str(value))
    if value_type == "formList":
        if isinstance(value, list):
            return json.dumps(value, ensure_ascii=False)
        return str(value)
    if isinstance(value, bool):
        return "是" if value else "否"
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return value


def export_filename(form_key: str) -> str:
    return f"{form_key}_{datetime.now().strftime('%Y%m%d%H%M')}.csv"


def content_disposition(form_key: str) -> str:
    filename = export_filename(form_key)
    return f"attachment; filename=\"{filename}\"; filename*=UTF-8''{quote(filename)}"


async def stream_csv(
    db: AsyncSession,
    form_key: str,
    schema: dict,
    start_time=None,
    end_time=None,
    keyword: str | None = None,
    filters: dict | None = None,
):
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    buffer.write("\ufeff")
    writer.writerow(build_header(schema))
    columns = _columns_for_export(schema)
    emitted = 0
    yield buffer.getvalue()
    buffer.seek(0)
    buffer.truncate(0)
    async for batch in record_repo.iter_records(
        db,
        form_key,
        start_time=start_time,
        end_time=end_time,
        keyword=keyword,
        filters=filters,
        batch_size=500,
    ):
        for record in batch:
            if emitted >= MAX_EXPORT_ROWS:
                if buffer.tell():
                    yield buffer.getvalue()
                return
            row = [render_cell(col, record.data or {}) for col in columns]
            created = record.created_at
            if created is not None and created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            row.extend([record.id, created.isoformat() if created else ""])
            writer.writerow(row)
            emitted += 1
        yield buffer.getvalue()
        buffer.seek(0)
        buffer.truncate(0)
