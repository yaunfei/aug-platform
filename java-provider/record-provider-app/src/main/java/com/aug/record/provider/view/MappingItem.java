package com.aug.record.provider.view;

import java.util.List;
import java.util.Map;

/**
 * 单条映射规则（DSL 结构，见 docs/contracts/view-mapping.schema.json）。
 *
 * <p>valuePresent 用于区分 const 的 {@code value: null} 与「未提供 value」。</p>
 */
public record MappingItem(
        String from,
        String to,
        String type,
        Map<String, String> enumMap,
        String enumDefault,
        Integer scale,
        String format,
        Object value,
        boolean valuePresent,
        List<MappingItem> itemMappings) {
}
