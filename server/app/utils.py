"""通用工具。"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from .responses import AppError, ErrorCode


def parse_iso_datetime(value: str | None, field: str = "time") -> datetime | None:
    if not value:
        return None
    try:
        normalized = value.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise AppError(ErrorCode.VALIDATION_ERROR, f"{field} 不是合法的 ISO 8601 时间") from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.astimezone(timezone.utc).isoformat()


def parse_filters(raw: str | dict | None) -> dict[str, Any]:
    if raw is None or raw == "":
        return {}
    if isinstance(raw, dict):
        return raw
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise AppError(ErrorCode.VALIDATION_ERROR, "filters 必须是 JSON 对象字符串") from exc
    if not isinstance(parsed, dict):
        raise AppError(ErrorCode.VALIDATION_ERROR, "filters 必须是 JSON 对象")
    return parsed


def ensure_json_object(payload: Any, message: str = "请求体必须是 JSON 对象") -> dict:
    if not isinstance(payload, dict):
        raise AppError(ErrorCode.VALIDATION_ERROR, message)
    return payload
