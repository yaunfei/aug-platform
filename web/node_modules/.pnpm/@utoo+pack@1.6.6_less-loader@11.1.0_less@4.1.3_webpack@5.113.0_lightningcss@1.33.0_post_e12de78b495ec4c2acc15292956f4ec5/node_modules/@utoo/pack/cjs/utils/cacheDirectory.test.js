"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const vitest_1 = require("vitest");
const cacheDirectory_1 = require("./cacheDirectory");
const projectPath = path_1.default.resolve("/workspace/app");
(0, vitest_1.describe)("resolveCacheDirectory", () => {
    (0, vitest_1.it)("defaults to .turbopack inside the project path", () => {
        (0, vitest_1.expect)((0, cacheDirectory_1.resolveCacheDirectory)(projectPath, undefined)).toBe(path_1.default.join(projectPath, ".turbopack"));
        (0, vitest_1.expect)((0, cacheDirectory_1.resolveCacheDirectory)(projectPath, "")).toBe(path_1.default.join(projectPath, ".turbopack"));
    });
    (0, vitest_1.it)("resolves relative directories from the project path", () => {
        (0, vitest_1.expect)((0, cacheDirectory_1.resolveCacheDirectory)(projectPath, "node_modules/.cache/utoopack")).toBe(path_1.default.join(projectPath, "node_modules", ".cache", "utoopack"));
        (0, vitest_1.expect)((0, cacheDirectory_1.resolveCacheDirectory)(projectPath, "../shared-cache")).toBe(path_1.default.resolve(projectPath, "..", "shared-cache"));
    });
    (0, vitest_1.it)("keeps absolute directories as-is", () => {
        const absolute = path_1.default.resolve("/tmp/utoopack-cache");
        (0, vitest_1.expect)((0, cacheDirectory_1.resolveCacheDirectory)(projectPath, absolute)).toBe(absolute);
    });
});
