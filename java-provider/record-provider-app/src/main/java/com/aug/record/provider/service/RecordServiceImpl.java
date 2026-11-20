package com.aug.record.provider.service;

import com.aug.record.api.ErrorCodes;
import com.aug.record.api.RecordDTO;
import com.aug.record.api.RecordDetailDTO;
import com.aug.record.api.RecordFacade;
import com.aug.record.api.RecordPageDTO;
import com.aug.record.api.RecordQuery;
import com.aug.record.api.Result;
import com.aug.record.provider.common.BizException;
import com.aug.record.provider.common.TimeUtils;
import com.aug.record.provider.mapper.RecordMapper;
import com.aug.record.provider.mapper.RecordRow;
import com.aug.record.provider.query.NormalizedQuery;
import com.aug.record.provider.query.QueryValidator;
import com.aug.record.provider.view.TransformResult;
import com.aug.record.provider.view.ViewConfig;
import com.aug.record.provider.view.ViewConfigRepository;
import com.aug.record.provider.view.ViewMappingException;
import com.aug.record.provider.view.ViewTransformer;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.apache.dubbo.config.annotation.DubboService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;

/**
 * Dubbo 记录分发服务实现。
 *
 * <p>铁律：永不向 Consumer 抛异常；一切错误走 Result 信封。viewKey 为空时 data 原样透传，
 * 既有行为零回归；viewKey 非空时整页转换，任意一条失败 → 整页 VIEW_MAPPING_ERROR（不静默降级）。</p>
 */
@DubboService
public class RecordServiceImpl implements RecordFacade {

    private static final Logger log = LoggerFactory.getLogger(RecordServiceImpl.class);

    private final RecordMapper recordMapper;
    private final ViewConfigRepository viewConfigRepository;
    private final QueryValidator queryValidator;
    private final ViewTransformer viewTransformer;
    private final ObjectMapper objectMapper;

    public RecordServiceImpl(RecordMapper recordMapper,
                             ViewConfigRepository viewConfigRepository,
                             QueryValidator queryValidator,
                             ViewTransformer viewTransformer,
                             ObjectMapper objectMapper) {
        this.recordMapper = recordMapper;
        this.viewConfigRepository = viewConfigRepository;
        this.queryValidator = queryValidator;
        this.viewTransformer = viewTransformer;
        this.objectMapper = objectMapper;
    }

    @Override
    public Result<RecordPageDTO> listRecords(RecordQuery query) {
        try {
            NormalizedQuery normalized = queryValidator.normalize(query);
            long total = recordMapper.countRecords(normalized);
            int offset = (normalized.getCurrent() - 1) * normalized.getPageSize();
            List<RecordRow> rows = recordMapper.selectPage(normalized, offset, normalized.getPageSize());

            ViewConfig config = null;
            if (normalized.getViewKey() != null) {
                config = viewConfigRepository.get(normalized.getViewKey());
                if (config == null) {
                    return Result.fail(ErrorCodes.VIEW_NOT_FOUND,
                            "viewKey 不存在或未发布：" + normalized.getViewKey());
                }
            }

            List<RecordDTO> records = new ArrayList<RecordDTO>(rows.size());
            for (RecordRow row : rows) {
                RecordDTO dto = toDto(row);
                if (config != null) {
                    try {
                        dto.setData(transformData(dto.getId(), dto.getSchemaVersion(), dto.getCreatedAt(),
                                dto.getUpdatedAt(), dto.getCreatedBy(), dto.getData(), config));
                    } catch (ViewMappingException e) {
                        log.warn("view mapping failed, viewKey={}, recordId={}, path={}",
                                normalized.getViewKey(), dto.getId(), e.getPath(), e);
                        return Result.fail(ErrorCodes.VIEW_MAPPING_ERROR,
                                mappingMessage(normalized.getViewKey(), dto.getId(), e));
                    } catch (RuntimeException e) {
                        log.warn("view mapping failed, viewKey={}, recordId={}",
                                normalized.getViewKey(), dto.getId(), e);
                        return Result.fail(ErrorCodes.VIEW_MAPPING_ERROR,
                                "viewKey=" + normalized.getViewKey() + " recordId=" + dto.getId()
                                        + " path= " + e.getMessage());
                    }
                }
                records.add(dto);
            }

            RecordPageDTO page = new RecordPageDTO();
            page.setTotal(total);
            page.setCurrent(normalized.getCurrent());
            page.setPageSize(normalized.getPageSize());
            page.setRecords(records);
            return Result.ok(page);
        } catch (BizException e) {
            return Result.fail(e.getCode(), e.getMessage());
        } catch (Exception e) {
            log.error("listRecords failed, query={}", query, e);
            return Result.fail(ErrorCodes.INTERNAL_ERROR, "内部错误");
        }
    }

