"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CACHE_DIRECTORY = void 0;
exports.resolveCacheDirectory = resolveCacheDirectory;
const path_1 = __importDefault(require("path"));
exports.DEFAULT_CACHE_DIRECTORY = ".turbopack";
/**
 * Resolves the directory that holds the persistent cache, lock file and
 * traces. Relative values resolve from the project path.
 */
function resolveCacheDirectory(projectPath, cacheDirectory) {
    return path_1.default.resolve(projectPath, cacheDirectory || exports.DEFAULT_CACHE_DIRECTORY);
}
