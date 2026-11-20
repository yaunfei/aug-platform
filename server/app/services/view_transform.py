"""视图映射参考实现（仅 /test 预览与 fixtures 对齐用），语义与 Java 引擎一致。"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

TOKEN_RE = re.compile(r"\.([A-Za-z_][A-Za-z0-9_]*)|\[(-?\d+)\]")
IDENT_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
MISSING = object()
MAX_ARRAY_DEPTH = 2


class ViewMappingError(Exception):
    pass


def compile_path(path: str) -> list[tuple[str, Any]]:
    if not isinstance(path, str) or not path.startswith("$"):
        raise ViewMappingError(f"非法 JsonPath：{path!r}")
    tokens: list[tuple[str, Any]] = []
    pos = 1
    while pos < len(path):
        match = TOKEN_RE.match(path, pos)
        if not match:
            raise ViewMappingError(f"非法 JsonPath：{path!r}")
        if match.group(1) is not None:
            tokens.append(("key", match.group(1)))
        else:
            tokens.append(("index", int(match.group(2))))
        pos = match.end()
    return tokens


def resolve(source: Any, tokens: list[tuple[str, Any]]) -> Any:
    current = source
    for kind, value in tokens:
        if kind == "key":
            if not isinstance(current, dict) or value not in current:
                return MISSING
            current = current[value]
        else:
            if not isinstance(current, list) or value < 0 or value >= len(current):
                return MISSING
            current = current[value]
    return current


def _to_string(value: Any) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, float):
        return json.dumps(value)
    if isinstance(value, (int,)):
        return str(value)
    if value is None:
        return ""
    return str(value)


def _to_long(value: Any) -> int:
    if isinstance(value, bool):
        return 1 if value else 0
    return int(value)


def _to_double(value: Any) -> float:
    return float(value)


def _to_decimal(value: Any, scale: int | None) -> float:
    dec = Decimal(str(value))
    if scale is not None:
        quant = Decimal(1).scaleb(-int(scale))
        dec = dec.quantize(quant, rounding=ROUND_HALF_UP)
    return float(dec)


def _to_boolean(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in ("true", "1", "yes")
    return bool(value)


JAVA_PATTERN_MAP = [
    ("yyyy", "%Y"),
    ("MM", "%m"),
    ("dd", "%d"),
    ("HH", "%H"),
    ("mm", "%M"),
    ("ss", "%S"),
]


def _java_to_strftime(pattern: str) -> str:
    result = pattern
    for java, py in JAVA_PATTERN_MAP:
        result = result.replace(java, py)
    return result


def _to_datetime(value: Any, fmt: str | None) -> str:
    if isinstance(value, datetime):
        dt = value
    else:
        text = _to_string(value)
        try:
            dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError as exc:
            raise ViewMappingError(f"datetime 解析失败：{text}") from exc
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    dt = dt.astimezone(timezone.utc)
    if not fmt:
        return dt.isoformat().replace("+00:00", "Z")
    return dt.strftime(_java_to_strftime(fmt))


def _enum_value(mapping: dict, raw: Any, warnings: list[str], record_id: Any, to_path: str) -> Any:
    enum_map = mapping.get("enumMap") or {}
    key = _to_string(raw)
    if key in enum_map:
        return enum_map[key]
    default = mapping.get("enumDefault")
    if default is not None:
        warnings.append(
            f"recordId={record_id} path={to_path} raw={key} output={default}（enumDefault fallback）"
        )
        return default
    return MISSING


def _transform_value(
    mapping: dict,
    source: Any,
    depth: int,
    warnings: list[str],
    record_id: Any,
) -> Any:
    mapping_type = mapping.get("type")
    to_path = mapping.get("to", "")
    if mapping_type == "const":
        return mapping.get("value")
    from_path = mapping.get("from")
    if not from_path:
        return MISSING
    tokens = compile_path(from_path)
    raw = resolve(source, tokens)
    if raw is MISSING:
        return MISSING
    if mapping_type == "string":
        return _to_string(raw)
    if mapping_type == "long":
        return _to_long(raw)
    if mapping_type == "double":
        return _to_double(raw)
    if mapping_type == "decimal":
        return _to_decimal(raw, mapping.get("scale"))
    if mapping_type == "boolean":
        return _to_boolean(raw)
    if mapping_type == "datetime":
        return _to_datetime(raw, mapping.get("format"))
    if mapping_type == "enum":
        return _enum_value(mapping, raw, warnings, record_id, to_path)
    if mapping_type == "array":
        if depth + 1 > MAX_ARRAY_DEPTH:
            raise ViewMappingError(f"array 嵌套深度超过 {MAX_ARRAY_DEPTH} 层：{to_path}")
        if not isinstance(raw, list):
            return MISSING
        item_mappings = mapping.get("itemMappings") or []
        items = []
        for item in raw:
            transformed = _transform_object(
                item_mappings, item, depth + 1, warnings, record_id
            )
            items.append(transformed)
        return items
    raise ViewMappingError(f"未知 type：{mapping_type}")


def _transform_object(
    mappings: list[dict], source: Any, depth: int, warnings: list[str], record_id: Any
) -> dict:
    result: dict = {}
    for mapping in mappings:
        value = _transform_value(mapping, source, depth, warnings, record_id)
        if value is MISSING:
            continue
        set_path(result, mapping.get("to", ""), value)
    return result


def set_path(root: dict, path: str, value: Any) -> None:
    parts = [p for p in str(path).split(".") if p]
    current = root
    for part in parts[:-1]:
        nxt = current.get(part)
        if not isinstance(nxt, dict):
            nxt = {}
            current[part] = nxt
        current = nxt
    if parts:
        current[parts[-1]] = value


def transform_record(mapping_config: dict, record: dict) -> tuple[dict, list[str]]:
    warnings: list[str] = []
    output = _transform_object(
        mapping_config.get("mappings") or [],
        record,
        0,
        warnings,
        record.get("id"),
    )
    return output, warnings
