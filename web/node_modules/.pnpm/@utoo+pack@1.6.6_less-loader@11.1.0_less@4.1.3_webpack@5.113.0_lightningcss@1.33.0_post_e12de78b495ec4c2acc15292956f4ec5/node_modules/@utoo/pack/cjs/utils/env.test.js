"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const env_1 = require("./env");
const previousDisablePersistentCache = process.env.DISABLE_PERSISTENT_CACHE;
const previousEvictAfterSnapshot = process.env.TURBO_ENGINE_EVICT_AFTER_SNAPSHOT;
(0, vitest_1.afterEach)(() => {
    if (previousDisablePersistentCache === undefined) {
        delete process.env.DISABLE_PERSISTENT_CACHE;
    }
    else {
        process.env.DISABLE_PERSISTENT_CACHE = previousDisablePersistentCache;
    }
    if (previousEvictAfterSnapshot === undefined) {
        delete process.env.TURBO_ENGINE_EVICT_AFTER_SNAPSHOT;
    }
    else {
        process.env.TURBO_ENGINE_EVICT_AFTER_SNAPSHOT = previousEvictAfterSnapshot;
    }
});
(0, vitest_1.describe)("isPersistentCachingEnabled", () => {
    (0, vitest_1.it)("enables persistent caching by default", () => {
        delete process.env.DISABLE_PERSISTENT_CACHE;
        (0, vitest_1.expect)((0, env_1.isPersistentCachingEnabled)(undefined)).toBe(true);
    });
    (0, vitest_1.it)("preserves an explicitly disabled configuration", () => {
        delete process.env.DISABLE_PERSISTENT_CACHE;
        (0, vitest_1.expect)((0, env_1.isPersistentCachingEnabled)(false)).toBe(false);
    });
    vitest_1.it.each(["1", "true", "TRUE", "True"])("disables persistent caching when the environment variable is %s", (value) => {
        process.env.DISABLE_PERSISTENT_CACHE = value;
        (0, vitest_1.expect)((0, env_1.isPersistentCachingEnabled)(true)).toBe(false);
        (0, vitest_1.expect)((0, env_1.isPersistentCachingEnabled)(undefined)).toBe(false);
    });
    (0, vitest_1.it)("ignores other environment variable values", () => {
        process.env.DISABLE_PERSISTENT_CACHE = "0";
        (0, vitest_1.expect)((0, env_1.isPersistentCachingEnabled)(undefined)).toBe(true);
    });
});
(0, vitest_1.describe)("normalizeTurbopackMemoryEviction", () => {
    (0, vitest_1.it)("uses auto by default", () => {
        delete process.env.TURBO_ENGINE_EVICT_AFTER_SNAPSHOT;
        (0, vitest_1.expect)((0, env_1.normalizeTurbopackMemoryEviction)(undefined)).toBe("auto");
    });
    vitest_1.it.each([
        [false, "off"],
        [true, "full"],
        ["full", "full"],
        ["auto", "auto"],
    ])("maps an explicit %s value to %s", (value, expected) => {
        process.env.TURBO_ENGINE_EVICT_AFTER_SNAPSHOT = "0";
        (0, vitest_1.expect)((0, env_1.normalizeTurbopackMemoryEviction)(value)).toBe(expected);
    });
    vitest_1.it.each([
        ["1", "full"],
        ["true", "full"],
        ["0", "off"],
        ["false", "off"],
        ["", "off"],
        ["TRUE", "off"],
    ])("preserves the legacy environment value %s as %s", (value, expected) => {
        process.env.TURBO_ENGINE_EVICT_AFTER_SNAPSHOT = value;
        (0, vitest_1.expect)((0, env_1.normalizeTurbopackMemoryEviction)(undefined)).toBe(expected);
    });
});
