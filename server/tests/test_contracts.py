"""契约校验器测试。"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app import contracts, registry
from app.contracts import SchemaValidationError

FIXTURES = Path(__file__).parent / "fixtures" / "prd"


def load_cases():
    return sorted(FIXTURES.glob("case*.expected.json"))


@pytest.mark.parametrize("path", load_cases(), ids=lambda p: p.stem)
def test_expected_fixtures_pass(path):
    schema = contracts.validate_schema(json.loads(path.read_text(encoding="utf-8")))
    assert schema.formKey


def minimal_schema(**column):
    col = {"dataIndex": "name", "title": "姓名", "valueType": "text"}
    col.update(column)
    return {"formKey": "demo_form", "title": "演示表单", "columns": [col]}


def test_reject_function_string():
    schema = minimal_schema()
    schema["columns"][0]["fieldProps"] = {"render": "function() { return null }"}
    with pytest.raises(SchemaValidationError):
        contracts.validate_schema(schema)


def test_reject_arrow_function():
    schema = minimal_schema()
    schema["columns"][0]["fieldProps"] = {"render": "(v) => v"}
    with pytest.raises(SchemaValidationError):
        contracts.validate_schema(schema)


def test_extra_field_forbidden():
    schema = minimal_schema()
    schema["columns"][0]["required"] = True
    with pytest.raises(SchemaValidationError):
        contracts.validate_schema(schema)


def test_data_index_duplicate():
    schema = {
        "formKey": "demo_form",
        "title": "演示",
        "columns": [
            {"dataIndex": "a", "title": "A", "valueType": "text"},
            {"dataIndex": "a", "title": "A2", "valueType": "text"},
        ],
    }
    with pytest.raises(SchemaValidationError, match="重复"):
        contracts.validate_schema(schema)


def test_formlist_child_namespace_independent():
    schema = {
        "formKey": "demo_form",
        "title": "演示",
        "columns": [
            {"dataIndex": "list_a", "title": "明细A", "valueType": "formList",
             "columns": [{"dataIndex": "name", "title": "名称", "valueType": "text"}]},
            {"dataIndex": "list_b", "title": "明细B", "valueType": "formList",
             "columns": [{"dataIndex": "name", "title": "名称", "valueType": "text"}]},
        ],
    }
    contracts.validate_schema(schema)


def test_group_child_shares_global_namespace():
    schema = {
        "formKey": "demo_form",
        "title": "演示",
        "columns": [
            {"dataIndex": "group_a", "title": "分组", "valueType": "group",
             "columns": [{"dataIndex": "name", "title": "名称", "valueType": "text"}]},
            {"dataIndex": "name", "title": "名称", "valueType": "text"},
        ],
    }
    with pytest.raises(SchemaValidationError, match="重复"):
        contracts.validate_schema(schema)


def test_layout_cannot_nest():
    schema = {
        "formKey": "demo_form",
        "title": "演示",
        "columns": [
            {"dataIndex": "group_a", "title": "分组", "valueType": "group",
             "columns": [
                 {"dataIndex": "inner", "title": "内层", "valueType": "group",
                  "columns": [{"dataIndex": "x", "title": "X", "valueType": "text"}]}
             ]},
        ],
    }
    with pytest.raises(SchemaValidationError, match="禁止嵌套"):
        contracts.validate_schema(schema)


def test_group_requires_columns():
    schema = {
        "formKey": "demo_form",
        "title": "演示",
        "columns": [{"dataIndex": "g", "title": "分组", "valueType": "group"}],
    }
    with pytest.raises(SchemaValidationError):
        contracts.validate_schema(schema)


def test_enum_required_component():
    schema = {
        "formKey": "demo_form",
        "title": "演示",
        "columns": [{"dataIndex": "level", "title": "级别", "valueType": "select"}],
    }
    with pytest.raises(SchemaValidationError, match="valueEnum"):
        contracts.validate_schema(schema)


def test_layout_forbids_width():
    schema = {
        "formKey": "demo_form",
        "title": "演示",
        "columns": [
            {"dataIndex": "g", "title": "分组", "valueType": "group", "width": 100,
             "columns": [{"dataIndex": "x", "title": "X", "valueType": "text"}]},
        ],
    }
    with pytest.raises(SchemaValidationError):
        contracts.validate_schema(schema)


def test_divider_no_columns_and_title_optional():
    schema = {
        "formKey": "demo_form",
        "title": "演示",
        "columns": [
            {"dataIndex": "d", "valueType": "divider"},
            {"dataIndex": "x", "title": "X", "valueType": "text"},
        ],
    }
    contracts.validate_schema(schema)


def test_divider_with_columns_rejected():
    schema = {
        "formKey": "demo_form",
        "title": "演示",
        "columns": [
            {"dataIndex": "d", "title": "D", "valueType": "divider",
             "columns": [{"dataIndex": "x", "title": "X", "valueType": "text"}]},
        ],
    }
    with pytest.raises(SchemaValidationError):
        contracts.validate_schema(schema)


def test_pattern_must_compile():
    schema = minimal_schema()
    schema["columns"][0]["formItemProps"] = {"rules": [{"pattern": "([", "message": "x"}]}
    with pytest.raises(SchemaValidationError, match="pattern"):
        contracts.validate_schema(schema)


def test_custom_field_props_whitelist():
    schema = minimal_schema(valueType="imageUpload", hideInSearch=True)
    schema["columns"][0]["fieldProps"] = {"foo": 1}
    with pytest.raises(SchemaValidationError, match="fieldProps"):
        contracts.validate_schema(schema)


def test_custom_field_props_allowed():
    schema = minimal_schema(valueType="imageUpload", hideInSearch=True)
    schema["columns"][0]["fieldProps"] = {"maxSizeMB": 5}
    contracts.validate_schema(schema)


def test_unknown_value_type():
    schema = minimal_schema(valueType="not_exists")
    with pytest.raises(SchemaValidationError, match="未注册"):
        contracts.validate_schema(schema)


def test_total_columns_limit():
    columns = [
        {"dataIndex": f"f{i}", "title": f"F{i}", "valueType": "text"} for i in range(81)
    ]
    with pytest.raises(SchemaValidationError):
        contracts.validate_schema({"formKey": "demo_form", "title": "演示", "columns": columns})


def test_dump_excludes_none():
    schema = contracts.validate_schema(minimal_schema())
    dumped = contracts.dump_schema(schema)
    assert "hideInSearch" not in dumped["columns"][0]
    assert dumped["columns"][0]["title"] == "姓名"


def test_export_json_schema_injects_enum():
    exported = contracts.export_json_schema()
    enum = exported["$defs"]["ColumnSchema"]["properties"]["valueType"]["enum"]
    assert set(enum) == set(registry.value_types())
    path = Path(__file__).resolve().parents[2] / "docs" / "contracts" / "form-schema.schema.json"
    assert path.exists()
    assert json.loads(path.read_text(encoding="utf-8"))["$defs"]["ColumnSchema"]
