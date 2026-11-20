package com.aug.record.provider.query;

/**
 * 已规范化的过滤条件。
 *
 * <p>textMatch=true：字符串模糊匹配 {@code data->>field ILIKE %v%}；
 * 否则：数字/布尔精确匹配 {@code data @> jsonb_build_object(field, v)}。</p>
 */
public class FilterCondition {

    private String field;
    private boolean textMatch;
    private String stringValue;
    /** 数字/布尔的 JSON 字面量，如 42 / 3.14 / true */
    private String jsonLiteral;

    public FilterCondition() {
    }

    public FilterCondition(String field, boolean textMatch, String stringValue, String jsonLiteral) {
        this.field = field;
        this.textMatch = textMatch;
        this.stringValue = stringValue;
        this.jsonLiteral = jsonLiteral;
    }

    public String getField() {
        return field;
    }

    public void setField(String field) {
        this.field = field;
    }

    public boolean isTextMatch() {
        return textMatch;
    }

    public void setTextMatch(boolean textMatch) {
        this.textMatch = textMatch;
    }

    public String getStringValue() {
        return stringValue;
    }

    public void setStringValue(String stringValue) {
        this.stringValue = stringValue;
    }

    public String getJsonLiteral() {
        return jsonLiteral;
    }

    public void setJsonLiteral(String jsonLiteral) {
        this.jsonLiteral = jsonLiteral;
    }
}
