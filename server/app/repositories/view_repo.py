"""view_config 数据访问（版本化，前滚回滚，级联删）。"""

from __future__ import annotations

from sqlalchemy import and_, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import ViewConfigModel


async def _max_version(session: AsyncSession, view_key: str) -> int:
    result = await session.execute(
        select(func.max(ViewConfigModel.version)).where(ViewConfigModel.view_key == view_key)
    )
    return result.scalar() or 0


async def publish(
    session: AsyncSession, mapping: dict, status: str = "published"
) -> ViewConfigModel:
    view_key = mapping["viewKey"]
    version = await _max_version(session, view_key) + 1
    model = ViewConfigModel(
        view_key=view_key,
        version=version,
        form_key=mapping["formKey"],
        title=mapping["title"],
        description=mapping.get("description") or "",
        mapping_json=mapping,
        status=status,
    )
    session.add(model)
    await session.flush()
    await session.refresh(model)
    return model


async def latest(session: AsyncSession, view_key: str) -> ViewConfigModel | None:
    result = await session.execute(
        select(ViewConfigModel)
        .where(ViewConfigModel.view_key == view_key, ViewConfigModel.status == "published")
        .order_by(ViewConfigModel.version.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_version(
    session: AsyncSession, view_key: str, version: int
) -> ViewConfigModel | None:
    result = await session.execute(
        select(ViewConfigModel).where(
            ViewConfigModel.view_key == view_key, ViewConfigModel.version == version
        )
    )
    return result.scalar_one_or_none()


async def versions(session: AsyncSession, view_key: str) -> list[ViewConfigModel]:
    result = await session.execute(
        select(ViewConfigModel)
        .where(ViewConfigModel.view_key == view_key)
        .order_by(ViewConfigModel.version.desc())
    )
    return list(result.scalars().all())


async def list_latest(
    session: AsyncSession, form_key: str | None = None
) -> list[ViewConfigModel]:
    subq = (
        select(
            ViewConfigModel.view_key.label("view_key"),
            func.max(ViewConfigModel.version).label("max_version"),
        )
        .group_by(ViewConfigModel.view_key)
        .subquery()
    )
    stmt = select(ViewConfigModel).join(
        subq,
        and_(
            ViewConfigModel.view_key == subq.c.view_key,
            ViewConfigModel.version == subq.c.max_version,
        ),
    )
    if form_key:
        stmt = stmt.where(ViewConfigModel.form_key == form_key)
    stmt = stmt.order_by(ViewConfigModel.updated_at.desc())
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def delete_all(session: AsyncSession, view_key: str) -> int:
    result = await session.execute(
        delete(ViewConfigModel).where(ViewConfigModel.view_key == view_key)
    )
    return result.rowcount or 0
