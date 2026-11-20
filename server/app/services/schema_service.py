"""Schema 业务逻辑：发布 / 列表 / 版本 / 前滚回滚 / 级联删除。"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from .. import contracts, repositories
from ..contracts import SchemaValidationError
from ..models import FormSchemaModel
from ..repositories import record_repo, schema_repo
from ..responses import AppError, ErrorCode
from ..utils import iso


def serialize_schema(model: FormSchemaModel) -> dict:
    schema = model.schema_json or {}
    return {
        "id": model.id,
        "formKey": model.form_key,
        "title": schema.get("title"),
        "version": model.version,
        "status": model.status,
        "createdAt": iso(model.created_at),
        "schema": schema,
    }


async def publish_schema(db: AsyncSession, form_key: str, raw: dict) -> dict:
    if not isinstance(raw, dict):
        raise AppError(ErrorCode.VALIDATION_ERROR, "Schema 必须是 JSON 对象")
    body_key = raw.get("formKey")
    if body_key != form_key:
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            f"路径 formKey({form_key}) 与请求体 formKey({body_key}) 不一致",
        )
    try:
        schema = contracts.validate_schema(raw)
    except SchemaValidationError as exc:
        raise AppError(ErrorCode.SCHEMA_INVALID, str(exc)) from exc
    model = await schema_repo.publish(db, form_key, contracts.dump_schema(schema))
    await db.commit()
    return serialize_schema(model)


async def list_schemas(
    db: AsyncSession,
    form_key: str | None = None,
    title: str | None = None,
    start_time=None,
    end_time=None,
) -> list[dict]:
    models = await schema_repo.list_latest(
        db, form_key=form_key, title=title, start_time=start_time, end_time=end_time
    )
    return [serialize_schema(m) for m in models]


async def list_versions(db: AsyncSession, form_key: str) -> list[dict]:
    models = await schema_repo.list_versions(db, form_key)
    if not models:
        raise AppError(ErrorCode.SCHEMA_NOT_FOUND, f"表单 {form_key} 不存在")
    return [serialize_schema(m) for m in models]


async def get_schema(db: AsyncSession, form_key: str, version: int | None = None) -> dict:
    if version is not None:
        model = await schema_repo.get_version(db, form_key, version)
        if model is None:
            raise AppError(ErrorCode.SCHEMA_NOT_FOUND, f"表单 {form_key} 版本 {version} 不存在")
        return serialize_schema(model)
    model = await schema_repo.latest(db, form_key)
    if model is None:
        raise AppError(ErrorCode.SCHEMA_NOT_FOUND, f"表单 {form_key} 未发布")
    return serialize_schema(model)


async def rollback(db: AsyncSession, form_key: str, version: int) -> dict:
    target = await schema_repo.get_version(db, form_key, version)
    if target is None:
        raise AppError(ErrorCode.SCHEMA_NOT_FOUND, f"表单 {form_key} 版本 {version} 不存在")
    latest = await schema_repo.latest(db, form_key)
    if latest is not None and target.version == latest.version:
        raise AppError(ErrorCode.VALIDATION_ERROR, "目标版本已是最新版本，无需回滚")
    model = await schema_repo.publish(db, form_key, target.schema_json)
    await db.commit()
    return serialize_schema(model)


async def delete_schema(db: AsyncSession, form_key: str) -> None:
    models = await schema_repo.list_versions(db, form_key)
    if not models:
        raise AppError(ErrorCode.SCHEMA_NOT_FOUND, f"表单 {form_key} 不存在")
    await record_repo.delete_all(db, form_key)
    await schema_repo.delete_all(db, form_key)
    await db.commit()


async def require_latest_raw(db: AsyncSession, form_key: str) -> dict:
    model = await schema_repo.latest(db, form_key)
    if model is None:
        raise AppError(ErrorCode.SCHEMA_NOT_FOUND, f"表单 {form_key} 未发布")
    return model.schema_json
