package com.aug.record.provider.view;

import com.aug.record.api.ErrorCodes;
import com.aug.record.provider.common.BizException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jayway.jsonpath.JsonPath;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * 视图映射 DSL 解析 + 契约校验。
 *
 * <p>Provider 侧必须独立校验，不能只依赖 Python 发布时的校验——防止通过其它途径入库的脏配置
 * 在运行时炸掉。所有非法结构统一抛 {@link BizException}(VIEW_CONFIG_INVALID)。</p>
 */
@Component
public class ViewConfigParser {

    public static final int MAX_MAPPINGS = 100;
    public static final int MAX_SERIALIZED_BYTES = 64 * 1024;
    public static final int MAX_ARRAY_DEPTH = 2;

    private static final Pattern KEY_PATTERN = Pattern.compile("^[a-z][a-z0-9_]{1,63}$");
    private static final Pattern IDENT_PATTERN = Pattern.compile("^[A-Za-z_][A-Za-z0-9_]*$");
    private static final Set<String> TYPES = new HashSet<String>();

    static {
        TYPES.add("string");
        TYPES.add("long");
        TYPES.add("double");
        TYPES.add("decimal");
        TYPES.add("boolean");
        TYPES.add("datetime");
        TYPES.add("enum");
        TYPES.add("array");
        TYPES.add("const");
    }

    private final ObjectMapper mapper;

    public ViewConfigParser() {
        this(new ObjectMapper());
    }

