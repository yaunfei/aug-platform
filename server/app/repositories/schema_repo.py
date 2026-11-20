"""form_schema 数据访问。"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import and_, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import FormSchemaModel


async def _max_version(db: AsyncSession, form_key: str) -> int:
    result = await db.execute(
        select(func.max(FormSchemaModel.version)).where(FormSchemaModel.form_key == form_key)
    )
    return result.scalar() or 0


async def publish(
    db: AsyncSession, form_key: str, schema_json: dict, status: str = "published"
) -> FormSchemaModel:
    version = await _max_version(db, form_key) + 1
    model = FormSchemaModel(
        form_key=form_key,
        version=version,
        schema_json=schema_json,
        status=status,
    )
    db.add(model)
    await db.flush()
    return model


async def latest(db: AsyncSession, form_key: str) -> FormSchemaModel | None:
    result = await db.execute(
        select(FormSchemaModel)
        .where(FormSchemaModel.form_key == form_key, FormSchemaModel.status == "published")
        .order_by(FormSchemaModel.version.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_version(db: AsyncSession, form_key: str, version: int) -> FormSchemaModel | None:
    result = await db.execute(
        select(FormSchemaModel).where(
            FormSchemaModel.form_key == form_key, FormSchemaModel.version == version
        )
    )
    return result.scalar_one_or_none()


async def list_versions(db: AsyncSession, form_key: str) -> list[FormSchemaModel]:
    result = await db.execute(
        select(FormSchemaModel)
        .where(FormSchemaModel.form_key == form_key)
        .order_by(FormSchemaModel.version.desc())
    )
    return list(result.scalars().all())


async def all_versions(db: AsyncSession, form_key: str) -> list[FormSchemaModel]:
    result = await db.execute(
        select(FormSchemaModel)
        .where(FormSchemaModel.form_key == form_key)
        .order_by(FormSchemaModel.version.asc())
    )
    return list(result.scalars().all())


async def list_latest(
    db: AsyncSession,
    form_key: str | None = None,
    title: str | None = None,
    start_time: datetime | None = None,
    end_time: datetime | None = None,
) -> list[FormSchemaModel]:
    subq = (
        select(
            FormSchemaModel.form_key.label("form_key"),
            func.max(FormSchemaModel.version).label("max_version"),
        )
        .group_by(FormSchemaModel.form_key)
        .subquery()
    )
    stmt = select(FormSchemaModel).join(
        subq,
        and_(
            FormSchemaModel.form_key == subq.c.form_key,
            FormSchemaModel.version == subq.c.max_version,
        ),
    )
    if form_key:
        stmt = stmt.where(FormSchemaModel.form_key.ilike(f"%{form_key}%"))
    if title:
        stmt = stmt.where(FormSchemaModel.schema_json["title"].as_string().ilike(f"%{title}%"))
    if start_time:
        stmt = stmt.where(FormSchemaModel.created_at >= start_time)
    if end_time:
        stmt = stmt.where(FormSchemaModel.created_at <= end_time)
    stmt = stmt.order_by(FormSchemaModel.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def delete_all(db: AsyncSession, form_key: str) -> int:
    result = await db.execute(
        delete(FormSchemaModel).where(FormSchemaModel.form_key == form_key)
    )
    return result.rowcount or 0
