"""Form Schema 契约（Pydantic v2，extra=forbid）。"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

from . import registry

FORM_KEY_RE = re.compile(r"^[a-z][a-z0-9_]{1,63}$")
DATA_INDEX_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9_]{0,63}$")
FUNCTION_RE = re.compile(r"^\s*(function\b|\(.*\)\s*=>|async\b)")

MAX_SERIALIZED_BYTES = 256 * 1024
MAX_TOTAL_COLUMNS = 80

# 子字段独立命名空间的布局类型（与 view_generator 源字段目录同源）
_SCOPED_CHILDREN_TYPES = {"formList", "formSet"}

DOCS_CONTRACTS_DIR = Path(__file__).resolve().parents[2] / "docs" / "contracts"


class SchemaValidationError(ValueError):
    """Schema 契约校验失败。"""


class ValueEnumItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str


class FormItemRule(BaseModel):
    model_config = ConfigDict(extra="forbid")
    required: bool | None = None
    message: str | None = None
    max: float | int | None = None
    min: float | int | None = None
    len: int | None = None
    pattern: str | None = None

    @model_validator(mode="after")
    def _check_pattern(self) -> "FormItemRule":
        if self.pattern is not None:
            try:
                re.compile(self.pattern)
            except re.error as exc:
                raise ValueError(f"pattern 无法编译：{self.pattern}（{exc}）") from exc
        return self


class FormItemProps(BaseModel):
    model_config = ConfigDict(extra="forbid")
    rules: list[FormItemRule] | None = None
    tooltip: str | None = None
    extra: str | None = None


class ColProps(BaseModel):
    model_config = ConfigDict(extra="forbid")
    span: int | None = None
    xs: int | dict | None = None
    sm: int | dict | None = None
    md: int | dict | None = None
    lg: int | dict | None = None


class ColumnSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    dataIndex: str = Field(pattern=DATA_INDEX_RE.pattern)
    title: str | None = None
    valueType: str
    valueEnum: dict[str, ValueEnumItem] | None = None
    formItemProps: FormItemProps | None = None
    fieldProps: dict[str, Any] | None = None
    hideInTable: bool | None = None
    hideInSearch: bool | None = None
    hideInForm: bool | None = None
    tooltip: str | None = None
    width: int | None = None
    initialValue: Any | None = None
    colProps: ColProps | None = None
    columns: list["ColumnSchema"] | None = None

    @model_validator(mode="after")
    def _check_component(self) -> "ColumnSchema":
        spec = registry.get(self.valueType)
        if spec is None:
            raise ValueError(f"未注册的 valueType：{self.valueType}")
        if self.valueType != "divider" and not self.title:
            raise ValueError(f"列 {self.dataIndex} 缺少 title（仅 divider 可省略）")
        if spec.requires_value_enum:
            if not self.valueEnum:
                raise ValueError(f"{self.valueType} 必须提供非空 valueEnum")
        if spec.layout:
            if self.valueEnum is not None:
                raise ValueError(f"布局组件 {self.valueType} 禁止 valueEnum")
            if self.initialValue is not None:
                raise ValueError(f"布局组件 {self.valueType} 禁止 initialValue")
            if self.width is not None:
                raise ValueError(f"布局组件 {self.valueType} 禁止 width")
        if self.valueType in ("group", "divider") and self.formItemProps is not None:
            raise ValueError(f"{self.valueType} 禁止 formItemProps")
        if spec.children_required:
            if not self.columns:
                raise ValueError(f"{self.valueType} 必须提供非空 columns")
        elif self.columns is not None and self.valueType != "divider":
            raise ValueError(f"{self.valueType} 不允许 columns")
        if self.valueType == "divider" and self.columns:
            raise ValueError("divider 不带 columns")
        if self.fieldProps is not None and spec.allowed_field_props is not None:
            allowed = set(spec.allowed_field_props)
            unknown = [k for k in self.fieldProps if k not in allowed]
            if unknown:
                raise ValueError(
                    f"{self.valueType} 的 fieldProps 仅允许 {sorted(allowed)}，发现 {unknown}"
                )
        return self


ColumnSchema.model_rebuild()


class FormSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    formKey: str = Field(pattern=FORM_KEY_RE.pattern)
    title: str = Field(min_length=1, max_length=64)
    description: str | None = None
    columns: list[ColumnSchema] = Field(min_length=1, max_length=MAX_TOTAL_COLUMNS)

    @model_validator(mode="after")
    def _check_tree(self) -> "FormSchema":
        errors: list[str] = []
        total = _check_columns(self.columns, set(), errors, in_layout=False)
        if total > MAX_TOTAL_COLUMNS:
            errors.append(f"递归展平总列数 {total} 超过上限 {MAX_TOTAL_COLUMNS}")
        if errors:
            raise ValueError("；".join(errors))
        return self


def _check_columns(
    columns: list[ColumnSchema], namespace: set[str], errors: list[str], in_layout: bool
) -> int:
    total = 0
    for col in columns:
        total += 1
        spec = registry.get(col.valueType)
        if col.dataIndex in namespace:
            errors.append(f"dataIndex 重复：{col.dataIndex}")
        else:
            namespace.add(col.dataIndex)
        if spec is not None and spec.layout:
            if in_layout:
                errors.append(f"布局组件 {col.valueType} 禁止嵌套（只能存在于顶层）")
            if col.columns:
                if col.valueType in _SCOPED_CHILDREN_TYPES:
                    # formList 子字段独立命名空间
                    total += _check_columns(col.columns, set(), errors, in_layout=True)
                else:
                    # group 子字段与顶层共享命名空间
                    total += _check_columns(col.columns, namespace, errors, in_layout=True)
        elif col.columns:
            total += _check_columns(col.columns, namespace, errors, in_layout)
    return total


def _reject_function_strings(value: Any, path: str = "schema") -> None:
    if isinstance(value, dict):
        for key, item in value.items():
            _reject_function_strings(item, f"{path}.{key}")
    elif isinstance(value, list):
        for idx, item in enumerate(value):
            _reject_function_strings(item, f"{path}[{idx}]")
    elif isinstance(value, str):
        if FUNCTION_RE.match(value):
            raise SchemaValidationError(f"{path} 出现函数字符串，Schema 必须是纯 JSON：{value[:40]}")


def validate_schema(raw: Any) -> FormSchema:
    if not isinstance(raw, dict):
        raise SchemaValidationError("Schema 必须是 JSON 对象")
    _reject_function_strings(raw)
    try:
        schema = FormSchema.model_validate(raw)
    except Exception as exc:  # pydantic ValidationError
        raise SchemaValidationError(_format_pydantic_error(exc)) from exc
    dumped = dump_schema(schema)
    size = len(json.dumps(dumped, ensure_ascii=False).encode("utf-8"))
    if size > MAX_SERIALIZED_BYTES:
        raise SchemaValidationError(f"Schema 序列化后 {size} 字节，超过 256KB 上限")
    return schema


def _format_pydantic_error(exc: Exception) -> str:
    errors = getattr(exc, "errors", None)
    if not callable(errors):
        return str(exc)
    parts = []
    for err in errors():
        loc = ".".join(str(x) for x in err.get("loc", []))
        parts.append(f"{loc}: {err.get('msg', '')}".strip(": "))
    return "；".join(parts) or str(exc)


def dump_schema(schema: FormSchema | dict) -> dict:
    if isinstance(schema, dict):
        return schema
    return schema.model_dump(exclude_none=True)


def export_json_schema() -> dict:
    """导出 Pydantic JSON Schema，并把注册表 valueType 全量枚举注入。"""
    schema = FormSchema.model_json_schema()
    defs = schema.get("$defs", {})
    column = defs.get("ColumnSchema")
    if column:
        column.setdefault("properties", {}).setdefault("valueType", {})["enum"] = (
            registry.value_types()
        )
    schema["$defs"] = defs
    schema.setdefault("title", "FormSchema")
    DOCS_CONTRACTS_DIR.mkdir(parents=True, exist_ok=True)
    (DOCS_CONTRACTS_DIR / "form-schema.schema.json").write_text(
        json.dumps(schema, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return schema


def flatten_columns(columns: list[dict], parent: str | None = None) -> list[dict]:
    """把 columns 展平为表格/导出列：group 递归、divider 丢弃、formList 保留为条数列。"""
    out: list[dict] = []
    for col in columns:
        value_type = col.get("valueType")
        if value_type == "divider":
            continue
        if value_type == "group":
            out.extend(flatten_columns(col.get("columns") or [], parent=col.get("dataIndex")))
            continue
        if value_type == "formList":
            out.append(
                {
                    **col,
                    "title": col.get("title") or col.get("dataIndex"),
                    "_isFormList": True,
                }
            )
            continue
        out.append(col)
    return out
