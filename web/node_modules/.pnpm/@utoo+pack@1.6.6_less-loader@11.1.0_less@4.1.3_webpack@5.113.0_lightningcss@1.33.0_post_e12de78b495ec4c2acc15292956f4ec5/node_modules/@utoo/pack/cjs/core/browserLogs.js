"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isBrowserLogsMessage = isBrowserLogsMessage;
exports.shouldForwardBrowserLog = shouldForwardBrowserLog;
exports.forwardBrowserLogs = forwardBrowserLogs;
const trace_mapping_1 = require("@jridgewell/trace-mapping");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const url_1 = require("url");
const BROWSER_LOG_METHODS = new Set([
    "assert",
    "debug",
    "dir",
    "dirxml",
    "error",
    "group",
    "groupCollapsed",
    "groupEnd",
    "info",
    "log",
    "table",
    "trace",
    "warn",
]);
const SOURCE_MAP_CACHE_LIMIT = 25;
const SOURCE_MAP_CACHE_TTL_MS = 100;
const sourceMapCache = new Map();
function isBrowserLogsMessage(value) {
    if (!value || typeof value !== "object")
        return false;
    const message = value;
    if (message.event !== "browser-logs" || !Array.isArray(message.entries)) {
        return false;
    }
    if (message.entries.length > 1000)
        return false;
    return message.entries.every((entry) => Boolean(entry) &&
        typeof entry === "object" &&
        BROWSER_LOG_METHODS.has(entry.method) &&
        (entry.kind === "console" ||
            entry.kind === "uncaught-error" ||
            entry.kind === "unhandled-rejection") &&
        Array.isArray(entry.args) &&
        entry.args.length <= 100 &&
        entry.args.every((arg) => typeof arg === "string") &&
        (entry.stack === undefined || typeof entry.stack === "string"));
}
function shouldForwardBrowserLog(level, method) {
    if (level === false)
        return false;
    if (level === true)
        return true;
    if (level === "warn")
        return method === "warn" || method === "error" || method === "assert";
    return method === "error" || method === "assert";
}
async function forwardBrowserLogs(message, level, project, projectPath, outputPath) {
    for (const entry of message.entries) {
        if (!shouldForwardBrowserLog(level, entry.method))
            continue;
        const location = entry.stack
            ? await getBrowserLogLocation(entry.stack, project, projectPath, outputPath)
            : undefined;
        const suffix = location ? ` (${location})` : "";
        const formatted = `[browser] ${entry.args.join(" ")}${suffix}`;
        if (entry.method === "assert")
            console.assert(false, formatted);
        else if (entry.method === "trace")
            console.log(formatted);
        else
            console[entry.method](formatted);
    }
}
async function getBrowserLogLocation(stack, project, projectPath, outputPath) {
    var _a, _b;
    const currentDirectoryFileUrl = (0, url_1.pathToFileURL)(`${projectPath}${path_1.default.sep}`).href;
    for (const line of stack.split("\n")) {
        const match = (_a = line.match(/^\s*at (?:(.*?) \()?(.+):(\d+):(\d+)\)?$/)) !== null && _a !== void 0 ? _a : line.match(/^\s*(.*?)@(.+):(\d+):(\d+)$/);
        if (!match)
            continue;
        const [, methodName, file, lineNumber, columnNumber] = match;
        if (file.startsWith("node:") || file.includes("/hmr/browser-logs")) {
            continue;
        }
        const frame = {
            isServer: false,
            file,
            line: Number(lineNumber),
            column: Number(columnNumber),
            ...(methodName ? { methodName } : {}),
        };
        let mapped = null;
        for (const candidate of browserFrameCandidates(frame, outputPath)) {
            try {
                mapped = await project.traceSource(candidate, currentDirectoryFileUrl);
            }
            catch (_c) {
                mapped = null;
            }
            mapped !== null && mapped !== void 0 ? mapped : (mapped = await traceWrittenSourceMap(candidate, outputPath));
            if (mapped)
                break;
        }
        const result = mapped !== null && mapped !== void 0 ? mapped : frame;
        return formatBrowserLogLocation((_b = result.originalFile) !== null && _b !== void 0 ? _b : result.file, result.line, result.column, projectPath);
    }
    return undefined;
}
async function traceWrittenSourceMap(frame, outputPath) {
    var _a;
    if (!frame.file.startsWith("file://") || frame.line === undefined)
        return null;
    let assetFile;
    try {
        assetFile = (0, url_1.fileURLToPath)(frame.file);
    }
    catch (_b) {
        return null;
    }
    const relative = path_1.default.relative(outputPath, assetFile);
    if (!relative || relative.startsWith("..") || path_1.default.isAbsolute(relative)) {
        return null;
    }
    const sourceMapPath = `${assetFile}.map`;
    try {
        const sourceMap = await loadWrittenSourceMap(sourceMapPath);
        if (!sourceMap)
            return null;
        const traced = (0, trace_mapping_1.originalPositionFor)(sourceMap, {
            line: frame.line,
            column: Math.max(0, ((_a = frame.column) !== null && _a !== void 0 ? _a : 1) - 1),
        });
        if (!traced.source || traced.line === null || traced.column === null) {
            return null;
        }
        return {
            ...frame,
            file: traced.source,
            originalFile: traced.source,
            line: traced.line,
            column: traced.column + 1,
        };
    }
    catch (_c) {
        return null;
    }
}
async function loadWrittenSourceMap(sourceMapPath) {
    const now = Date.now();
    const cached = sourceMapCache.get(sourceMapPath);
    if (cached && cached.expiresAt > now)
        return cached.map;
    const map = promises_1.default
        .readFile(sourceMapPath, "utf8")
        .then((contents) => new trace_mapping_1.AnyMap(JSON.parse(contents), (0, url_1.pathToFileURL)(sourceMapPath).href))
        .catch(() => null);
    sourceMapCache.delete(sourceMapPath);
    sourceMapCache.set(sourceMapPath, {
        expiresAt: now + SOURCE_MAP_CACHE_TTL_MS,
        map,
    });
    if (sourceMapCache.size > SOURCE_MAP_CACHE_LIMIT) {
        const oldest = sourceMapCache.keys().next().value;
        if (oldest)
            sourceMapCache.delete(oldest);
    }
    return map;
}
function browserFrameCandidates(frame, outputPath) {
    if (!frame.file.startsWith("http://") && !frame.file.startsWith("https://")) {
        return [frame];
    }
    try {
        const url = new URL(frame.file);
        const segments = decodeURIComponent(url.pathname)
            .split("/")
            .filter((segment) => segment && segment !== "." && segment !== "..");
        const candidates = segments.map((_, index) => ({
            ...frame,
            file: (0, url_1.pathToFileURL)(path_1.default.join(outputPath, ...segments.slice(index))).href,
        }));
        return [...candidates, frame];
    }
    catch (_a) {
        return [frame];
    }
}
function formatBrowserLogLocation(file, line, column, projectPath) {
    let displayFile = file;
    if (file.startsWith("file://")) {
        try {
            displayFile = (0, url_1.fileURLToPath)(file);
        }
        catch (_a) { }
    }
    if (path_1.default.isAbsolute(displayFile)) {
        const relative = path_1.default.relative(projectPath, displayFile);
        if (relative && !relative.startsWith(".."))
            displayFile = relative;
    }
    displayFile = displayFile.replaceAll(path_1.default.sep, "/");
    return `${displayFile}${line === undefined ? "" : `:${line}`}${column === undefined ? "" : `:${column}`}`;
}
