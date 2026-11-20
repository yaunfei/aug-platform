package com.aug.record.provider.query;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 规范化查询：分页 clamp、时间已解析、filters 已拆分。
 */
public class NormalizedQuery {

    private String formKey;
    private int current = 1;
    private int pageSize = 20;
    private OffsetDateTime startTime;
    private OffsetDateTime endTime;
    private String keyword;
    private String viewKey;
    private List<FilterCondition> filters = new ArrayList<FilterCondition>();

    public String getFormKey() {
        return formKey;
    }

    public void setFormKey(String formKey) {
        this.formKey = formKey;
    }

    public int getCurrent() {
        return current;
    }

    public void setCurrent(int current) {
        this.current = current;
    }

    public int getPageSize() {
        return pageSize;
    }

    public void setPageSize(int pageSize) {
        this.pageSize = pageSize;
    }

    public OffsetDateTime getStartTime() {
        return startTime;
    }

    public void setStartTime(OffsetDateTime startTime) {
        this.startTime = startTime;
    }

    public OffsetDateTime getEndTime() {
        return endTime;
    }

    public void setEndTime(OffsetDateTime endTime) {
        this.endTime = endTime;
    }

    public String getKeyword() {
        return keyword;
    }

    public void setKeyword(String keyword) {
        this.keyword = keyword;
    }

    public String getViewKey() {
        return viewKey;
    }

    public void setViewKey(String viewKey) {
        this.viewKey = viewKey;
    }

    public List<FilterCondition> getFilters() {
        return filters;
    }

    public void setFilters(List<FilterCondition> filters) {
        this.filters = filters;
    }
}
