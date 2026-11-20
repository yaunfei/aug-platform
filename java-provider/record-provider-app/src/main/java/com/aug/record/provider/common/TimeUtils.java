package com.aug.record.provider.common;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

/**
 * ISO-8601 时间工具：与 Python 侧 datetime.isoformat() 的输出形状对齐（UTC + 'Z'）。
 */
public final class TimeUtils {

    private static final DateTimeFormatter PY_DEFAULT =
            DateTimeFormatter.ofPattern("uuuu-MM-dd'T'HH:mm:ss");

    private TimeUtils() {
    }

    /**
     * 解析 ISO-8601：支持带偏移/Z、纯 Instant、无时区 LocalDateTime、纯日期。
     * 无时区一律视为 UTC（与 Python 参考实现一致）。
     *
     * @throws java.time.format.DateTimeParseException 无法解析时
     */
    public static OffsetDateTime parseIso(String text) {
        String value = text == null ? "" : text.trim();
        try {
            return OffsetDateTime.parse(value);
        } catch (RuntimeException ignored) {
            // fallthrough
        }
        try {
            return Instant.parse(value).atOffset(ZoneOffset.UTC);
        } catch (RuntimeException ignored) {
            // fallthrough
        }
        try {
            return LocalDateTime.parse(value).atOffset(ZoneOffset.UTC);
        } catch (RuntimeException ignored) {
            // fallthrough
        }
        return LocalDate.parse(value).atStartOfDay().atOffset(ZoneOffset.UTC);
    }

    /**
     * 输出 Python isoformat 风格 UTC 字符串：2026-07-01T12:00:00Z（有微秒时保留 6 位）。
     */
    public static String toIso(OffsetDateTime value) {
        if (value == null) {
            return null;
        }
        OffsetDateTime utc = value.withOffsetSameInstant(ZoneOffset.UTC);
        String base = PY_DEFAULT.format(utc);
        int micros = utc.getNano() / 1000;
        if (micros > 0) {
            base = base + "." + String.format(java.util.Locale.ROOT, "%06d", micros);
        }
        return base + "Z";
    }
}
