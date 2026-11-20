"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiagnosticSources = void 0;
const MAX_SOURCE_ENTRIES = 256;
const MAX_SOURCE_BYTES = 128 * 1024 * 1024;
/** Shares immutable source text across the native diagnostic results of one project. */
class DiagnosticSources {
    constructor(maxEntries = MAX_SOURCE_ENTRIES, maxBytes = MAX_SOURCE_BYTES) {
        this.maxEntries = maxEntries;
        this.maxBytes = maxBytes;
        this.sources = new Map();
        this.bytes = 0;
        this.disposed = false;
    }
    intern(value) {
        var _a;
        if (this.disposed)
            return value;
        if (value == null || typeof value !== "object")
            return value;
        const result = value;
        for (const issue of result.issues || []) {
            const source = (_a = issue.source) === null || _a === void 0 ? void 0 : _a.source;
            if ((source === null || source === void 0 ? void 0 : source.content) == null)
                continue;
            const cached = this.sources.get(source.ident);
            if (cached) {
                this.sources.delete(source.ident);
                this.bytes -= cached.bytes;
                if (cached.content === source.content) {
                    source.content = cached.content;
                    this.sources.set(source.ident, cached);
                    this.bytes += cached.bytes;
                    continue;
                }
            }
            // Budget for two-byte strings even when V8 stores ASCII text more compactly.
            const bytes = (source.ident.length + source.content.length) * 2;
            if (this.maxEntries <= 0 || bytes > this.maxBytes)
                continue;
            this.sources.set(source.ident, { content: source.content, bytes });
            this.bytes += bytes;
            while (this.sources.size > this.maxEntries ||
                this.bytes > this.maxBytes) {
                const oldest = this.sources.entries().next().value;
                if (!oldest)
                    break;
                this.sources.delete(oldest[0]);
                this.bytes -= oldest[1].bytes;
            }
        }
        for (const paths of [result.appPaths, result.libraryPaths]) {
            for (const path of paths || [])
                this.intern(path);
        }
        return value;
    }
    clear() {
        this.sources.clear();
        this.bytes = 0;
    }
    dispose() {
        this.disposed = true;
        this.clear();
    }
}
exports.DiagnosticSources = DiagnosticSources;
