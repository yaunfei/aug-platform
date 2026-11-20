package com.aug.record.provider.service;

import com.aug.record.api.ErrorCodes;
import com.aug.record.api.RecordDetailDTO;
import com.aug.record.api.RecordPageDTO;
import com.aug.record.api.RecordQuery;
import com.aug.record.api.Result;
import com.aug.record.provider.common.BizException;
import com.aug.record.provider.mapper.RecordMapper;
import com.aug.record.provider.mapper.RecordRow;
import com.aug.record.provider.mapper.ViewConfigMapper;
import com.aug.record.provider.query.NormalizedQuery;
import com.aug.record.provider.query.QueryValidator;
import com.aug.record.provider.view.ViewConfig;
import com.aug.record.provider.view.ViewConfigParser;
import com.aug.record.provider.view.ViewConfigRepository;
import com.aug.record.provider.view.ViewTransformer;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RecordServiceImplTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final FakeRecordMapper recordMapper = new FakeRecordMapper();
    private final FakeViewConfigRepository viewConfigRepository = new FakeViewConfigRepository();
    private final ViewConfigParser parser = new ViewConfigParser(mapper);

    private RecordServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new RecordServiceImpl(recordMapper, viewConfigRepository, new QueryValidator(),
                new ViewTransformer(mapper), mapper);
    }

    @Test
    void withoutViewKeyPassesDataThroughByteForByte() {
        String raw = "{\"customer_name\":\"张三\",\"amount\":1999.99}";
        recordMapper.total = 1L;
        recordMapper.rows = List.of(row(1L, raw));

        Result<RecordPageDTO> result = service.listRecords(query());
        assertTrue(result.isSuccess());
        assertEquals(raw, result.getData().getRecords().get(0).getData());
        assertEquals(0, viewConfigRepository.getCalls);
    }

    @Test
    void withViewKeyTransformsData() {
        viewConfigRepository.configs.put("v1", parse("{\"viewKey\":\"v1\",\"title\":\"t\","
                + "\"formKey\":\"order_form\",\"mappings\":["
                + "{\"from\":\"$.data.name\",\"to\":\"buyer.name\",\"type\":\"string\"}]}"));
        recordMapper.total = 1L;
        recordMapper.rows = List.of(row(1L, "{\"name\":\"张三\"}"));

        RecordQuery query = query();
        query.setViewKey("v1");
        Result<RecordPageDTO> result = service.listRecords(query);
        assertTrue(result.isSuccess());
        assertEquals("{\"buyer\":{\"name\":\"张三\"}}", result.getData().getRecords().get(0).getData());
    }

    @Test
    void unknownViewKeyReturnsViewNotFound() {
        recordMapper.total = 0L;
        recordMapper.rows = List.of();

        RecordQuery query = query();
        query.setViewKey("missing");
        Result<RecordPageDTO> result = service.listRecords(query);
        assertFalse(result.isSuccess());
        assertEquals(ErrorCodes.VIEW_NOT_FOUND, result.getErrorCode());
    }

    @Test
    void invalidConfigReturnsViewConfigInvalid() {
        viewConfigRepository.invalid.add("bad");
        recordMapper.total = 1L;
        recordMapper.rows = List.of(row(1L, "{}"));

        RecordQuery query = query();
        query.setViewKey("bad");
        Result<RecordPageDTO> result = service.listRecords(query);
        assertFalse(result.isSuccess());
        assertEquals(ErrorCodes.VIEW_CONFIG_INVALID, result.getErrorCode());
    }

    @Test
    void mappingFailureFailsWholePageWithContext() {
        viewConfigRepository.configs.put("v1", parse("{\"viewKey\":\"v1\",\"title\":\"t\","
                + "\"formKey\":\"order_form\",\"mappings\":["
                + "{\"from\":\"$.data.name\",\"to\":\"x\",\"type\":\"long\"}]}"));
        recordMapper.total = 1L;
        recordMapper.rows = List.of(row(1L, "{\"name\":\"not-a-number\"}"));

        RecordQuery query = query();
        query.setViewKey("v1");
        Result<RecordPageDTO> result = service.listRecords(query);
        assertFalse(result.isSuccess());
        assertEquals(ErrorCodes.VIEW_MAPPING_ERROR, result.getErrorCode());
        assertTrue(result.getErrorMessage().contains("viewKey=v1"), result.getErrorMessage());
        assertTrue(result.getErrorMessage().contains("recordId=1"), result.getErrorMessage());
        assertTrue(result.getErrorMessage().contains("path=x"), result.getErrorMessage());
    }

    @Test
    void validationErrorIsWrappedInEnvelope() {
        Result<RecordPageDTO> result = service.listRecords(null);
        assertFalse(result.isSuccess());
        assertEquals(ErrorCodes.VALIDATION_ERROR, result.getErrorCode());
    }

    @Test
    void detailWithoutViewKeyPassesDataThrough() {
        recordMapper.detail = row(7L, "{\"a\":1}");
        Result<RecordDetailDTO> result = service.getDetail("order_form", 7L);
        assertTrue(result.isSuccess());
        assertEquals("{\"a\":1}", result.getData().getData());
    }

    @Test
    void detailWithViewKeyTransformsData() {
        viewConfigRepository.configs.put("v1", parse("{\"viewKey\":\"v1\",\"title\":\"t\","
                + "\"formKey\":\"order_form\",\"mappings\":["
                + "{\"from\":\"$.data.a\",\"to\":\"value\",\"type\":\"long\"}]}"));
        recordMapper.detail = row(7L, "{\"a\":42}");

        Result<RecordDetailDTO> result = service.getDetail("order_form", 7L, "v1");
        assertTrue(result.isSuccess());
        assertEquals("{\"value\":42}", result.getData().getData());
    }

    @Test
    void missingRecordReturnsRecordNotFound() {
        recordMapper.detail = null;
        Result<RecordDetailDTO> result = service.getDetail("order_form", 99L);
        assertFalse(result.isSuccess());
        assertEquals(ErrorCodes.RECORD_NOT_FOUND, result.getErrorCode());
    }

    @Test
    void detailWithInvalidViewKeyReturnsValidationError() {
        Result<RecordDetailDTO> result = service.getDetail("order_form", 1L, "Bad-Key");
        assertFalse(result.isSuccess());
        assertEquals(ErrorCodes.VALIDATION_ERROR, result.getErrorCode());
    }

    private RecordQuery query() {
        RecordQuery query = new RecordQuery();
        query.setFormKey("order_form");
        return query;
    }

    private ViewConfig parse(String json) {
        return parser.parse(json);
    }

    private static RecordRow row(Long id, String data) {
        RecordRow row = new RecordRow();
        row.setId(id);
        row.setSchemaVersion(3);
        row.setCreatedAt(OffsetDateTime.parse("2026-07-01T12:00:00Z"));
        row.setUpdatedAt(OffsetDateTime.parse("2026-07-02T12:00:00Z"));
        row.setCreatedBy("tester");
        row.setData(data);
        return row;
    }

    static final class FakeRecordMapper implements RecordMapper {
        private long total;
        private List<RecordRow> rows = new ArrayList<RecordRow>();
        private RecordRow detail;

        @Override
        public long countRecords(NormalizedQuery q) {
            return total;
        }

        @Override
        public List<RecordRow> selectPage(NormalizedQuery q, int offset, int limit) {
            return rows;
        }

        @Override
        public RecordRow selectDetail(String formKey, long id) {
            return detail;
        }
    }

    static final class FakeViewConfigRepository extends ViewConfigRepository {
        private final Map<String, ViewConfig> configs = new HashMap<String, ViewConfig>();
        private final List<String> invalid = new ArrayList<String>();
        private int getCalls;

        private FakeViewConfigRepository() {
            super(new NoopViewConfigMapper(), new ViewConfigParser());
        }

        @Override
        public ViewConfig get(String viewKey) {
            getCalls++;
            if (invalid.contains(viewKey)) {
                throw new BizException(ErrorCodes.VIEW_CONFIG_INVALID, "bad config");
            }
            return configs.get(viewKey);
        }
    }

    static final class NoopViewConfigMapper implements ViewConfigMapper {
        @Override
        public String selectLatestMapping(String viewKey) {
            return null;
        }
    }
}
