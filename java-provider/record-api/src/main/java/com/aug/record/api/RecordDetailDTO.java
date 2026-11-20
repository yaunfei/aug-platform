package com.aug.record.api;

import java.io.Serializable;

/**
 * 记录详情 DTO。语义对齐 REST 侧 GET /api/form/{formKey}/records/{id}。
 */
public class RecordDetailDTO implements Serializable {

    private static final long serialVersionUID = 1L;

    private Long id;
    private Integer schemaVersion;
    private String createdAt;
    private String updatedAt;
    private String createdBy;
    /** 记录 data 的 JSON 字符串；传 viewKey 时为转换后的目标格式 */
    private String data;

    public RecordDetailDTO() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Integer getSchemaVersion() {
        return schemaVersion;
    }

    public void setSchemaVersion(Integer schemaVersion) {
        this.schemaVersion = schemaVersion;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }

    public String getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(String updatedAt) {
        this.updatedAt = updatedAt;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }

    public String getData() {
        return data;
    }

    public void setData(String data) {
        this.data = data;
    }

    @Override
    public String toString() {
        return "RecordDetailDTO{id=" + id
                + ", schemaVersion=" + schemaVersion
                + ", createdAt='" + createdAt + '\''
                + ", updatedAt='" + updatedAt + '\''
                + ", createdBy='" + createdBy + '\''
                + ", data='" + data + '\''
                + '}';
    }
}
