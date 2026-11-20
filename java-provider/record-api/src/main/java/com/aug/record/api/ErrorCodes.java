package com.aug.record.api;

/**
 * Dubbo 分发错误码。与 REST 侧保持同一词汇表；视图映射相关错误码用于 §8.1 扩展。
 */
public final class ErrorCodes {

    public static final String VALIDATION_ERROR = "VALIDATION_ERROR";
    public static final String RECORD_NOT_FOUND = "RECORD_NOT_FOUND";
    public static final String INTERNAL_ERROR = "INTERNAL_ERROR";

    public static final String VIEW_NOT_FOUND = "VIEW_NOT_FOUND";
    public static final String VIEW_CONFIG_INVALID = "VIEW_CONFIG_INVALID";
    public static final String VIEW_MAPPING_ERROR = "VIEW_MAPPING_ERROR";

    private ErrorCodes() {
    }
}
