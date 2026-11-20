package com.aug.record.provider.common;

/**
 * 业务异常：code 取 {@code com.aug.record.api.ErrorCodes} 常量。
 */
public class BizException extends RuntimeException {

    private final String code;

    public BizException(String code, String message) {
        super(message);
        this.code = code;
    }

    public BizException(String code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
