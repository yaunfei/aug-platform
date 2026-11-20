package com.aug.record.api;

import java.io.Serializable;

/**
 * 记录查询参数。语义与 REST 侧 GET /api/form/{formKey}/records 逐条对齐。
 *
 * <p>viewKey 为可选字段：不传（null/空串）= 原样透传，既有 Dubbo 分发行为永不改变。</p>
 */
public class RecordQuery implements Serializable {

    private static final long serialVersionUID = 1L;

    private String formKey;
    private Integer current;
    private Integer pageSize;
    /** ISO-8601，闭区间下界 */
    private String startTime;
    /** ISO-8601，闭区间上界 */
    private String endTime;
    private String keyword;
    /** JSON 对象字符串，值仅允许 str/number/boolean */
    private String filters;
    /** 可选：视图映射标识；为空表示原样透传 */
    private String viewKey;

    public RecordQuery() {
    }

    public String getFormKey() {
        return formKey;
    }

    public void setFormKey(String formKey) {
        this.formKey = formKey;
    }

    public Integer getCurrent() {
        return current;
    }

    public void setCurrent(Integer current) {
        this.current = current;
    }

    public Integer getPageSize() {
        return pageSize;
    }

    public void setPageSize(Integer pageSize) {
        this.pageSize = pageSize;
    }

    public String getStartTime() {
        return startTime;
    }

    public void setStartTime(String startTime) {
        this.startTime = startTime;
    }

    public String getEndTime() {
        return endTime;
    }

    public void setEndTime(String endTime) {
        this.endTime = endTime;
    }

    public String getKeyword() {
        return keyword;
    }

    public void setKeyword(String keyword) {
        this.keyword = keyword;
    }

    public String getFilters() {
        return filters;
    }

    public void setFilters(String filters) {
        this.filters = filters;
    }

    public String getViewKey() {
        return viewKey;
    }

    public void setViewKey(String viewKey) {
        this.viewKey = viewKey;
    }

    @Override
    public String toString() {
        return "RecordQuery{formKey='" + formKey + '\''
                + ", current=" + current
                + ", pageSize=" + pageSize
                + ", startTime='" + startTime + '\''
                + ", endTime='" + endTime + '\''
                + ", keyword='" + keyword + '\''
                + ", filters='" + filters + '\''
                + ", viewKey='" + viewKey + '\''
                + '}';
    }
}
