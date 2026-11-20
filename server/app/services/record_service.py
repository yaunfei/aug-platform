"""记录业务逻辑。"""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from ..models import FormRecordModel
from ..repositories import record_repo, schema_repo
from ..responses import AppError, ErrorCode
from ..utils import iso

MAX_EXPORT_ROWS = 50000


def serialize_record(model: FormRecordModel) -> dict:
    return {
        "id": model.id,
        "formKey": model.form_key,
        "schemaVersion": model.schema_version,
        "data": model.data or {},
        "createdBy": model.created_by,
        "createdAt": iso(model.created_at),
        "updatedAt": iso(model.updated_at),
    }


async def submit_record(db: AsyncSession, form_key: str, data: Any) -> dict:
    if not isinstance(data, dict):
        raise AppError(ErrorCode.VALIDATION_ERROR, "提交内容必须是 JSON 对象")
    latest = await schema_repo.latest(db, form_key)
    if latest is None:
        raise AppError(ErrorCode.SCHEMA_NOT_FOUND, f"表单 {form_key} 未发布，无法提交")
    model = await record_repo.create(db, form_key, latest.version, data)
    await db.commit()
    await db.refresh(model)
    return serialize_record(model)


async def list_records(
    db: AsyncSession,
    form_key: str,
    current: int = 1,
    page_size: int = 20,
    start_time=None,
    end_time=None,
    keyword: str | None = None,
    filters: dict | None = None,
) -> dict:
    rows, total = await record_repo.query(
        db,
        form_key,
        current=current,
        page_size=page_size,
        start_time=start_time,
        end_time=end_time,
        keyword=keyword,
        filters=filters,
    )
    return {
        "data": [serialize_record(r) for r in rows],
        "total": total,
        "current": max(1, int(current or 1)),
        "pageSize": record_repo.normalize_paging(current, page_size)[1],
    }


async def get_record(db: AsyncSession, form_key: str, record_id: int) -> dict:
    model = await record_repo.get(db, form_key, record_id)
    if model is None:
        raise AppError(ErrorCode.RECORD_NOT_FOUND, f"记录 {record_id} 不存在")
    return {"record": serialize_record(model), "schemaVersion": model.schema_version}


async def update_record(db: AsyncSession, form_key: str, record_id: int, data: Any) -> dict:
    if not isinstance(data, dict):
        raise AppError(ErrorCode.VALIDATION_ERROR, "更新内容必须是 JSON 对象")
    model = await record_repo.get(db, form_key, record_id)
    if model is None:
        raise AppError(ErrorCode.RECORD_NOT_FOUND, f"记录 {record_id} 不存在")
    await record_repo.update(db, model, data)
    await db.commit()
    await db.refresh(model)
    return serialize_record(model)


async def delete_record(db: AsyncSession, form_key: str, record_id: int) -> None:
    model = await record_repo.get(db, form_key, record_id)
    if model is None:
        raise AppError(ErrorCode.RECORD_NOT_FOUND, f"记录 {record_id} 不存在")
    await record_repo.delete_record(db, model)
    await db.commit()