    @Override
    public Result<RecordDetailDTO> getDetail(String formKey, long recordId) {
        return getDetail(formKey, recordId, null);
    }

    @Override
    public Result<RecordDetailDTO> getDetail(String formKey, long recordId, String viewKey) {
        try {
            queryValidator.validateFormKey(formKey);
            String normalizedViewKey = viewKey == null || viewKey.trim().isEmpty() ? null : viewKey.trim();
            if (normalizedViewKey != null) {
                queryValidator.validateViewKey(normalizedViewKey);
            }
            RecordRow row = recordMapper.selectDetail(formKey, recordId);
            if (row == null) {
                return Result.fail(ErrorCodes.RECORD_NOT_FOUND,
                        "记录不存在：" + formKey + "/" + recordId);
            }
            RecordDetailDTO dto = toDetail(row);
            if (normalizedViewKey != null) {
                ViewConfig config = viewConfigRepository.get(normalizedViewKey);
                if (config == null) {
                    return Result.fail(ErrorCodes.VIEW_NOT_FOUND,
                            "viewKey 不存在或未发布：" + normalizedViewKey);
                }
                try {
                    dto.setData(transformData(dto.getId(), dto.getSchemaVersion(), dto.getCreatedAt(),
                            dto.getUpdatedAt(), dto.getCreatedBy(), dto.getData(), config));
                } catch (ViewMappingException e) {
                    log.warn("view mapping failed, viewKey={}, recordId={}, path={}",
                            normalizedViewKey, dto.getId(), e.getPath(), e);
                    return Result.fail(ErrorCodes.VIEW_MAPPING_ERROR,
                            mappingMessage(normalizedViewKey, dto.getId(), e));
                } catch (RuntimeException e) {
                    log.warn("view mapping failed, viewKey={}, recordId={}",
                            normalizedViewKey, dto.getId(), e);
                    return Result.fail(ErrorCodes.VIEW_MAPPING_ERROR,
                            "viewKey=" + normalizedViewKey + " recordId=" + dto.getId()
                                    + " path= " + e.getMessage());
                }
            }
            return Result.ok(dto);
        } catch (BizException e) {
            return Result.fail(e.getCode(), e.getMessage());
        } catch (Exception e) {
            log.error("getDetail failed, formKey={}, recordId={}", formKey, recordId, e);
            return Result.fail(ErrorCodes.INTERNAL_ERROR, "内部错误");
        }
    }

    private String transformData(Long id,
                                 Integer schemaVersion,
                                 String createdAt,
                                 String updatedAt,
                                 String createdBy,
                                 String data,
                                 ViewConfig config) {
        ObjectNode envelope = objectMapper.createObjectNode();
        if (id == null) {
            envelope.putNull("id");
        } else {
            envelope.put("id", id.longValue());
        }
        if (schemaVersion == null) {
            envelope.putNull("schemaVersion");
        } else {
            envelope.put("schemaVersion", schemaVersion.intValue());
        }
        envelope.put("createdAt", createdAt);
        envelope.put("updatedAt", updatedAt);
        envelope.put("createdBy", createdBy);
        JsonNode dataNode;
        try {
            String raw = data == null || data.trim().isEmpty() ? "{}" : data;
            dataNode = objectMapper.readTree(raw);
        } catch (JsonProcessingException e) {
            throw new ViewMappingException("", "记录 data 不是合法 JSON");
        }
        envelope.set("data", dataNode);
        TransformResult result = viewTransformer.transform(envelope, config);
        return result.outputJson();
    }

    private RecordDTO toDto(RecordRow row) {
        RecordDTO dto = new RecordDTO();
        dto.setId(row.getId());
        dto.setSchemaVersion(row.getSchemaVersion());
        dto.setCreatedAt(TimeUtils.toIso(row.getCreatedAt()));
        dto.setUpdatedAt(TimeUtils.toIso(row.getUpdatedAt()));
        dto.setCreatedBy(row.getCreatedBy());
        dto.setData(row.getData() == null ? "{}" : row.getData());
        return dto;
    }

    private RecordDetailDTO toDetail(RecordRow row) {
        RecordDetailDTO dto = new RecordDetailDTO();
        dto.setId(row.getId());
        dto.setSchemaVersion(row.getSchemaVersion());
        dto.setCreatedAt(TimeUtils.toIso(row.getCreatedAt()));
        dto.setUpdatedAt(TimeUtils.toIso(row.getUpdatedAt()));
        dto.setCreatedBy(row.getCreatedBy());
        dto.setData(row.getData() == null ? "{}" : row.getData());
        return dto;
    }

    private static String mappingMessage(String viewKey, Long recordId, ViewMappingException e) {
        return "viewKey=" + viewKey + " recordId=" + recordId + " path=" + e.getPath()
                + " " + e.getMessage();
    }
}
