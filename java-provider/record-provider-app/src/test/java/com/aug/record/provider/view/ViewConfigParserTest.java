package com.aug.record.provider.view;

import com.aug.record.api.ErrorCodes;
import com.aug.record.provider.common.BizException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ViewConfigParserTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final ViewConfigParser parser = new ViewConfigParser(mapper);

    private static final String VALID = "{\"viewKey\":\"v1\",\"title\":\"测试\",\"formKey\":\"order_form\","
            + "\"mappings\":[{\"from\":\"$.id\",\"to\":\"recordId\",\"type\":\"long\"}]}";

    @Test
    void parsesValidConfig() {
        ViewConfig config = parser.parse(VALID);
        assertEquals("v1", config.viewKey());
        assertEquals("order_form", config.formKey());
        assertEquals(1, config.mappings().size());
        assertEquals("recordId", config.mappings().get(0).to());
    }

    @Test
    void rejectsPrefixConflict() {
        String json = "{\"viewKey\":\"v1\",\"title\":\"t\",\"formKey\":\"order_form\",\"mappings\":["
                + "{\"from\":\"$.id\",\"to\":\"a.b\",\"type\":\"long\"},"
                + "{\"from\":\"$.data.name\",\"to\":\"a.b.c\",\"type\":\"string\"}]}";
        BizException ex = assertThrows(BizException.class, () -> parser.parse(json));
        assertEquals(ErrorCodes.VIEW_CONFIG_INVALID, ex.getCode());
        assertTrue(ex.getMessage().contains("前缀冲突"), ex.getMessage());
    }

    @Test
    void rejectsDuplicateTarget() {
        String json = "{\"viewKey\":\"v1\",\"title\":\"t\",\"formKey\":\"order_form\",\"mappings\":["
                + "{\"from\":\"$.id\",\"to\":\"a\",\"type\":\"long\"},"
                + "{\"from\":\"$.id\",\"to\":\"a\",\"type\":\"long\"}]}";
        BizException ex = assertThrows(BizException.class, () -> parser.parse(json));
        assertTrue(ex.getMessage().contains("重复"), ex.getMessage());
    }

    @Test
    void rejectsInvalidJson() {
        BizException ex = assertThrows(BizException.class, () -> parser.parse("{not-json"));
        assertEquals(ErrorCodes.VIEW_CONFIG_INVALID, ex.getCode());
    }

    @Test
    void rejectsInvalidToSegment() {
        String json = "{\"viewKey\":\"v1\",\"title\":\"t\",\"formKey\":\"order_form\",\"mappings\":["
                + "{\"from\":\"$.id\",\"to\":\"a.1b\",\"type\":\"long\"}]}";
        assertThrows(BizException.class, () -> parser.parse(json));
    }

    @Test
    void rejectsInvalidType() {
        String json = "{\"viewKey\":\"v1\",\"title\":\"t\",\"formKey\":\"order_form\",\"mappings\":["
                + "{\"from\":\"$.id\",\"to\":\"x\",\"type\":\"object\"}]}";
        BizException ex = assertThrows(BizException.class, () -> parser.parse(json));
        assertTrue(ex.getMessage().contains("type 非法"), ex.getMessage());
    }

    @Test
    void rejectsInvalidFromJsonPath() {
        String json = "{\"viewKey\":\"v1\",\"title\":\"t\",\"formKey\":\"order_form\",\"mappings\":["
                + "{\"from\":\"$.data[?]\",\"to\":\"x\",\"type\":\"string\"}]}";
        assertThrows(BizException.class, () -> parser.parse(json));
    }

    @Test
    void rejectsEnumWithoutMap() {
        String json = "{\"viewKey\":\"v1\",\"title\":\"t\",\"formKey\":\"order_form\",\"mappings\":["
                + "{\"from\":\"$.data.status\",\"to\":\"s\",\"type\":\"enum\"}]}";
        assertThrows(BizException.class, () -> parser.parse(json));
    }

    @Test
    void rejectsArrayWithoutItemMappings() {
        String json = "{\"viewKey\":\"v1\",\"title\":\"t\",\"formKey\":\"order_form\",\"mappings\":["
                + "{\"from\":\"$.data.x\",\"to\":\"x\",\"type\":\"array\"}]}";
        assertThrows(BizException.class, () -> parser.parse(json));
    }

    @Test
    void rejectsArrayDepthBeyondTwo() {
        String json = "{\"viewKey\":\"v1\",\"title\":\"t\",\"formKey\":\"order_form\",\"mappings\":["
                + "{\"from\":\"$.data.x\",\"to\":\"x\",\"type\":\"array\",\"itemMappings\":["
                + "{\"from\":\"$.middle\",\"to\":\"middle\",\"type\":\"array\",\"itemMappings\":["
                + "{\"from\":\"$.inner\",\"to\":\"inner\",\"type\":\"array\",\"itemMappings\":["
                + "{\"from\":\"$.v\",\"to\":\"v\",\"type\":\"string\"}]}]}]}]}";
        BizException ex = assertThrows(BizException.class, () -> parser.parse(json));
        assertTrue(ex.getMessage().contains("深度"), ex.getMessage());
    }

    @Test
    void rejectsConstWithoutValue() {
        String json = "{\"viewKey\":\"v1\",\"title\":\"t\",\"formKey\":\"order_form\",\"mappings\":["
                + "{\"to\":\"x\",\"type\":\"const\"}]}";
        assertThrows(BizException.class, () -> parser.parse(json));
    }

    @Test
    void allowsConstWithNullValue() {
        String json = "{\"viewKey\":\"v1\",\"title\":\"t\",\"formKey\":\"order_form\",\"mappings\":["
                + "{\"to\":\"x\",\"type\":\"const\",\"value\":null}]}";
        assertNotNull(parser.parse(json));
    }

    @Test
    void rejectsEmptyTitle() {
        String json = "{\"viewKey\":\"v1\",\"title\":\"\",\"formKey\":\"order_form\",\"mappings\":["
                + "{\"from\":\"$.id\",\"to\":\"x\",\"type\":\"long\"}]}";
        assertThrows(BizException.class, () -> parser.parse(json));
    }

    @Test
    void rejectsTooManyMappings() {
        ObjectNode root = baseRoot();
        ArrayNode mappings = mapper.createArrayNode();
        for (int i = 0; i < ViewConfigParser.MAX_MAPPINGS + 1; i++) {
            mappings.add(mapper.createObjectNode()
                    .put("from", "$.id").put("to", "f" + i).put("type", "long"));
        }
        root.set("mappings", mappings);
        BizException ex = assertThrows(BizException.class, () -> parser.parse(root.toString()));
        assertTrue(ex.getMessage().contains("100"), ex.getMessage());
    }

    @Test
    void rejectsOversizedConfig() throws Exception {
        ObjectNode root = baseRoot();
        ArrayNode mappings = mapper.createArrayNode();
        for (int i = 0; i < 90; i++) {
            mappings.add(mapper.createObjectNode()
                    .put("from", "$.id")
                    .put("to", "f" + i)
                    .put("type", "long")
                    .put("comment", "x".repeat(800)));
        }
        root.set("mappings", mappings);
        BizException ex = assertThrows(BizException.class, () -> parser.parse(root.toString()));
        assertTrue(ex.getMessage().contains("64KB"), ex.getMessage());
    }

    private ObjectNode baseRoot() {
        ObjectNode root = mapper.createObjectNode();
        root.put("viewKey", "v1");
        root.put("title", "t");
        root.put("formKey", "order_form");
        return root;
    }
}
