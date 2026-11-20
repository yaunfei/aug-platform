package com.aug.record.provider.view;

import com.aug.record.api.ErrorCodes;
import com.aug.record.provider.common.BizException;
import com.aug.record.provider.mapper.ViewConfigMapper;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ViewConfigRepositoryTest {

    private static final String CONFIG = "{\"viewKey\":\"v1\",\"title\":\"t\",\"formKey\":\"order_form\","
            + "\"mappings\":[{\"from\":\"$.id\",\"to\":\"recordId\",\"type\":\"long\"}]}";

    private final CountingMapper mapper = new CountingMapper();
    private final ViewConfigRepository repository = new ViewConfigRepository(mapper, new ViewConfigParser());

    @Test
    void cachesParsedConfigForTtl() {
        mapper.values.put("v1", CONFIG);
        assertNotNull(repository.get("v1"));
        assertNotNull(repository.get("v1"));
        assertEquals(1, mapper.calls);
    }

    @Test
    void cachesMissingConfig() {
        assertNull(repository.get("missing"));
        assertNull(repository.get("missing"));
        assertEquals(1, mapper.calls);
    }

    @Test
    void invalidateForcesReload() {
        mapper.values.put("v1", CONFIG);
        repository.get("v1");
        repository.invalidate("v1");
        repository.get("v1");
        assertEquals(2, mapper.calls);
    }

    @Test
    void invalidConfigRaisesViewConfigInvalid() {
        mapper.values.put("bad", "{\"viewKey\":\"bad\"}");
        BizException ex = assertThrows(BizException.class, () -> repository.get("bad"));
        assertEquals(ErrorCodes.VIEW_CONFIG_INVALID, ex.getCode());
    }

    static final class CountingMapper implements ViewConfigMapper {
        private final Map<String, String> values = new HashMap<String, String>();
        private int calls;

        @Override
        public String selectLatestMapping(String viewKey) {
            calls++;
            return values.get(viewKey);
        }
    }
}
