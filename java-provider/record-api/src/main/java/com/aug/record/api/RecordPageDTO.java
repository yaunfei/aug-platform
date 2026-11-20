package com.aug.record.api;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

/**
 * 分页结果。total 为满足过滤条件的总行数，records 为当前页。
 */
public class RecordPageDTO implements Serializable {

    private static final long serialVersionUID = 1L;

    private long total;
    private int current;
    private int pageSize;
    private List<RecordDTO> records = new ArrayList<RecordDTO>();

    public RecordPageDTO() {
    }

    public long getTotal() {
        return total;
    }

    public void setTotal(long total) {
        this.total = total;
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

    public List<RecordDTO> getRecords() {
        return records;
    }

    public void setRecords(List<RecordDTO> records) {
        this.records = records;
    }

    @Override
    public String toString() {
        return "RecordPageDTO{total=" + total
                + ", current=" + current
                + ", pageSize=" + pageSize
                + ", records=" + records + '}';
    }
}
