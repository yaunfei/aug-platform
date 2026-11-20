"""form_record 数据访问：三件套过滤语义（时间 / keyword / filters）。"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import Select, Text, cast, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import FormRecordModel

MAX_PAGE_SIZE = 200
MAX_FILTER_FIELDS = 20


def _dialect(session: AsyncSession) -> str:
    try:
        return session.get_bind().dialect.name
    except Exception:  # pragma: no cover
        return "postgresql"


def normalize_paging(current: int | None, page_size: int | None) -> tuple[int, int]:
    current = max(1, int(current or 1))
    page_size = int(page_size or 20)
    page_size = max(1, min(MAX_PAGE_SIZE, page_size))
    return current, page_size


def split_filters(filters: dict[str, Any] | None) -> dict[str, Any]:
    """空字符串跳过，最多 20 字段，值仅 str/int/float/bool。"""
    if not filters:
        return {}
    cleaned: dict[str, Any] = {}
    for key, value in filters.items():
        if len(cleaned) >= MAX_FILTER_FIELDS:
            break
        if value is None or value == "":
            continue
        if isinstance(value, (str, bool, int, float)):
            cleaned[str(key)] = value
    return cleaned


def build_conditions(
    session: AsyncSession,
    form_key: str,
    start_time: datetime | None = None,
    end_time: datetime | None = None,
    keyword: str | None = None,
    filters: dict[str, Any] | None = None,
) -> list:
    conditions = [FormRecordModel.form_key == form_key]
    if start_time is not None:
        conditions.append(FormRecordModel.created_at >= start_time)
    if end_time is not None:
        conditions.append(FormRecordModel.created_at <= end_time)
    if keyword:
        conditions.append(cast(FormRecordModel.data, Text).ilike(f"%{keyword}%"))
    dialect = _dialect(session)
    for field, value in split_filters(filters).items():
        if isinstance(value, str):
            conditions.append(FormRecordModel.data[field].as_string().ilike(f"%{value}%"))
        elif isinstance(value, bool):
            if dialect == "postgresql":
                conditions.append(
                    FormRecordModel.data.op("@>")(func.jsonb_build_object(field, value))
                )
            else:
                conditions.append(FormRecordModel.data[field].as_boolean() == value)
        else:
            if dialect == "postgresql":
                conditions.append(
                    FormRecordModel.data.op("@>")(func.jsonb_build_object(field, value))
                )
            else:
                conditions.append(FormRecordModel.data[field].as_float() == float(value))
    return conditions


def _base_select(session: AsyncSession, **kwargs: Any) -> Select:
    return select(FormRecordModel).where(*build_conditions(session, **kwargs))


async def create(
    session: AsyncSession,
    form_key: str,
    schema_version: int,
    data: dict,
    created_by: str | None = None,
) -> FormRecordModel:
    model = FormRecordModel(
        form_key=form_key,
        schema_version=schema_version,
        data=data,
        created_by=created_by,
    )
    session.add(model)
    await session.flush()
    await session.refresh(model)
    return model


async def get(session: AsyncSession, form_key: str, record_id: int) -> FormRecordModel | None:
    result = await session.execute(
        select(FormRecordModel).where(
            FormRecordModel.form_key == form_key, FormRecordModel.id == record_id
        )
    )
    return result.scalar_one_or_none()


async def update(session: AsyncSession, model: FormRecordModel, data: dict) -> FormRecordModel:
    model.data = data
    model.updated_at = func.now()
    await session.flush()
    await session.refresh(model)
    return model


async def delete_record(session: AsyncSession, model: FormRecordModel) -> None:
    await session.delete(model)


async def delete_all(session: AsyncSession, form_key: str) -> int:
    result = await session.execute(
        delete(FormRecordModel).where(FormRecordModel.form_key == form_key)
    )
    return result.rowcount or 0


async def query(
    session: AsyncSession,
    form_key: str,
    current: int = 1,
    page_size: int = 20,
    start_time: datetime | None = None,
    end_time: datetime | None = None,
    keyword: str | None = None,
    filters: dict[str, Any] | None = None,
) -> tuple[list[FormRecordModel], int]:
    current, page_size = normalize_paging(current, page_size)
    kwargs = dict(
        form_key=form_key,
        start_time=start_time,
        end_time=end_time,
        keyword=keyword,
        filters=filters,
    )
    count_stmt = select(func.count()).select_from(
        select(FormRecordModel).where(*build_conditions(session, **kwargs)).subquery()
    )
    total = (await session.execute(count_stmt)).scalar() or 0
    stmt = (
        _base_select(session, **kwargs)
        .order_by(FormRecordModel.created_at.desc(), FormRecordModel.id.desc())
        .offset((current - 1) * page_size)
        .limit(page_size)
    )
    rows = list((await session.execute(stmt)).scalars().all())
    return rows, int(total)


async def count(
    session: AsyncSession,
    form_key: str,
    start_time: datetime | None = None,
    end_time: datetime | None = None,
    keyword: str | None = None,
    filters: dict[str, Any] | None = None,
) -> int:
    kwargs = dict(
        form_key=form_key,
        start_time=start_time,
        end_time=end_time,
        keyword=keyword,
        filters=filters,
    )
    stmt = select(func.count()).select_from(
        select(FormRecordModel).where(*build_conditions(session, **kwargs)).subquery()
    )
    return int((await session.execute(stmt)).scalar() or 0)


async def iter_records(
    session: AsyncSession,
    form_key: str,
    start_time: datetime | None = None,
    end_time: datetime | None = None,
    keyword: str | None = None,
    filters: dict[str, Any] | None = None,
    batch_size: int = 1000,
):
    """导出用逐批迭代（避免全量加载）。"""
    kwargs = dict(
        form_key=form_key,
        start_time=start_time,
        end_time=end_time,
        keyword=keyword,
        filters=filters,
    )
    offset = 0
    while True:
        stmt = (
            _base_select(session, **kwargs)
            .order_by(FormRecordModel.created_at.desc(), FormRecordModel.id.desc())
            .offset(offset)
            .limit(batch_size)
        )
        rows = list((await session.execute(stmt)).scalars().all())
        if not rows:
            break
        yield rows
        offset += len(rows)
