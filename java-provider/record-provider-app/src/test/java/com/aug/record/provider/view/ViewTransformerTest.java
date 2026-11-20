package com.aug.record.provider.view;

import com.aug.record.provider.TestFixtures;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 共享 fixtures（docs/contracts/view_cases）驱动的转换语义对齐测试。
 */
class ViewTransformerTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final ViewConfigParser parser = new ViewConfigParser(mapper);
    private final ViewTransformer transformer = new ViewTransformer(mapper);

    static List<Path> cases() {
        return TestFixtures.viewCases();
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("cases")
    void fixturesMatchReferenceEngine(Path path) throws Exception {
        JsonNode fixture = TestFixtures.read(path, mapper);
        String name = fixture.get("name").asText();
        String configJson = mapper.writeValueAsString(fixture.get("config"));

        if (fixture.has("expectedError")) {
            com.aug.record.provider.common.BizException ex = assertThrows(
                    com.aug.record.provider.common.BizException.class,
                    () -> parser.parse(configJson));
            assertEquals(fixture.get("expectedError").asText(), ex.getCode());
            if (fixture.has("expectedErrorContains")) {
                assertTrue(ex.getMessage().contains(fixture.get("expectedErrorContains").asText()),
                        "错误信息应包含 " + fixture.get("expectedErrorContains").asText() + "，实际：" + ex.getMessage());
            }
            return;
        }

        ViewConfig config = parser.parse(configJson);
        TransformResult result = transformer.transform(fixture.get("inputRecord"), config);
        TestFixtures.assertJsonEquals(fixture.get("expectedOutput"), result.output());

        if ("case12_historical_enum_mismatch".equals(name)) {
            assertFalse(result.warnings().isEmpty());
            String warning = result.warnings().get(0);
            assertTrue(warning.contains("pending"), warning);
            assertTrue(warning.contains("未知"), warning);
            assertTrue(warning.contains("path=orderStatus"), warning);
            assertTrue(warning.contains("enumDefault fallback"), warning);
        }
    }

    @Test
    void emptyMappingsProduceEmptyObject() {
        ViewConfig config = new ViewConfig("v1", "t", "order_form", null, List.of());
        TransformResult result = transformer.transformJson("{\"id\":1,\"data\":{}}", config);
        assertEquals("{}", result.outputJson());
    }

    @Test
    void nonListArraySourceIsOmitted() {
        MappingItem mapping = new MappingItem("$.data.contacts", "contacts", "array",
                null, null, null, null, null, false,
                List.of(new MappingItem("$.name", "name", "string", null, null, null, null, null, false, null)));
        ViewConfig config = new ViewConfig("v1", "t", "order_form", null, List.of(mapping));
        TransformResult result = transformer.transformJson(
                "{\"id\":1,\"data\":{\"contacts\":\"not-a-list\"}}", config);
        assertEquals("{}", result.outputJson());
    }

    @Test
    void nullStringValueBecomesEmptyString() {
        MappingItem mapping = new MappingItem("$.data.name", "name", "string",
                null, null, null, null, null, false, null);
        ViewConfig config = new ViewConfig("v1", "t", "order_form", null, List.of(mapping));
        TransformResult result = transformer.transformJson(
                "{\"id\":1,\"data\":{\"name\":null}}", config);
        assertEquals("{\"name\":\"\"}", result.outputJson());
    }

    @Test
    void booleanToLongUsesOneAndZero() {
        MappingItem mapping = new MappingItem("$.data.active", "active", "long",
                null, null, null, null, null, false, null);
        ViewConfig config = new ViewConfig("v1", "t", "order_form", null, List.of(mapping));
        TransformResult result = transformer.transformJson(
                "{\"id\":1,\"data\":{\"active\":true}}", config);
        assertEquals("{\"active\":1}", result.outputJson());
    }

    @Test
    void datetimeDefaultFormatKeepsMicroseconds() {
        MappingItem mapping = new MappingItem("$.createdAt", "createTime", "datetime",
                null, null, null, null, null, false, null);
        ViewConfig config = new ViewConfig("v1", "t", "order_form", null, List.of(mapping));
        TransformResult result = transformer.transformJson(
                "{\"id\":1,\"createdAt\":\"2026-07-01T12:00:00.123456Z\",\"data\":{}}", config);
        assertEquals("{\"createTime\":\"2026-07-01T12:00:00.123456Z\"}", result.outputJson());
    }

    @Test
    void transformerRejectsArrayDepthBeyondTwo() {
        MappingItem leaf = new MappingItem("$.v", "v", "string", null, null, null, null, null, false, null);
        MappingItem inner = new MappingItem("$.inner", "inner", "array", null, null, null, null, null,
                false, List.of(leaf));
        MappingItem middle = new MappingItem("$.middle", "middle", "array", null, null, null, null, null,
                false, List.of(inner));
        MappingItem outer = new MappingItem("$.data.x", "x", "array", null, null, null, null, null,
                false, List.of(middle));
        ViewConfig config = new ViewConfig("v1", "t", "order_form", null, List.of(outer));

        ViewMappingException ex = assertThrows(ViewMappingException.class,
                () -> transformer.transformJson(
                        "{\"id\":1,\"data\":{\"x\":[{\"middle\":[{\"inner\":[{\"v\":\"a\"}]}]}]}}", config));
        assertTrue(ex.getMessage().contains("深度"), ex.getMessage());
    }
}
