package com.aug.record.provider.query;

import com.aug.record.api.ErrorCodes;
import com.aug.record.api.RecordQuery;
import com.aug.record.provider.common.BizException;
import com.aug.record.provider.common.TimeUtils;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * 查询参数校验与规范化。语义与 Python 侧 record_repo.normalize_paging / split_filters 对齐：
 * pageSize clamp [1,200]、filters ≤20 字段仅 str/number/boolean、空串跳过。
 */
@Component
public class QueryValidator {

    public static final int MAX_PAGE_SIZE = 200;
    public static final int MAX_FILTER_FIELDS = 20;

    private static final Pattern KEY_PATTERN = Pattern.compile("^[a-z][a-z0-9_]{1,63}$");

    private final ObjectMapper mapper;

    public QueryValidator() {
        this(new ObjectMapper());
    }

    public QueryValidator(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public NormalizedQuery normalize(RecordQuery query) {
        if (query == null) {
            throw validation("query 不能为空");
        }
        validateFormKey(query.getFormKey());
        String viewKey = trimToNull(query.getViewKey());
        if (viewKey != null) {
            validateViewKey(viewKey);
        }

        NormalizedQuery normalized = new NormalizedQuery();
        normalized.setFormKey(query.getFormKey());
        int current = query.getCurrent() == null ? 1 : query.getCurrent();
        normalized.setCurrent(Math.max(1, current));
        int pageSize = query.getPageSize() == null ? 20 : query.getPageSize();
        normalized.setPageSize(Math.max(1, Math.min(MAX_PAGE_SIZE, pageSize)));
        normalized.setStartTime(parseTime(query.getStartTime(), "startTime"));
        normalized.setEndTime(parseTime(query.getEndTime(), "endTime"));
        normalized.setKeyword(trimToNull(query.getKeyword()));
        normalized.setViewKey(viewKey);
        normalized.setFilters(parseFilters(query.getFilters()));
        return normalized;
    }

    public void validateFormKey(String formKey) {
        if (formKey == null || !KEY_PATTERN.matcher(formKey).matches()) {
            throw validation("formKey 必须匹配 ^[a-z][a-z0-9_]{1,63}$");
        }
    }

    public void validateViewKey(String viewKey) {
        if (viewKey == null || !KEY_PATTERN.matcher(viewKey).matches()) {
            throw validation("viewKey 必须匹配 ^[a-z][a-z0-9_]{1,63}$");
        }
    }

    private OffsetDateTime parseTime(String text, String field) {
        String value = trimToNull(text);
        if (value == null) {
            return null;
        }
        try {
            return TimeUtils.parseIso(value).withOffsetSameInstant(java.time.ZoneOffset.UTC);
        } catch (DateTimeParseException e) {
            throw validation(field + " 必须是 ISO 8601 时间：" + text);
        }
    }

    private List<FilterCondition> parseFilters(String filters) {
        List<FilterCondition> conditions = new ArrayList<FilterCondition>();
        String text = trimToNull(filters);
        if (text == null) {
            return conditions;
        }
        JsonNode root;
        try {
            root = mapper.readTree(text);
        } catch (JsonProcessingException e) {
            throw validation("filters 必须是合法 JSON 对象字符串");
        }
        if (root == null || !root.isObject()) {
            throw validation("filters 必须是 JSON 对象");
        }
        Iterator<Map.Entry<String, JsonNode>> fields = root.fields();
        while (fields.hasNext() && conditions.size() < MAX_FILTER_FIELDS) {
            Map.Entry<String, JsonNode> entry = fields.next();
            String field = entry.getKey();
            JsonNode value = entry.getValue();
            if (value == null || value.isNull()) {
                continue;
            }
            if (value.isTextual()) {
                String stringValue = value.asText();
                if (stringValue.isEmpty()) {
                    continue;
                }
                conditions.add(new FilterCondition(field, true, stringValue, null));
            } else if (value.isBoolean() || value.isNumber()) {
                conditions.add(new FilterCondition(field, false, null, value.toString()));
            } else {
                throw validation("filters 值仅支持 str / number / boolean：" + field);
            }
        }
        return conditions;
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static BizException validation(String message) {
        return new BizException(ErrorCodes.VALIDATION_ERROR, message);
    }
}
