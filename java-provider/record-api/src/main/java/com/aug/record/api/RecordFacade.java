package com.aug.record.api;

/**
 * 记录只读分发接口。所有方法永不向 Consumer 抛业务异常，统一返回 {@link Result} 信封。
 *
 * <p>getDetail 提供 2 参 / 3 参重载：hessian2 按字段名与方法签名序列化，
 * 新增 3 参重载对老 Consumer 零影响（不破坏原则）。</p>
 */
public interface RecordFacade {

    /**
     * 分页查询记录。query.viewKey 为空时原样透传 data。
     */
    Result<RecordPageDTO> listRecords(RecordQuery query);

    /**
     * 查询详情（原样透传）。
     */
    Result<RecordDetailDTO> getDetail(String formKey, long recordId);

    /**
     * 查询详情并按 viewKey 转换为下游目标格式。
     */
    Result<RecordDetailDTO> getDetail(String formKey, long recordId, String viewKey);
}
