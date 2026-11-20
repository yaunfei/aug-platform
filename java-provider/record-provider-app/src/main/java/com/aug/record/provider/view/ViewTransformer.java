package com.aug.record.provider.view;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jayway.jsonpath.JsonPath;
import com.jayway.jsonpath.PathNotFoundException;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 视图转换引擎：JsonPath 取值 → 类型转换 → 有序 Map 建树 → Jackson 序列化。
 *
 * <p>语义与 server/app/services/view_transform.py 逐条对齐，共享 fixtures（docs/contracts/view_cases）
 * 是唯一事实来源。</p>
 */
@Component
public class ViewTransformer {

    public static final int MAX_ARRAY_DEPTH = 2;

    private static final Object MISSING = new Object();
    private static final DateTimeFormatter PY_DEFAULT_PREFIX =
            DateTimeFormatter.ofPattern("uuuu-MM-dd'T'HH:mm:ss");

    private final ObjectMapper mapper;
    private final Map<String, JsonPath> pathCache = new ConcurrentHashMap<String, JsonPath>();

    public ViewTransformer() {
        this(new ObjectMapper());
    }

    public ViewTransformer(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public TransformResult transformJson(String recordJson, ViewConfig config) {
        try {
            return transform(mapper.readTree(recordJson), config);
        } catch (JsonProcessingException e) {
            throw new ViewMappingException("", "记录 JSON 解析失败：" + e.getOriginalMessage());
        }
    }

    public TransformResult transform(JsonNode record, ViewConfig config) {
        Object source = mapper.convertValue(record, Object.class);
        List<String> warnings = new ArrayList<String>();
        String recordId = recordIdOf(record);
        List<MappingItem> mappings = config.mappings() == null ? new ArrayList<MappingItem>() : config.mappings();
        LinkedHashMap<String, Object> output = transformObject(mappings, source, 0, warnings, recordId);
        JsonNode node = mapper.valueToTree(output);
        try {
            return new TransformResult(node, mapper.writeValueAsString(node), warnings);
        } catch (JsonProcessingException e) {
            throw new ViewMappingException("", "目标 JSON 序列化失败：" + e.getOriginalMessage());
        }
    }

    private LinkedHashMap<String, Object> transformObject(List<MappingItem> mappings,
                                                          Object source,
                                                          int depth,
                                                          List<String> warnings,
                                                          String recordId) {
        LinkedHashMap<String, Object> result = new LinkedHashMap<String, Object>();
        if (mappings == null) {
            return result;
        }
        for (MappingItem mapping : mappings) {
            Object value;
            try {
                value = transformValue(mapping, source, depth, warnings, recordId);
            } catch (ViewMappingException e) {
                throw e;
            } catch (RuntimeException e) {
                throw new ViewMappingException(mapping.to(), "转换失败：" + e.getMessage(), e);
            }
            if (value == MISSING) {
                continue;
            }
            setPath(result, mapping.to(), value);
        }
        return result;
    }

    private Object transformValue(MappingItem mapping,
                                  Object source,
                                  int depth,
                                  List<String> warnings,
                                  String recordId) {
        String type = mapping.type();
        String toPath = mapping.to();
        if ("const".equals(type)) {
            return mapping.value();
        }
        String from = mapping.from();
        if (from == null || from.isEmpty()) {
            return MISSING;
        }
        Object raw = read(source, from);
        if (raw == MISSING) {
            return MISSING;
        }
        try {
            switch (type) {
                case "string":
                    return toStr(raw);
                case "long":
                    return toLong(raw);
                case "double":
                    return toDouble(raw);
                case "decimal":
                    return toDecimal(raw, mapping.scale());
                case "boolean":
                    return toBoolean(raw);
                case "datetime":
                    return toDatetime(raw, mapping.format());
                case "enum":
                    return enumValue(mapping, raw, warnings, recordId, toPath);
                case "array":
                    return toArray(mapping, raw, depth, warnings, recordId);
                default:
                    throw new ViewMappingException(toPath, "未知 type：" + type);
            }
        } catch (ViewMappingException e) {
            throw e;
        } catch (RuntimeException e) {
            throw new ViewMappingException(toPath, type + " 转换失败：" + raw + "（" + e.getMessage() + "）", e);
        }
    }

    private Object read(Object source, String path) {
        try {
            JsonPath compiled = pathCache.computeIfAbsent(path, JsonPath::compile);
            Object value = compiled.read(source);
            return value == null ? null : value;
        } catch (PathNotFoundException e) {
            return MISSING;
        } catch (RuntimeException e) {
            // 类型不匹配（对标量取属性、对非数组取下标）等价于取不到值
            return MISSING;
        }
    }

    private Object toArray(MappingItem mapping,
                           Object raw,
                           int depth,
                           List<String> warnings,
                           String recordId) {
        if (depth + 1 > MAX_ARRAY_DEPTH) {
            throw new ViewMappingException(mapping.to(),
                    "array 嵌套深度超过 " + MAX_ARRAY_DEPTH + " 层：" + mapping.to());
        }
        if (!(raw instanceof List)) {
            return MISSING;
        }
        List<?> list = (List<?>) raw;
        List<Object> items = new ArrayList<Object>(list.size());
        for (Object item : list) {
            items.add(transformObject(mapping.itemMappings(), item, depth + 1, warnings, recordId));
        }
        return items;
    }

    private Object enumValue(MappingItem mapping,
                             Object raw,
                             List<String> warnings,
                             String recordId,
                             String toPath) {
        Map<String, String> enumMap = mapping.enumMap();
        String key = toStr(raw);
        if (enumMap != null && enumMap.containsKey(key)) {
            return enumMap.get(key);
        }
        String defaultValue = mapping.enumDefault();
        if (defaultValue != null) {
            warnings.add("recordId=" + recordId + " path=" + toPath + " raw=" + key
                    + " output=" + defaultValue + "（enumDefault fallback）");
            return defaultValue;
        }
        return MISSING;
    }

    private static String toStr(Object value) {
        if (value == null) {
            return "";
        }
        if (value instanceof String) {
            return (String) value;
        }
        if (value instanceof Boolean) {
            return ((Boolean) value) ? "true" : "false";
        }
        if (value instanceof Double || value instanceof Float) {
            return String.valueOf(value);
        }
        return String.valueOf(value);
    }

    private static long toLong(Object value) {
        if (value == null) {
            throw new IllegalArgumentException("null 无法转换为 long");
        }
        if (value instanceof Boolean) {
            return ((Boolean) value) ? 1L : 0L;
        }
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        if (value instanceof String) {
            return Long.parseLong(((String) value).trim());
        }
        throw new IllegalArgumentException("不支持转换为 long：" + value.getClass().getSimpleName());
    }

    private static double toDouble(Object value) {
        if (value == null) {
            throw new IllegalArgumentException("null 无法转换为 double");
        }
        if (value instanceof Boolean) {
            return ((Boolean) value) ? 1.0d : 0.0d;
        }
        if (value instanceof Number) {
            return ((Number) value).doubleValue();
        }
        if (value instanceof String) {
            return Double.parseDouble(((String) value).trim());
        }
        throw new IllegalArgumentException("不支持转换为 double：" + value.getClass().getSimpleName());
    }

    private static double toDecimal(Object value, Integer scale) {
        BigDecimal decimal = new BigDecimal(toStr(value));
        if (scale != null) {
            decimal = decimal.setScale(scale, RoundingMode.HALF_UP);
        }
        return decimal.doubleValue();
    }

    private static boolean toBoolean(Object value) {
        if (value == null) {
            return false;
        }
        if (value instanceof Boolean) {
            return (Boolean) value;
        }
        if (value instanceof String) {
            String text = ((String) value).trim().toLowerCase();
            return "true".equals(text) || "1".equals(text) || "yes".equals(text);
        }
        if (value instanceof Number) {
            return ((Number) value).doubleValue() != 0.0d;
        }
        if (value instanceof Collection) {
            return !((Collection<?>) value).isEmpty();
        }
        if (value instanceof Map) {
            return !((Map<?, ?>) value).isEmpty();
        }
        return true;
    }

    private static String toDatetime(Object value, String format) {
        String text = toStr(value);
        OffsetDateTime dt;
        try {
            dt = parseDateTime(text);
        } catch (RuntimeException e) {
            throw new IllegalArgumentException("datetime 解析失败：" + text);
        }
        dt = dt.withOffsetSameInstant(ZoneOffset.UTC);
        if (format == null || format.isEmpty()) {
            String base = PY_DEFAULT_PREFIX.format(dt);
            int micros = dt.getNano() / 1000;
            if (micros > 0) {
                base = base + "." + String.format(java.util.Locale.ROOT, "%06d", micros);
            }
            return base + "Z";
        }
        return DateTimeFormatter.ofPattern(format).withZone(ZoneOffset.UTC).format(dt);
    }

    private static OffsetDateTime parseDateTime(String text) {
        try {
            return OffsetDateTime.parse(text);
        } catch (RuntimeException ignored) {
            // fallthrough
        }
        try {
            return Instant.parse(text).atOffset(ZoneOffset.UTC);
        } catch (RuntimeException ignored) {
            // fallthrough
        }
        try {
            return LocalDateTime.parse(text).atOffset(ZoneOffset.UTC);
        } catch (RuntimeException ignored) {
            // fallthrough
        }
        return LocalDate.parse(text).atStartOfDay().atOffset(ZoneOffset.UTC);
    }

    private static void setPath(Map<String, Object> root, String path, Object value) {
        String[] parts = path.split("\\.", -1);
        Map<String, Object> current = root;
        for (int i = 0; i < parts.length - 1; i++) {
            Object next = current.get(parts[i]);
            if (!(next instanceof Map)) {
                Map<String, Object> created = new LinkedHashMap<String, Object>();
                current.put(parts[i], created);
                current = created;
            } else {
                @SuppressWarnings("unchecked")
                Map<String, Object> casted = (Map<String, Object>) next;
                current = casted;
            }
        }
        if (parts.length > 0) {
            current.put(parts[parts.length - 1], value);
        }
    }

    private static String recordIdOf(JsonNode record) {
        if (record == null) {
            return "None";
        }
        JsonNode id = record.get("id");
        if (id == null || id.isNull()) {
            return "None";
        }
        return id.asText();
    }
}
