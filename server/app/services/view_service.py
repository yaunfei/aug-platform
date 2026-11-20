"""视图配置业务逻辑。"""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from .. import view_contracts
from ..repositories import record_repo, schema_repo, view_repo
from ..responses import AppError, ErrorCode
from ..utils import iso
from . import view_transform


def serialize_view(model) -> dict:
    return {
        "id": model.id,
        "viewKey": model.view_key,
        "version": model.version,
        "formKey": model.form_key,
        "title": model.title,
        "description": model.description,
        "mapping": model.mapping_json,
        "createdAt": iso(model.created_at),
        "updatedAt": iso(model.updated_at),
    }


async def list_views(db: AsyncSession, form_key: str | None = None) -> list[dict]:
    models = await view_repo.list_latest(db, form_key=form_key)
    return [serialize_view(m) for m in models]


async def _validation_context(db: AsyncSession, form_key: str):
    latest = await schema_repo.latest(db, form_key)
    if latest is None:
        raise AppError(ErrorCode.SCHEMA_NOT_FOUND, f"表单 {form_key} 未发布，无法关联视图")
    history = await schema_repo.all_versions(db, form_key)
    return latest.schema_json, [m.schema_json for m in history]


async def publish_view(db: AsyncSession, view_key: str, raw: dict) -> dict:
    if not isinstance(raw, dict):
        raise AppError(ErrorCode.VALIDATION_ERROR, "视图配置必须是 JSON 对象")
    if raw.get("viewKey") != view_key:
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            f"路径 viewKey({view_key}) 与配置 viewKey({raw.get('viewKey')}) 不一致",
        )
    form_key = raw.get("formKey")
    if not isinstance(form_key, str):
        raise AppError(ErrorCode.VALIDATION_ERROR, "视图配置缺少 formKey")
    schema, history = await _validation_context(db, form_key)
    try:
        mapping, warnings = view_contracts.validate_view_mapping(
            raw, schema=schema, historical_schemas=history
        )
    except view_contracts.ViewConfigError as exc:
        raise AppError(ErrorCode.VIEW_CONFIG_INVALID, str(exc)) from exc
    model = await view_repo.publish(db, mapping)
    await db.commit()
    data = serialize_view(model)
    data["warnings"] = warnings
    return data


async def get_view(db: AsyncSession, view_key: str) -> dict:
    model = await view_repo.latest(db, view_key)
    if model is None:
        raise AppError(ErrorCode.VIEW_NOT_FOUND, f"视图 {view_key} 不存在")
    return serialize_view(model)


async def list_versions(db: AsyncSession, view_key: str) -> list[dict]:
    models = await view_repo.versions(db, view_key)
    if not models:
        raise AppError(ErrorCode.VIEW_NOT_FOUND, f"视图 {view_key} 不存在")
    return [serialize_view(m) for m in models]


async def rollback(db: AsyncSession, view_key: str, version: int) -> dict:
    target = await view_repo.get_version(db, view_key, version)
    if target is None:
        raise AppError(ErrorCode.VIEW_NOT_FOUND, f"视图 {view_key} 版本 {version} 不存在")
    latest = await view_repo.latest(db, view_key)
    if latest is not None and latest.version == target.version:
        raise AppError(ErrorCode.VALIDATION_ERROR, "目标版本已是最新版本，无需回滚")
    schema, history = await _validation_context(db, target.form_key)
    try:
        mapping, warnings = view_contracts.validate_view_mapping(
            target.mapping_json, schema=schema, historical_schemas=history
        )
    except view_contracts.ViewConfigError as exc:
        raise AppError(ErrorCode.VIEW_CONFIG_INVALID, str(exc)) from exc
    model = await view_repo.publish(db, mapping)
    await db.commit()
    data = serialize_view(model)
    data["warnings"] = warnings
    return data


async def delete_view(db: AsyncSession, view_key: str) -> None:
    models = await view_repo.versions(db, view_key)
    if not models:
        raise AppError(ErrorCode.VIEW_NOT_FOUND, f"视图 {view_key} 不存在")
    await view_repo.delete_all(db, view_key)
    await db.commit()


async def test_view(db: AsyncSession, view_key: str, body: dict) -> dict:
    model = await view_repo.latest(db, view_key)
    if model is None:
        raise AppError(ErrorCode.VIEW_NOT_FOUND, f"视图 {view_key} 不存在")
    record_data: dict[str, Any] | None = None
    record_id = body.get("recordId")
    if record_id is not None:
        try:
            record = await record_repo.get(db, model.form_key, int(record_id))
        except (TypeError, ValueError) as exc:
            raise AppError(ErrorCode.VALIDATION_ERROR, "recordId 必须是整数") from exc
        if record is None:
            raise AppError(ErrorCode.RECORD_NOT_FOUND, f"记录 {record_id} 不存在")
        record_data = {
            "id": record.id,
            "schemaVersion": record.schema_version,
            "createdAt": iso(record.created_at),
            "updatedAt": iso(record.updated_at),
            "createdBy": record.created_by,
            "data": record.data or {},
        }
    else:
        sample = body.get("sampleData")
        if sample is None:
            raise AppError(ErrorCode.VALIDATION_ERROR, "必须提供 recordId 或 sampleData")
        if not isinstance(sample, dict):
            raise AppError(ErrorCode.VALIDATION_ERROR, "sampleData 必须是 JSON 对象")
        if "data" in sample:
            record_data = sample
        else:
            record_data = {
                "id": sample.get("id", 0),
                "schemaVersion": sample.get("schemaVersion", 0),
                "createdAt": sample.get("createdAt"),
                "updatedAt": sample.get("updatedAt"),
                "createdBy": sample.get("createdBy"),
                "data": sample,
            }
    try:
        transformed, warnings = view_transform.transform_record(model.mapping_json, record_data)
    except view_transform.ViewMappingError as exc:
        raise AppError(ErrorCode.VIEW_MAPPING_ERROR, str(exc)) from exc
    return {"transformed": transformed, "warnings": warnings, "input": record_data}
