package com.aug.record.provider.view;

import java.util.List;

/**
 * 解析后的视图映射配置。
 */
public record ViewConfig(
        String viewKey,
        String title,
        String formKey,
        String description,
        List<MappingItem> mappings) {
}
