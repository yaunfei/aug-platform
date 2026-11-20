"""组件注册表测试。"""

from __future__ import annotations

from app import registry


def test_registry_has_50_components():
    assert len(registry.components()) == 50
    assert len(registry.value_types()) == 50
    assert len(set(registry.value_types())) == 50


def test_derived_sets_from_single_source():
    assert registry.requires_value_enum() == {
        "select",
        "radio",
        "checkbox",
        "radioButton",
        "segmented",
    }
    assert registry.custom_types() == {
        "phone",
        "imageUpload",
        "pagUpload",
        "inputUpload",
        "peopleGroup",
    }
    assert registry.layout_types() == {"group", "divider", "formList"}
    assert registry.children_required_types() == {"group", "formList"}
    assert registry.allowed_field_props("imageUpload") == ("maxSizeMB",)


def test_every_component_has_criteria():
    for spec in registry.components():
        assert spec.label
        assert spec.criteria


def test_public_projection_has_no_prompt_assets():
    for item in registry.public_components():
        assert set(item) == {
            "valueType",
            "label",
            "custom",
            "frontendRenderer",
            "requiresValueEnum",
            "layout",
            "childrenPolicy",
            "allowedFieldProps",
        }


def test_few_shots_include_custom_component():
    shots = registry.few_shots()
    names = [shot["name"] for shot in shots]
    assert any("imageUpload" in name for name in names)


def test_prompt_contains_all_components():
    lines = registry.criteria_lines()
    assert len(lines) == 50
    for value_type in registry.value_types():
        assert any(line.startswith(f"- {value_type}（") for line in lines)
