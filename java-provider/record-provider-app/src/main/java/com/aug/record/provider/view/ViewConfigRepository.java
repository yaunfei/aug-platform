package com.aug.record.provider.view;

import com.aug.record.provider.mapper.ViewConfigMapper;
import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;

/**
 * view_config 读取 + TTL(30s) 内存缓存。
 *
 * <p>发布/回滚后最多 30 秒生效；紧急情况可重启 Provider 立即刷新。</p>
 */
@Component
public class ViewConfigRepository {

    public static final long TTL_MILLIS = 30_000L;

    private final ViewConfigMapper viewConfigMapper;
    private final ViewConfigParser parser;
    private final ConcurrentHashMap<String, CacheEntry> cache = new ConcurrentHashMap<String, CacheEntry>();

    public ViewConfigRepository(ViewConfigMapper viewConfigMapper, ViewConfigParser parser) {
        this.viewConfigMapper = viewConfigMapper;
        this.parser = parser;
    }

    /**
     * @return 解析后的配置；不存在或未发布返回 null
     * @throws com.aug.record.provider.common.BizException VIEW_CONFIG_INVALID（配置非法）
     */
    public ViewConfig get(String viewKey) {
        long now = System.currentTimeMillis();
        CacheEntry cached = cache.get(viewKey);
        if (cached != null && now < cached.expiresAt) {
            return cached.config;
        }
        String mappingJson = viewConfigMapper.selectLatestMapping(viewKey);
        ViewConfig config = null;
        if (mappingJson != null && !mappingJson.trim().isEmpty()) {
            config = parser.parse(mappingJson);
        }
        cache.put(viewKey, new CacheEntry(config, now + TTL_MILLIS));
        return config;
    }

    public void invalidate(String viewKey) {
        cache.remove(viewKey);
    }

    public void clear() {
        cache.clear();
    }

    private static final class CacheEntry {
        private final ViewConfig config;
        private final long expiresAt;

        private CacheEntry(ViewConfig config, long expiresAt) {
            this.config = config;
            this.expiresAt = expiresAt;
        }
    }
}
