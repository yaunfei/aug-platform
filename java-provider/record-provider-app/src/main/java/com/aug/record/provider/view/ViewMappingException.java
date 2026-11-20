package com.aug.record.provider.view;

/**
 * 单条记录转换失败。path 为目标字段路径，用于拼装 VIEW_MAPPING_ERROR 信封。
 */
public class ViewMappingException extends RuntimeException {

    private final String path;

    public ViewMappingException(String path, String message) {
        super(message);
        this.path = path == null ? "" : path;
    }

    public ViewMappingException(String path, String message, Throwable cause) {
        super(message, cause);
        this.path = path == null ? "" : path;
    }

    public String getPath() {
        return path;
    }
}
