"""视图映射 AI 生成（接口文档 → 映射草稿）。"""

from __future__ import annotations

import copy
import json
import logging
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from ... import view_contracts
from ...config import settings
from ...contracts import _SCOPED_CHILDREN_TYPES
from ...repositories import schema_repo
from ...responses import AppError, ErrorCode
from . import view_prompt
from .client import LLMClient

logger = logging.getLogger("aug.ai.view_generator")

MOCK_VIEW_CONFIG: dict = json.loads(
    Path(__file__).with_name("mock_view_config.json").read_text(encoding="utf-8")
)

ENVELOPE_FIELDS = [
    {"path": "$.id", "valueType": "long", "description": "记录 ID"},
    {"path": "$.schemaVersion", "valueType": "long", "description": "记录固化 Schema 版本"},
    {"path": "$.createdAt", "valueType": "datetime", "description": "创建时间 ISO-8601"},
    {"path": "$.updatedAt", "valueType": "datetime", "description": "更新时间 ISO-8601"},
    {"path": "$.createdBy", "valueType": "string", "description": "创建人"},
]


def flatten_source_catalog(schema: dict) -> list[dict]:
    """拼装源字段目录：区分 group（扁平）与 formList（数组独立命名空间）。"""
    catalog: list[dict] = []

    def walk(columns: list[dict], prefix: str, array_mode: bool) -> None:
        for col in columns or []:
            value_type = col.get("valueType")
            data_index = col.get("dataIndex")
            if value_type == "divider" or not data_index:
                continue
            if value_type == "group":
                walk(col.get("columns") or [], prefix, array_mode)
                continue
            if value_type in _SCOPED_CHILDREN_TYPES:
                list_path = f"{prefix}{data_index}"
                walk(col.get("columns") or [], f"{list_path}[i].", True)
                continue
            entry = {
                "dataIndex": data_index,
                "title": col.get("title") or data_index,
                "valueType": value_type,
                "path": f"{prefix}{data_index}",
            }
            if col.get("valueEnum"):
                entry["valueEnum"] = {
                    key: (val.get("text") if isinstance(val, dict) else str(val))
                    for key, val in col["valueEnum"].items()
                }
            if value_type == "dateRange":
                entry["path"] = f"{prefix}{data_index}[0|1]"
                entry["note"] = "dateRange 存储为 [起, 止]，按 [0]/[1] 拆成两个目标字段"
            if array_mode:
                entry["isArray"] = True
            catalog.append(entry)

    walk(schema.get("columns") or [], "$.data.", False)
    return catalog


async def generate_view_mapping(
    db: AsyncSession,
    doc_text: str,
    form_key: str,
    client: LLMClient | None = None,
) -> dict:
    client = client or LLMClient()
    latest = await schema_repo.latest(db, form_key)
    if latest is None:
        raise AppError(ErrorCode.SCHEMA_NOT_FOUND, f"表单 {form_key} 未发布，无法生成视图映射")
    history = await schema_repo.all_versions(db, form_key)
    catalog = flatten_source_catalog(latest.schema_json)
    system = view_prompt.build_view_system_prompt()
    user = view_prompt.build_view_user_prompt(form_key, catalog, doc_text)
    try:
        json_schema = view_contracts.export_view_mapping_json_schema()
    except Exception:  # pragma: no cover
        json_schema = {}
    last_error = ""
    for attempt in range(settings.ai_max_retry + 1):
        payload = await client.complete_json(
            system, user, json_schema, mock_payload=copy.deepcopy(MOCK_VIEW_CONFIG)
        )
        try:
            mapping, warnings = view_contracts.validate_view_mapping(
                payload,
                schema=latest.schema_json,
                historical_schemas=[m.schema_json for m in history],
            )
            return {"mapping": mapping, "warnings": warnings}
        except view_contracts.ViewConfigError as exc:
            last_error = str(exc)
            logger.info("视图映射校验失败（第 %s 次）：%s", attempt + 1, last_error)
            user = view_prompt.build_view_retry_prompt(user, last_error)
    raise AppError(
        ErrorCode.AI_GENERATE_FAILED,
        f"AI 生成的视图映射未通过校验（已重试 {settings.ai_max_retry} 次）：{last_error}",
    )
