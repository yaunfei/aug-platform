package com.aug.record.provider.view;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;

/**
 * 转换结果：目标格式 JSON 树 + 序列化字符串 + 可观测 warnings（enumDefault fallback）。
 */
public record TransformResult(JsonNode output, String outputJson, List<String> warnings) {
}
