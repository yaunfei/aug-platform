"""视图映射 DSL 契约校验器（§8.1.1 全规则）。"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from .contracts import FORM_KEY_RE, SchemaValidationError, validate_schema
from .services.view_transform import IDENT_RE, ViewMappingError, compile_path

TYPE_WHITELIST = {"string", "long", "double", "decimal", "boolean", "datetime", "enum", "array", "const"}
MAX_MAPPINGS = 100
MAX_SERIALIZED_BYTES = 64 * 1024
MAX_ARRAY_DEPTH = 2

DOCS_CONTRACTS_DIR = Path(__file__).resolve().parents[2] / "docs" / "contracts"


class ViewConfigError(ValueError):
    pass


def _collect_data_indexes(columns: list[dict], out: set[str]) -> None:
    for col in columns or []:
        data_index = col.get("dataIndex")
        if data_index:
            out.add(data_index)
        if col.get("columns"):
            _collect_data_indexes(col["columns"], out)


def _collect_enum_keys(columns: list[dict], out: set[str]) -> None:
    for col in columns or []:
        enum = col.get("valueEnum") or {}
        out.update(str(k) for k in enum.keys())
        if col.get("columns"):
            _collect_enum_keys(col["columns"], out)


def _check_to_path(mapping: dict, seen: dict[str, int], index: int) -> list[str]:
    to_path = mapping.get("to")
    if not isinstance(to_path, str) or not to_path:
        raise ViewConfigError(f"第 {index + 1} 条映射缺少 to")
    segments = to_path.split(".")
    if any(not IDENT_RE.match(seg) for seg in segments):
        raise ViewConfigError(f"to 路径段非法标识符：{to_path}")
    if to_path in seen:
        raise ViewConfigError(f"to 路径重复：{to_path}")
    for existing in seen:
        if existing == to_path:
            continue
        if to_path.startswith(existing + ".") or existing.startswith(to_path + "."):
            raise ViewConfigError(f"to 路径前缀冲突：{existing} 与 {to_path}")
    seen[to_path] = index
    return segments


def _check_from(path: str, index: int, data_indexes: set[str], warnings: list[str]) -> None:
    try:
        tokens = compile_path(path)
    except ViewMappingError as exc:
        raise ViewConfigError(f"第 {index + 1} 条 from 非法：{exc}") from exc
    if len(tokens) >= 2 and tokens[0] == ("key", "data"):
        first = tokens[1]
        if first[0] == "key" and first[1] not in data_indexes:
            warnings.append(f"from 字段 {first[1]} 不在当前表单 Schema 的 dataIndex 中（可能是历史字段）")


def _check_mapping(
    mapping: dict,
    index: int,
    seen: dict[str, int],
    data_indexes: set[str],
    enum_union: set[str],
    warnings: list[str],
    depth: int,
) -> None:
    _check_to_path(mapping, seen, index)
    mapping_type = mapping.get("type")
    if mapping_type not in TYPE_WHITELIST:
        raise ViewConfigError(f"第 {index + 1} 条映射 type 非法：{mapping_type}")
    if mapping_type == "const":
        if "value" not in mapping:
            raise ViewConfigError(f"第 {index + 1} 条 const 映射必须提供 value")
        return
    from_path = mapping.get("from")
    if not isinstance(from_path, str) or not from_path:
        raise ViewConfigError(f"第 {index + 1} 条映射必须提供 from 或 const")
    if mapping_type == "array":
        if depth + 1 > MAX_ARRAY_DEPTH:
            raise ViewConfigError(f"array 嵌套深度超过 {MAX_ARRAY_DEPTH} 层：{mapping.get('to')}")
        item_mappings = mapping.get("itemMappings")
        if not isinstance(item_mappings, list) or not item_mappings:
            raise ViewConfigError(f"第 {index + 1} 条 array 映射必须提供非空 itemMappings")
        for item in item_mappings:
            if not isinstance(item, dict):
                raise ViewConfigError(f"第 {index + 1} 条 itemMappings 元素必须是对象")
            if not isinstance(item.get("from"), str) or not item.get("from"):
                raise ViewConfigError(f"第 {index + 1} 条 itemMappings 元素必须提供 from")
            try:
                compile_path(item["from"])
            except ViewMappingError as exc:
                raise ViewConfigError(f"itemMappings from 非法：{exc}") from exc
        item_seen: dict[str, int] = {}
        for item in item_mappings:
            _check_mapping(item, index, item_seen, data_indexes, enum_union, warnings, depth + 1)
        return
    _check_from(from_path, index, data_indexes, warnings)
    if mapping_type == "enum":
        enum_map = mapping.get("enumMap")
        if not isinstance(enum_map, dict) or not enum_map:
            raise ViewConfigError(f"第 {index + 1} 条 enum 映射必须提供非空 enumMap")
        if any(not isinstance(v, str) for v in enum_map.values()):
            raise ViewConfigError(f"第 {index + 1} 条 enumMap 的值必须是字符串")
        missing = sorted(enum_union - {str(k) for k in enum_map.keys()})
        if missing:
            warnings.append(
                f"enumMap 未覆盖历史版本枚举 key：{', '.join(missing)}（历史记录可能 fallback 到 enumDefault）"
            )
    if mapping_type == "datetime" and mapping.get("format") is not None:
        if not isinstance(mapping["format"], str):
            raise ViewConfigError(f"第 {index + 1} 条 datetime format 必须是字符串")
    if mapping_type == "decimal" and mapping.get("scale") is not None:
        scale = mapping["scale"]
        if not isinstance(scale, int) or scale < 0 or scale > 10:
            raise ViewConfigError(f"第 {index + 1} 条 decimal scale 必须是 0-10 的整数")


def validate_view_mapping(
    raw: Any,
    *,
    schema: dict | None = None,
    historical_schemas: list[dict] | None = None,
) -> tuple[dict, list[str]]:
    if not isinstance(raw, dict):
        raise ViewConfigError("视图配置必须是 JSON 对象")
    view_key = raw.get("viewKey")
    if not isinstance(view_key, str) or not FORM_KEY_RE.match(view_key):
        raise ViewConfigError("viewKey 必须匹配 ^[a-z][a-z0-9_]{1,63}$")
    form_key = raw.get("formKey")
    if not isinstance(form_key, str) or not FORM_KEY_RE.match(form_key):
        raise ViewConfigError("formKey 必须匹配 ^[a-z][a-z0-9_]{1,63}$")
    title = raw.get("title")
    if not isinstance(title, str) or not title or len(title) > 128:
        raise ViewConfigError("title 必须为 1-128 字符字符串")
    description = raw.get("description")
    if description is not None and not isinstance(description, str):
        raise ViewConfigError("description 必须是字符串")
    mappings = raw.get("mappings")
    if not isinstance(mappings, list) or not mappings:
        raise ViewConfigError("mappings 必须是非空数组")
    if len(mappings) > MAX_MAPPINGS:
        raise ViewConfigError(f"mappings 不能超过 {MAX_MAPPINGS} 条")

    if schema is not None:
        try:
            validate_schema(schema)
        except SchemaValidationError as exc:
            raise ViewConfigError(f"关联表单 Schema 非法：{exc}") from exc

    data_indexes: set[str] = set()
    enum_union: set[str] = set()
    if schema:
        _collect_data_indexes(schema.get("columns") or [], data_indexes)
        _collect_enum_keys(schema.get("columns") or [], enum_union)
    for hist in historical_schemas or []:
        _collect_enum_keys(hist.get("columns") or [], enum_union)

    warnings: list[str] = []
    seen: dict[str, int] = {}
    for index, mapping in enumerate(mappings):
        if not isinstance(mapping, dict):
            raise ViewConfigError(f"第 {index + 1} 条映射必须是对象")
        _check_mapping(mapping, index, seen, data_indexes, enum_union, warnings, 0)

    size = len(json.dumps(raw, ensure_ascii=False).encode("utf-8"))
    if size > MAX_SERIALIZED_BYTES:
        raise ViewConfigError(f"视图配置序列化后 {size} 字节，超过 64KB 上限")
    return raw, warnings


def export_view_mapping_json_schema() -> dict:
    """导出（逐字复用附录 D.1）并返回 JSON Schema。"""
    target = DOCS_CONTRACTS_DIR / "view-mapping.schema.json"
    if target.exists():
        return json.loads(target.read_text(encoding="utf-8"))
    schema = {
        "title": "ViewMapping",
        "type": "object",
        "required": ["viewKey", "title", "formKey", "mappings"],
        "properties": {
            "viewKey": {"type": "string", "pattern": FORM_KEY_RE.pattern},
            "title": {"type": "string", "minLength": 1, "maxLength": 128},
            "formKey": {"type": "string", "pattern": FORM_KEY_RE.pattern},
            "description": {"type": "string"},
            "mappings": {"type": "array", "minItems": 1, "maxItems": MAX_MAPPINGS},
        },
    }
    DOCS_CONTRACTS_DIR.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(schema, ensure_ascii=False, indent=2), encoding="utf-8")
    return schema
