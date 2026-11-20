"""组件注册表：单一事实来源（prompt 判据 / 契约校验 / JSON Schema / 前端白名单）。"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

REGISTRY_PATH = Path(__file__).with_name("component_registry.json")


@dataclass(frozen=True)
class ComponentSpec:
    value_type: str
    label: str
    criteria: str
    rules: str = ""
    few_shot: dict | None = None
    requires_value_enum: bool = False
    allowed_field_props: tuple[str, ...] | None = None
    custom: bool = False
    frontend_renderer: str | None = None
    layout: bool = False
    children_policy: str = "forbidden"

    @property
    def children_required(self) -> bool:
        return self.children_policy == "required"


@lru_cache(maxsize=1)
def _load() -> tuple[ComponentSpec, ...]:
    raw = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    specs: list[ComponentSpec] = []
    for item in raw["components"]:
        specs.append(
            ComponentSpec(
                value_type=item["valueType"],
                label=item["label"],
                criteria=item.get("criteria", ""),
                rules=item.get("rules", ""),
                few_shot=item.get("fewShot"),
                requires_value_enum=bool(item.get("requiresValueEnum", False)),
                allowed_field_props=(
                    tuple(item["allowedFieldProps"]) if item.get("allowedFieldProps") else None
                ),
                custom=bool(item.get("custom", False)),
                frontend_renderer=item.get("frontendRenderer"),
                layout=bool(item.get("layout", False)),
                children_policy=item.get("childrenPolicy", "forbidden"),
            )
        )
    return tuple(specs)


def components() -> tuple[ComponentSpec, ...]:
    return _load()


@lru_cache(maxsize=1)
def _by_type() -> dict[str, ComponentSpec]:
    return {spec.value_type: spec for spec in _load()}


def get(value_type: str) -> ComponentSpec | None:
    return _by_type().get(value_type)


def is_registered(value_type: str) -> bool:
    return value_type in _by_type()


def value_types() -> list[str]:
    return [spec.value_type for spec in _load()]


def requires_value_enum() -> set[str]:
    return {spec.value_type for spec in _load() if spec.requires_value_enum}


def custom_types() -> set[str]:
    return {spec.value_type for spec in _load() if spec.custom}


def layout_types() -> set[str]:
    return {spec.value_type for spec in _load() if spec.layout}


def children_required_types() -> set[str]:
    return {spec.value_type for spec in _load() if spec.children_required}


def allowed_field_props(value_type: str) -> tuple[str, ...] | None:
    spec = get(value_type)
    if spec is None:
        return None
    return spec.allowed_field_props


def public_components() -> list[dict[str, Any]]:
    """公开清单：不含 prompt 素材（criteria/rules/fewShot）。"""
    return [
        {
            "valueType": spec.value_type,
            "label": spec.label,
            "custom": spec.custom,
            "frontendRenderer": spec.frontend_renderer,
            "requiresValueEnum": spec.requires_value_enum,
            "layout": spec.layout,
            "childrenPolicy": spec.children_policy,
            "allowedFieldProps": list(spec.allowed_field_props) if spec.allowed_field_props else None,
        }
        for spec in _load()
    ]


def criteria_lines() -> list[str]:
    """prompt 用：逐组件拼装选用判据。"""
    lines = []
    for spec in _load():
        extra = ""
        if spec.requires_value_enum:
            extra = "（必须提供 valueEnum）"
        elif spec.layout:
            extra = "（布局组件）"
        elif spec.custom:
            extra = "（业务自定义组件）"
        lines.append(f"- {spec.value_type}（{spec.label}）：{spec.criteria}{extra}")
    return lines


def rules_lines() -> list[str]:
    return [
        f"- {spec.value_type}：{spec.rules}" for spec in _load() if spec.rules
    ]


def few_shots() -> list[dict]:
    shots = []
    spec_by_type = _by_type()
    # 内置基础 few-shot（对应 MOCK_SCHEMA）
    shots.append(
        {
            "name": "基础三件套（必填 text / 枚举 select / 区间 dateRange）",
            "columns": [
                {
                    "dataIndex": "feedback_title",
                    "title": "反馈标题",
                    "valueType": "text",
                    "hideInSearch": True,
                    "formItemProps": {"rules": [{"required": True, "message": "请输入反馈标题"}]},
                    "fieldProps": {"maxLength": 100},
                },
                {
                    "dataIndex": "level",
                    "title": "严重程度",
                    "valueType": "select",
                    "valueEnum": {"p0": {"text": "致命"}, "p1": {"text": "严重"}, "p2": {"text": "一般"}},
                    "formItemProps": {"rules": [{"required": True, "message": "请选择严重程度"}]},
                },
                {
                    "dataIndex": "occur_range",
                    "title": "发生时间",
                    "valueType": "dateRange",
                    "hideInTable": True,
                    "hideInSearch": True,
                },
            ],
        }
    )
    shots.append(
        {
            "name": "布局（group 扁平 + formList 明细）",
            "columns": [
                {
                    "dataIndex": "basic_group",
                    "title": "基本信息",
                    "valueType": "group",
                    "columns": [
                        {"dataIndex": "name", "title": "姓名", "valueType": "text"},
                        {"dataIndex": "phone_no", "title": "电话", "valueType": "text"},
                    ],
                },
                {
                    "dataIndex": "contacts",
                    "title": "联系人",
                    "valueType": "formList",
                    "columns": [
                        {"dataIndex": "contact_name", "title": "联系人姓名", "valueType": "text"},
                        {"dataIndex": "contact_phone", "title": "联系人电话", "valueType": "text"},
                    ],
                    "hideInSearch": True,
                },
            ],
        }
    )
    for spec in _load():
        if spec.few_shot:
            shots.append({"name": f"自定义组件 {spec.value_type}", "columns": [spec.few_shot]})
    return shots
