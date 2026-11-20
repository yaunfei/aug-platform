package com.aug.record.provider.query;

import com.aug.record.api.ErrorCodes;
import com.aug.record.api.RecordQuery;
import com.aug.record.provider.common.BizException;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class QueryValidatorTest {

    private final QueryValidator validator = new QueryValidator();

    @Test
    void clampsPagingAndDefaults() {
        RecordQuery query = new RecordQuery();
        query.setFormKey("order_form");
        query.setCurrent(-3);
        query.setPageSize(1000);
        NormalizedQuery normalized = validator.normalize(query);
        assertEquals(1, normalized.getCurrent());
        assertEquals(200, normalized.getPageSize());

        RecordQuery defaults = new RecordQuery();
        defaults.setFormKey("order_form");
        NormalizedQuery normalizedDefaults = validator.normalize(defaults);
        assertEquals(1, normalizedDefaults.getCurrent());
        assertEquals(20, normalizedDefaults.getPageSize());
        assertNull(normalizedDefaults.getViewKey());
    }

    @Test
    void rejectsInvalidViewKey() {
        RecordQuery query = new RecordQuery();
        query.setFormKey("order_form");
        query.setViewKey("Bad-Key");
        BizException ex = assertThrows(BizException.class, () -> validator.normalize(query));
        assertEquals(ErrorCodes.VALIDATION_ERROR, ex.getCode());
    }

    @Test
    void rejectsInvalidFormKey() {
        RecordQuery query = new RecordQuery();
        query.setFormKey("../etc/passwd");
        assertThrows(BizException.class, () -> validator.normalize(query));
    }

    @Test
    void splitsFiltersAndSkipsEmptyStrings() {
        RecordQuery query = new RecordQuery();
        query.setFormKey("order_form");
        query.setFilters("{\"name\":\"张三\",\"empty\":\"\",\"count\":3,\"active\":true}");
        NormalizedQuery normalized = validator.normalize(query);
        assertEquals(3, normalized.getFilters().size());
        assertEquals("张三", normalized.getFilters().get(0).getStringValue());
        assertTrue(normalized.getFilters().get(0).isTextMatch());
        assertEquals("3", normalized.getFilters().get(1).getJsonLiteral());
        assertEquals("true", normalized.getFilters().get(2).getJsonLiteral());
    }

    @Test
    void limitsFiltersToTwentyFields() {
        StringBuilder json = new StringBuilder("{");
        for (int i = 0; i < 25; i++) {
            if (i > 0) {
                json.append(',');
            }
            json.append('"').append("f").append(i).append("\":\"v").append(i).append('"');
        }
        json.append('}');
        RecordQuery query = new RecordQuery();
        query.setFormKey("order_form");
        query.setFilters(json.toString());
        assertEquals(20, validator.normalize(query).getFilters().size());
    }

    @Test
    void rejectsInvalidFiltersJson() {
        RecordQuery query = new RecordQuery();
        query.setFormKey("order_form");
        query.setFilters("not-json");
        BizException ex = assertThrows(BizException.class, () -> validator.normalize(query));
        assertEquals(ErrorCodes.VALIDATION_ERROR, ex.getCode());
    }

    @Test
    void rejectsNestedFilterValues() {
        RecordQuery query = new RecordQuery();
        query.setFormKey("order_form");
        query.setFilters("{\"nested\":{\"a\":1}}");
        assertThrows(BizException.class, () -> validator.normalize(query));
    }

    @Test
    void parsesIsoTimeAndRejectsBadTime() {
        RecordQuery query = new RecordQuery();
        query.setFormKey("order_form");
        query.setStartTime("2026-07-01T00:00:00Z");
        query.setEndTime("2026-07-31T23:59:59+08:00");
        NormalizedQuery normalized = validator.normalize(query);
        assertEquals(OffsetDateTime.parse("2026-07-01T00:00:00Z"), normalized.getStartTime());
        assertEquals(OffsetDateTime.parse("2026-07-31T15:59:59Z"), normalized.getEndTime());

        RecordQuery bad = new RecordQuery();
        bad.setFormKey("order_form");
        bad.setStartTime("2026/07/01");
        assertThrows(BizException.class, () -> validator.normalize(bad));
    }
}
