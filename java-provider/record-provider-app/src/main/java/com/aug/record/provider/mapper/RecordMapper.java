package com.aug.record.provider.mapper;

import com.aug.record.provider.query.NormalizedQuery;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * form_record 只读查询。SQL 形状与 Python 侧 record_repo.py 一致（keyword 用 cast(data AS text) ILIKE）。
 */
public interface RecordMapper {

    long countRecords(@Param("q") NormalizedQuery q);

    List<RecordRow> selectPage(@Param("q") NormalizedQuery q,
                               @Param("offset") int offset,
                               @Param("limit") int limit);

    RecordRow selectDetail(@Param("formKey") String formKey, @Param("id") long id);
}
