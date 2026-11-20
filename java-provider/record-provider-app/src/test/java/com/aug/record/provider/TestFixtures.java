package com.aug.record.provider;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

/**
 * 共享 fixture 定位与 JSON 语义比较（数字按数值比较，避免 IntNode/LongNode 差异）。
 */
public final class TestFixtures {

    private TestFixtures() {
    }

    public static Path repoRoot() {
        Path current = Paths.get(System.getProperty("user.dir")).toAbsolutePath();
        while (current != null) {
            if (Files.isDirectory(current.resolve("docs/contracts/view_cases"))) {
                return current;
            }
            current = current.getParent();
        }
        throw new IllegalStateException("无法定位 docs/contracts/view_cases，user.dir="
                + System.getProperty("user.dir"));
    }

    public static Path viewCasesDir() {
        return repoRoot().resolve("docs/contracts/view_cases");
    }

    public static List<Path> viewCases() {
        try (Stream<Path> stream = Files.list(viewCasesDir())) {
            List<Path> cases = new ArrayList<Path>();
            stream.filter(path -> path.getFileName().toString().endsWith(".json"))
                    .sorted()
                    .forEach(cases::add);
            return cases;
        } catch (IOException e) {
            throw new IllegalStateException("读取 view_cases 失败", e);
        }
    }

    public static void assertJsonEquals(JsonNode expected, JsonNode actual) {
        assertJsonEquals("$", expected, actual);
    }

    private static void assertJsonEquals(String path, JsonNode expected, JsonNode actual) {
        if (expected == null || actual == null) {
            if (expected != actual) {
                throw new AssertionError(path + " 期望 " + expected + " 实际 " + actual);
            }
            return;
        }
        if (expected.isNumber() && actual.isNumber()) {
            if (expected.decimalValue().compareTo(actual.decimalValue()) != 0) {
                throw new AssertionError(path + " 数值不等：期望 " + expected + " 实际 " + actual);
            }
            return;
        }
        if (expected.isObject() && actual.isObject()) {
            if (expected.size() != actual.size()) {
                throw new AssertionError(path + " 字段数不等：期望 " + expected + " 实际 " + actual);
            }
            expected.fieldNames().forEachRemaining(field -> {
                if (!actual.has(field)) {
                    throw new AssertionError(path + " 缺少字段 " + field + "，实际 " + actual);
                }
                assertJsonEquals(path + "." + field, expected.get(field), actual.get(field));
            });
            return;
        }
        if (expected.isArray() && actual.isArray()) {
            if (expected.size() != actual.size()) {
                throw new AssertionError(path + " 数组长度不等：期望 " + expected + " 实际 " + actual);
            }
            for (int i = 0; i < expected.size(); i++) {
                assertJsonEquals(path + "[" + i + "]", expected.get(i), actual.get(i));
            }
            return;
        }
        if (!expected.equals(actual)) {
            throw new AssertionError(path + " 不等：期望 " + expected + " 实际 " + actual);
        }
    }

    public static JsonNode read(Path path, ObjectMapper mapper) {
        try {
            return mapper.readTree(path.toFile());
        } catch (IOException e) {
            throw new IllegalStateException("读取 fixture 失败：" + path, e);
        }
    }
}
