package com.aug.record.api;

import java.io.Serializable;

/**
 * Dubbo 统一响应信封。业务异常一律转换为 {@code success=false} 的 Result，永不向 Consumer 抛异常。
 *
 * @param <T> 业务数据类型
 */
public class Result<T> implements Serializable {

    private static final long serialVersionUID = 1L;

    private boolean success;
    private T data;
    private String errorCode;
    private String errorMessage;

    public Result() {
    }

    public static <T> Result<T> ok(T data) {
        Result<T> result = new Result<T>();
        result.success = true;
        result.data = data;
        return result;
    }

    public static <T> Result<T> fail(String errorCode, String errorMessage) {
        Result<T> result = new Result<T>();
        result.success = false;
        result.errorCode = errorCode;
        result.errorMessage = errorMessage;
        return result;
    }

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public T getData() {
        return data;
    }

    public void setData(T data) {
        this.data = data;
    }

    public String getErrorCode() {
        return errorCode;
    }

    public void setErrorCode(String errorCode) {
        this.errorCode = errorCode;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }

    @Override
    public String toString() {
        return "Result{success=" + success
                + ", errorCode='" + errorCode + '\''
                + ", errorMessage='" + errorMessage + '\''
                + ", data=" + data + '}';
    }
}
