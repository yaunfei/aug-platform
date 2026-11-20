package com.aug.record.provider.mapper;

import org.apache.ibatis.annotations.Param;

/**
 * view_config 只读查询：取某 viewKey 最新已发布版本的 mapping_json。
 */
public interface ViewConfigMapper {

    String selectLatestMapping(@Param("viewKey") String viewKey);
}