    public ViewConfigParser(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public ViewConfig parse(String json) {
        if (json == null || json.trim().isEmpty()) {
            throw invalid("视图配置为空");
        }
        JsonNode root;
        try {
            root = mapper.readTree(json);
        } catch (JsonProcessingException e) {
            throw invalid("视图配置不是合法 JSON：" + e.getOriginalMessage());
        }
        if (root == null || !root.isObject()) {
            throw invalid("视图配置必须是 JSON 对象");
        }

        String viewKey = requireText(root.get("viewKey"), "viewKey");
        if (!KEY_PATTERN.matcher(viewKey).matches()) {
            throw invalid("viewKey 必须匹配 ^[a-z][a-z0-9_]{1,63}$");
        }
        String formKey = requireText(root.get("formKey"), "formKey");
        if (!KEY_PATTERN.matcher(formKey).matches()) {
            throw invalid("formKey 必须匹配 ^[a-z][a-z0-9_]{1,63}$");
        }
        String title = requireText(root.get("title"), "title");
        if (title.isEmpty() || title.codePointCount(0, title.length()) > 128) {
            throw invalid("title 必须为 1-128 字符字符串");
        }
        String description = null;
        JsonNode descriptionNode = root.get("description");
        if (descriptionNode != null && !descriptionNode.isNull()) {
            if (!descriptionNode.isTextual()) {
                throw invalid("description 必须是字符串");
            }
            description = descriptionNode.asText();
        }

        JsonNode mappingsNode = root.get("mappings");
        if (mappingsNode == null || !mappingsNode.isArray() || mappingsNode.size() == 0) {
            throw invalid("mappings 必须是非空数组");
        }
        if (mappingsNode.size() > MAX_MAPPINGS) {
            throw invalid("mappings 不能超过 " + MAX_MAPPINGS + " 条");
        }

        List<MappingItem> mappings = new ArrayList<MappingItem>();
        Set<String> seen = new HashSet<String>();
        for (int i = 0; i < mappingsNode.size(); i++) {
            JsonNode node = mappingsNode.get(i);
            if (node == null || !node.isObject()) {
                throw invalid("第 " + (i + 1) + " 条映射必须是对象");
            }
            mappings.add(parseMapping(node, seen, 0, i));
        }

        int bytes = json.getBytes(StandardCharsets.UTF_8).length;
        if (bytes > MAX_SERIALIZED_BYTES) {
            throw invalid("视图配置序列化后 " + bytes + " 字节，超过 64KB 上限");
        }
        return new ViewConfig(viewKey, title, formKey, description, mappings);
    }

    private MappingItem parseMapping(JsonNode node, Set<String> siblingTargets, int depth, int index) {
        String to = requireText(node.get("to"), "第 " + (index + 1) + " 条映射缺少 to");
        if (to.isEmpty()) {
            throw invalid("第 " + (index + 1) + " 条映射缺少 to");
        }
        String[] segments = to.split("\\.", -1);
        for (String segment : segments) {
            if (!IDENT_PATTERN.matcher(segment).matches()) {
                throw invalid("to 路径段非法标识符：" + to);
            }
        }
        if (siblingTargets.contains(to)) {
            throw invalid("to 路径重复：" + to);
        }
        for (String existing : siblingTargets) {
            if (to.startsWith(existing + ".") || existing.startsWith(to + ".")) {
                throw invalid("to 路径前缀冲突：" + existing + " 与 " + to);
            }
        }
        siblingTargets.add(to);

        String type = requireText(node.get("type"), "第 " + (index + 1) + " 条映射缺少 type");
        if (!TYPES.contains(type)) {
            throw invalid("第 " + (index + 1) + " 条映射 type 非法：" + type);
        }

        if ("const".equals(type)) {
            boolean valuePresent = node.has("value");
            if (!valuePresent) {
                throw invalid("第 " + (index + 1) + " 条 const 映射必须提供 value");
            }
            Object value = mapper.convertValue(node.get("value"), Object.class);
            return new MappingItem(null, to, type, null, null, null, null, value, true, null);
        }

        String from = requireText(node.get("from"), "第 " + (index + 1) + " 条映射必须提供 from 或 const");
        if (from.isEmpty()) {
            throw invalid("第 " + (index + 1) + " 条映射必须提供 from 或 const");
        }
        try {
            JsonPath.compile(from);
        } catch (RuntimeException e) {
            throw invalid("第 " + (index + 1) + " 条 from 非法：" + from);
        }

        if ("array".equals(type)) {
            if (depth + 1 > MAX_ARRAY_DEPTH) {
                throw invalid("array 嵌套深度超过 " + MAX_ARRAY_DEPTH + " 层：" + to);
            }
            JsonNode itemMappingsNode = node.get("itemMappings");
            if (itemMappingsNode == null || !itemMappingsNode.isArray() || itemMappingsNode.size() == 0) {
                throw invalid("第 " + (index + 1) + " 条 array 映射必须提供非空 itemMappings");
            }
            for (JsonNode item : itemMappingsNode) {
                if (item == null || !item.isObject()) {
                    throw invalid("第 " + (index + 1) + " 条 itemMappings 元素必须是对象");
                }
                JsonNode itemFrom = item.get("from");
                if (itemFrom == null || !itemFrom.isTextual() || itemFrom.asText().isEmpty()) {
                    throw invalid("第 " + (index + 1) + " 条 itemMappings 元素必须提供 from");
                }
            }
            List<MappingItem> itemMappings = new ArrayList<MappingItem>();
            Set<String> itemSeen = new HashSet<String>();
            for (JsonNode item : itemMappingsNode) {
                itemMappings.add(parseMapping(item, itemSeen, depth + 1, index));
            }
            return new MappingItem(from, to, type, null, null, null, null, null, false, itemMappings);
        }

        Map<String, String> enumMap = null;
        String enumDefault = null;
        if ("enum".equals(type)) {
            JsonNode enumMapNode = node.get("enumMap");
            if (enumMapNode == null || !enumMapNode.isObject() || enumMapNode.size() == 0) {
                throw invalid("第 " + (index + 1) + " 条 enum 映射必须提供非空 enumMap");
            }
            enumMap = new LinkedHashMap<String, String>();
            Iterator<Map.Entry<String, JsonNode>> fields = enumMapNode.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> entry = fields.next();
                if (entry.getValue() == null || !entry.getValue().isTextual()) {
                    throw invalid("第 " + (index + 1) + " 条 enumMap 的值必须是字符串");
                }
                enumMap.put(entry.getKey(), entry.getValue().asText());
            }
            JsonNode defaultNode = node.get("enumDefault");
            if (defaultNode != null && !defaultNode.isNull()) {
                if (!defaultNode.isTextual()) {
                    throw invalid("第 " + (index + 1) + " 条 enumDefault 必须是字符串");
                }
                enumDefault = defaultNode.asText();
            }
        }

        String format = null;
        if ("datetime".equals(type)) {
            JsonNode formatNode = node.get("format");
            if (formatNode != null && !formatNode.isNull()) {
                if (!formatNode.isTextual()) {
                    throw invalid("第 " + (index + 1) + " 条 datetime format 必须是字符串");
                }
                format = formatNode.asText();
            }
        }

        Integer scale = null;
        if ("decimal".equals(type)) {
            JsonNode scaleNode = node.get("scale");
            if (scaleNode != null && !scaleNode.isNull()) {
                if (!scaleNode.isInt() || scaleNode.asInt() < 0 || scaleNode.asInt() > 10) {
                    throw invalid("第 " + (index + 1) + " 条 decimal scale 必须是 0-10 的整数");
                }
                scale = scaleNode.asInt();
            }
        }

        return new MappingItem(from, to, type, enumMap, enumDefault, scale, format, null, false, null);
    }

    private static String requireText(JsonNode node, String message) {
        if (node == null || !node.isTextual()) {
            throw invalid(message);
        }
        return node.asText();
    }

    private static BizException invalid(String message) {
        return new BizException(ErrorCodes.VIEW_CONFIG_INVALID, message);
    }
}
