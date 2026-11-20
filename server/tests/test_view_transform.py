"""视图映射 fixtures 对齐测试。"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.services.view_transform import transform_record
from app.view_contracts import ViewConfigError, validate_view_mapping

CASES = sorted((Path(__file__).resolve().parents[2] / "docs" / "contracts" / "view_cases").glob("*.json"))


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


@pytest.mark.parametrize("path", CASES, ids=lambda p: p.stem)
def test_fixtures_match_reference_engine(path):
    case = load(path)
    if case.get("expectedError"):
        with pytest.raises(ViewConfigError) as exc:
            validate_view_mapping(case["config"])
        assert case["expectedErrorContains"] in str(exc.value)
        return
    validate_view_mapping(case["config"])
    output, warnings = transform_record(case["config"], case["inputRecord"])
    assert output == case["expectedOutput"]
    if case["name"] == "case12_historical_enum_mismatch":
        assert warnings and "pending" in warnings[0] and "未知" in warnings[0]


def test_validate_rejects_bad_jsonpath():
    config = {
        "viewKey": "bad_path",
        "title": "坏路径",
        "formKey": "order_form",
        "mappings": [{"from": "$.data[?]", "to": "x", "type": "string"}],
    }
    with pytest.raises(ViewConfigError):
        validate_view_mapping(config)


def test_validate_rejects_duplicate_to():
    config = {
        "viewKey": "dup",
        "title": "重复",
        "formKey": "order_form",
        "mappings": [
            {"from": "$.id", "to": "a", "type": "long"},
            {"from": "$.id", "to": "a", "type": "long"},
        ],
    }
    with pytest.raises(ViewConfigError, match="重复"):
        validate_view_mapping(config)


def test_validate_rejects_enum_without_map():
    config = {
        "viewKey": "enum_bad",
        "title": "枚举",
        "formKey": "order_form",
        "mappings": [{"from": "$.data.status", "to": "s", "type": "enum"}],
    }
    with pytest.raises(ViewConfigError):
        validate_view_mapping(config)


def test_validate_rejects_array_without_items():
    config = {
        "viewKey": "arr_bad",
        "title": "数组",
        "formKey": "order_form",
        "mappings": [{"from": "$.data.x", "to": "x", "type": "array"}],
    }
    with pytest.raises(ViewConfigError):
        validate_view_mapping(config)


def test_validate_rejects_deep_array():
    leaf = {"from": "$.v", "to": "v", "type": "string"}
    inner = {"from": "$.inner", "to": "inner", "type": "array", "itemMappings": [leaf]}
    middle = {"from": "$.middle", "to": "middle", "type": "array", "itemMappings": [inner]}
    config = {
        "viewKey": "deep_arr",
        "title": "深数组",
        "formKey": "order_form",
        "mappings": [{"from": "$.data.x", "to": "x", "type": "array", "itemMappings": [middle]}],
    }
    with pytest.raises(ViewConfigError, match="深度"):
        validate_view_mapping(config)


def test_validate_const_requires_value():
    config = {
        "viewKey": "const_bad",
        "title": "常量",
        "formKey": "order_form",
        "mappings": [{"to": "x", "type": "const"}],
    }
    with pytest.raises(ViewConfigError):
        validate_view_mapping(config)


def test_warn_unknown_source_and_enum_coverage():
    schema = {
        "formKey": "order_form",
        "title": "订单",
        "columns": [
            {
                "dataIndex": "status",
                "title": "状态",
                "valueType": "select",
                "valueEnum": {"old": {"text": "旧"}, "new": {"text": "新"}},
            }
        ],
    }
    config = {
        "viewKey": "warn_case",
        "title": "告警",
        "formKey": "order_form",
        "mappings": [
            {"from": "$.data.ghost", "to": "ghost", "type": "string"},
            {"from": "$.data.status", "to": "status", "type": "enum", "enumMap": {"new": "新"}},
        ],
    }
    _, warnings = validate_view_mapping(config, schema=schema)
    assert any("ghost" in w for w in warnings)
    assert any("old" in w for w in warnings)


def test_target_size_limit():
    mappings = [
        {"from": "$.id", "to": f"f{i}", "type": "long", "comment": "x" * 800}
        for i in range(100)
    ]
    config = {"viewKey": "big", "title": "大", "formKey": "order_form", "mappings": mappings}
    with pytest.raises(ViewConfigError, match="64KB"):
        validate_view_mapping(config)
