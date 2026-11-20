import { resolve } from "path";
import { isDeepStrictEqual } from "util";
import * as binding from "../binding.js";
import { getPackPath, rustifyEnv } from "../utils/common.js";
import { resolveRootPath } from "../utils/findRoot.js";
import { normalizePath } from "../utils/normalizePath.js";
import { DiagnosticSources } from "./diagnosticSources.js";
import { runLoaderWorkerPool } from "./loaderWorkerPool.js";
import { moduleReferencesVersion } from "./moduleReferences.js";
/**
 * An error caused by a bug in Turbopack, and not the user's code (e.g. a Rust panic). These should
 * be written to a log file and details should not be shown to the user.
 *
 * These are constructed in Turbopack by calling `throwTurbopackInternalError`.
 */
export class TurbopackInternalError extends Error {
    constructor({ message, anonymizedLocation }) {
        super(message);
        this.name = "TurbopackInternalError";
        this.location = anonymizedLocation;
    }
}
/**
 * A helper used by the napi Rust entrypoints to construct and throw a `TurbopackInternalError`.
 */
function throwTurbopackInternalError(conversionError, opts) {
    if (conversionError != null) {
        throw new Error("NAPI type conversion error in throwTurbopackInternalError", { cause: conversionError });
    }
    throw new TurbopackInternalError(opts);
}
async function withErrorCause(fn) {
    var _a;
    try {
        return await fn();
    }
    catch (nativeError) {
        throw new TurbopackInternalError({
            message: (_a = nativeError === null || nativeError === void 0 ? void 0 : nativeError.message) !== null && _a !== void 0 ? _a : String(nativeError),
        });
    }
}
function normalizeEmotionConfig(emotion, isDev) {
    if (emotion === undefined || emotion === false) {
        return undefined;
    }
    const defaults = {
        sourcemap: isDev,
        autoLabel: isDev ? "always" : "never",
    };
    return emotion === true ? defaults : { ...defaults, ...emotion };
}
function normalizeStyles(styles, isDev) {
    if (!styles) {
        return styles;
    }
    return {
        ...styles,
        emotion: normalizeEmotionConfig(styles.emotion, isDev),
    };
}
// Align with next.js turbopack default optimizePackageImports config:
// https://nextjs.org/docs/app/api-reference/config/next-config-js/optimizePackageImports
const DEFAULT_OPTIMIZE_PACKAGE_IMPORTS = [
    "lucide-react",
    "date-fns",
    "lodash-es",
    "ramda",
    "react-bootstrap",
    "ahooks",
    "@ant-design/icons",
    "@headlessui/react",
    "@headlessui-float/react",
    "@heroicons/react/20/solid",
    "@heroicons/react/24/solid",
    "@heroicons/react/24/outline",
    "@visx/visx",
    "@tremor/react",
    "rxjs",
    "@mui/material",
    "@mui/icons-material",
    "recharts",
    "react-use",
    "effect",
    "@effect/schema",
    "@effect/platform",
    "@effect/platform-node",
    "@effect/platform-browser",
    "@effect/platform-bun",
    "@effect/sql",
    "@effect/sql-mssql",
    "@effect/sql-mysql2",
    "@effect/sql-pg",
    "@effect/sql-sqlite-node",
    "@effect/sql-sqlite-bun",
    "@effect/sql-sqlite-wasm",
    "@effect/sql-sqlite-react-native",
    "@effect/rpc",
    "@effect/rpc-http",
    "@effect/typeclass",
    "@effect/experimental",
    "@effect/opentelemetry",
    "@material-ui/core",
    "@material-ui/icons",
    "@tabler/icons-react",
    "mui-core",
    "react-icons/ai",
    "react-icons/bi",
    "react-icons/bs",
    "react-icons/cg",
    "react-icons/ci",
    "react-icons/di",
    "react-icons/fa",
    "react-icons/fa6",
    "react-icons/fc",
    "react-icons/fi",
    "react-icons/gi",
    "react-icons/go",
    "react-icons/gr",
    "react-icons/hi",
    "react-icons/hi2",
    "react-icons/im",
    "react-icons/io",
    "react-icons/io5",
    "react-icons/lia",
    "react-icons/lib",
    "react-icons/lu",
    "react-icons/md",
    "react-icons/pi",
    "react-icons/ri",
    "react-icons/rx",
    "react-icons/si",
    "react-icons/sl",
    "react-icons/tb",
    "react-icons/tfi",
    "react-icons/ti",
    "react-icons/vsc",
    "react-icons/wi",
];
function mergePackageImports(packageImports) {
    const defaultPackageImports = process.env.UTOO_DISABLE_DEFAULT_PACKAGE_IMPORTS === "1"
        ? []
        : DEFAULT_OPTIMIZE_PACKAGE_IMPORTS;
    return [...new Set([...(packageImports !== null && packageImports !== void 0 ? packageImports : []), ...defaultPackageImports])];
}
function normalizeOptimization(optimization) {
    return {
        ...(optimization !== null && optimization !== void 0 ? optimization : {}),
        packageImports: mergePackageImports(optimization === null || optimization === void 0 ? void 0 : optimization.packageImports),
    };
}
export async function serializeConfig(config, isDev) {
    var _a, _b;
    if (((_b = (_a = config.module) === null || _a === void 0 ? void 0 : _a.references) === null || _b === void 0 ? void 0 : _b.length) && moduleReferencesVersion !== 1) {
        throw new Error("The loaded Utoopack native binary does not support module.references version 1.");
    }
    const configSerializable = {
        ...config,
        styles: normalizeStyles(config.styles, isDev),
        optimization: normalizeOptimization(config.optimization),
    };
    if (configSerializable.entry) {
        configSerializable.entry = configSerializable.entry.map((entry) => {
            const { html, ...rest } = entry;
            return rest;
        });
    }
    {
        const { modularizeImports } = configSerializable.optimization;
        if (modularizeImports) {
            configSerializable.optimization.modularizeImports = Object.fromEntries(Object.entries(modularizeImports).map(([mod, config]) => [
                mod,
                {
                    ...config,
                    transform: typeof config.transform === "string"
                        ? config.transform
                        : Object.entries(config.transform).map(([key, value]) => [
                            key,
                            value,
                        ]),
                },
            ]));
        }
    }
    if (configSerializable.module && configSerializable.module.rules) {
        configSerializable.module.rules = serializeModuleRules(configSerializable.module.rules);
    }
    return JSON.stringify(configSerializable, null, 2);
}
// converts regexes to a `RegexComponents` object so that it can be JSON-serialized when passed to
// Turbopack
function serializeRuleCondition(cond) {
    function regexComponents(regex) {
        return {
            source: regex.source,
            flags: regex.flags,
        };
    }
    if (typeof cond === "string") {
        return cond;
    }
    else if ("all" in cond) {
        return { ...cond, all: cond.all.map(serializeRuleCondition) };
    }
    else if ("any" in cond) {
        return { ...cond, any: cond.any.map(serializeRuleCondition) };
    }
    else if ("not" in cond) {
        return { ...cond, not: serializeRuleCondition(cond.not) };
    }
    else {
        return {
            ...cond,
            path: cond.path == null
                ? undefined
                : cond.path instanceof RegExp
                    ? {
                        type: "regex",
                        value: regexComponents(cond.path),
                    }
                    : { type: "glob", value: cond.path },
            content: cond.content && regexComponents(cond.content),
            query: cond.query == null
                ? undefined
                : cond.query instanceof RegExp
                    ? {
                        type: "regex",
                        value: regexComponents(cond.query),
                    }
                    : { type: "constant", value: cond.query },
            contentType: cond.contentType == null
                ? undefined
                : cond.contentType instanceof RegExp
                    ? {
                        type: "regex",
                        value: regexComponents(cond.contentType),
                    }
                    : { type: "glob", value: cond.contentType },
        };
    }
}
// Note: Returns an updated `turbopackRules` with serialized conditions. Does not mutate in-place.
function serializeModuleRules(turbopackRules) {
    const serializedRules = {};
    for (const [glob, rule] of Object.entries(turbopackRules)) {
        if (Array.isArray(rule)) {
            serializedRules[glob] = rule.map((item) => {
                if (typeof item !== "string" &&
                    ("loaders" in item || "type" in item || "condition" in item)) {
                    return serializeConfigItem(item, glob);
                }
                else {
                    checkLoaderItem(item, glob);
                    return item;
                }
            });
        }
        else {
            serializedRules[glob] = serializeConfigItem(rule, glob);
        }
    }
    return serializedRules;
    function serializeConfigItem(rule, glob) {
        if (!rule)
            return rule;
        if (rule.loaders) {
            for (const item of rule.loaders) {
                checkLoaderItem(item, glob);
            }
        }
        let serializedRule = rule;
        if (rule.condition != null) {
            serializedRule = {
                ...rule,
                condition: serializeRuleCondition(rule.condition),
            };
        }
        return serializedRule;
    }
    function checkLoaderItem(loaderItem, glob) {
        if (typeof loaderItem !== "string" &&
            !isDeepStrictEqual(loaderItem, JSON.parse(JSON.stringify(loaderItem)))) {
            throw new Error(`loader ${loaderItem.loader} for match "${glob}" does not have serializable options. ` +
                "Ensure that options passed are plain JavaScript objects and values.");
        }
    }
}
async function rustifyPartialProjectOptions(options) {
    var _a;
    return {
        ...options,
        rootPath: options.rootPath === undefined
            ? undefined
            : normalizePath(resolveRootPath(options.projectPath, options.rootPath)),
        projectPath: normalizePathOption(options.projectPath),
        packPath: normalizePathOption(options.packPath),
        config: options.config && (await serializeConfig(options.config, !!options.dev)),
        processEnv: options.processEnv && rustifyEnv(options.processEnv),
        watch: options.watch && {
            ...options.watch,
            enable: (_a = options.watch.enable) !== null && _a !== void 0 ? _a : false,
        },
    };
}
function normalizePathOption(pathLike) {
    if (pathLike === undefined)
        return undefined;
    return normalizePath(pathLike);
}
async function rustifyProjectOptions(options) {
    var _a, _b;
    return {
        ...options,
        rootPath: normalizePath(resolveRootPath(options.projectPath, options.rootPath)),
        projectPath: normalizePath(options.projectPath),
        packPath: normalizePath(options.packPath),
        config: await serializeConfig(options.config, options.dev),
        processEnv: rustifyEnv((_a = options.processEnv) !== null && _a !== void 0 ? _a : {}),
        watch: {
            ...options.watch,
            enable: (_b = options.watch.enable) !== null && _b !== void 0 ? _b : false,
        },
    };
}
export function projectFactory(endpointWatchOptions) {
    const cancel = new (class Cancel extends Error {
    })();
    const diagnosticSources = new WeakMap();
    function subscribe(useBuffer, nativeFunction, diagnosticSources) {
        // A buffer of produced items. This will only contain values if the
        // consumer is slower than the producer.
        let buffer = [];
        // A deferred value waiting for the next produced item. This will only
        // exist if the consumer is faster than the producer.
        let waiting;
        let canceled = false;
        // The native function will call this every time it emits a new result. We
        // either need to notify a waiting consumer, or buffer the new result until
        // the consumer catches up.
        function emitResult(err, value) {
            if (canceled)
                return;
            if (!err)
                diagnosticSources.intern(value);
            if (waiting) {
                let { resolve, reject } = waiting;
                waiting = undefined;
                if (err)
                    reject(err);
                else
                    resolve(value);
            }
            else {
                const item = { err, value };
                if (useBuffer)
                    buffer.push(item);
                else
                    buffer[0] = item;
            }
        }
        async function* createIterator() {
            const task = await withErrorCause(() => nativeFunction(emitResult));
            try {
                while (!canceled) {
                    if (buffer.length > 0) {
                        const item = buffer.shift();
                        if (item.err)
                            throw item.err;
                        yield item.value;
                    }
                    else {
                        // eslint-disable-next-line no-loop-func
                        yield new Promise((resolve, reject) => {
                            waiting = { resolve, reject };
                        });
                    }
                }
            }
            catch (e) {
                if (e === cancel)
                    return;
                if (e instanceof Error) {
                    throw new TurbopackInternalError({ message: e.message });
                }
                throw e;
            }
            finally {
                if (task) {
                    binding.rootTaskDispose(task);
                }
            }
        }
        const iterator = createIterator();
        const closeIterator = iterator.return.bind(iterator);
        iterator.return = () => {
            canceled = true;
            buffer = [];
            if (waiting) {
                const { reject } = waiting;
                waiting = undefined;
                reject(cancel);
            }
            // Wake a pending next(), then let the generator run its finally block.
            // This also closes a generator suspended immediately after a yield.
            return closeIterator();
        };
        return iterator;
    }
    class ProjectImpl {
        constructor(nativeProject) {
            this._nativeProject = nativeProject;
            diagnosticSources.set(this, new DiagnosticSources());
            if (typeof binding.registerWorkerScheduler === "function") {
                runLoaderWorkerPool(binding, resolve(getPackPath(), "./binding.js"));
            }
        }
        async update(options) {
            await withErrorCause(async () => binding.projectUpdate(this._nativeProject, await rustifyPartialProjectOptions(options)));
        }
        async writeAllEntrypointsToDisk() {
            return await withErrorCause(async () => {
                const napiEndpoints = (await binding.projectWriteAllEntrypointsToDisk(this._nativeProject));
                diagnosticSources.get(this).intern(napiEndpoints);
                return napiEntrypointsToRawEntrypoints(napiEndpoints, diagnosticSources.get(this));
            });
        }
        async activateLazyChunk(chunkPath) {
            return await withErrorCause(() => binding.projectActivateLazyChunk(this._nativeProject, chunkPath));
        }
        async writeAnalyzeData(outputPath) {
            return await withErrorCause(async () => {
                const result = await binding.projectWriteAnalyzeData(this._nativeProject, normalizePath(resolve(outputPath)));
                diagnosticSources.get(this).intern(result);
                return result;
            });
        }
        entrypointsSubscribe() {
            const subscription = subscribe(false, async (callback) => binding.projectEntrypointsSubscribe(this._nativeProject, callback), diagnosticSources.get(this));
            const sources = diagnosticSources.get(this);
            const iterator = (async function* () {
                for await (const entrypoints of subscription) {
                    yield napiEntrypointsToRawEntrypoints(entrypoints, sources);
                }
            })();
            const closeIterator = iterator.return.bind(iterator);
            iterator.return = async (value) => {
                // A generator queues return() behind next(), so cancel the native
                // subscription first to unblock the next entrypoints result.
                const closing = subscription.return();
                try {
                    return await closeIterator(value);
                }
                finally {
                    await closing;
                }
            };
            return iterator;
        }
        hmrEvents(identifier, expectedVersion) {
            return subscribe(true, async (callback) => binding.projectHmrEvents(this._nativeProject, identifier, callback, expectedVersion), diagnosticSources.get(this));
        }
        hmrIdentifiersSubscribe() {
            return subscribe(false, async (callback) => binding.projectHmrIdentifiersSubscribe(this._nativeProject, callback), diagnosticSources.get(this));
        }
        traceSource(stackFrame, currentDirectoryFileUrl) {
            return binding.projectTraceSource(this._nativeProject, stackFrame, currentDirectoryFileUrl);
        }
        getSourceForAsset(filePath) {
            return binding.projectGetSourceForAsset(this._nativeProject, filePath);
        }
        getSourceMap(filePath) {
            return binding.projectGetSourceMap(this._nativeProject, filePath);
        }
        getSourceMapSync(filePath) {
            return binding.projectGetSourceMapSync(this._nativeProject, filePath);
        }
        getCompletedTaskCount() {
            return binding.projectGetCompletedTaskCount(this._nativeProject);
        }
        updateInfoSubscribe(aggregationMs) {
            return subscribe(true, async (callback) => binding.projectUpdateInfoSubscribe(this._nativeProject, aggregationMs, callback), diagnosticSources.get(this));
        }
        shutdown() {
            diagnosticSources.get(this).dispose();
            return binding.projectShutdown(this._nativeProject);
        }
        onExit() {
            diagnosticSources.get(this).dispose();
            return binding.projectOnExit(this._nativeProject);
        }
    }
    class EndpointImpl {
        constructor(nativeEndpoint, sources, appIndex) {
            this._nativeEndpoint = nativeEndpoint;
            diagnosticSources.set(this, sources);
            this._appIndex = appIndex;
        }
        async writeToDisk() {
            return await withErrorCause(async () => diagnosticSources
                .get(this)
                .intern((await binding.endpointWriteToDisk(this._nativeEndpoint))));
        }
        async clientChanged() {
            // Preserve projectFactory()'s public behavior for callers outside dev HMR.
            // The dev server supplies endpointWatchOptions so it can avoid creating
            // NAPI root tasks for output directions that cannot change.
            if (endpointWatchOptions === null || endpointWatchOptions === void 0 ? void 0 : endpointWatchOptions.nodeTarget) {
                return emptySubscription();
            }
            const clientSubscription = subscribe(false, async (callback) => binding.endpointClientChangedSubscribe(await this._nativeEndpoint, callback), diagnosticSources.get(this));
            await clientSubscription.next();
            return clientSubscription;
        }
        async serverChanged(includeIssues) {
            if (endpointWatchOptions &&
                !endpointWatchOptions.nodeTarget &&
                (!endpointWatchOptions.hasServerOutput || this._appIndex !== 0)) {
                return emptySubscription();
            }
            const serverSubscription = subscribe(false, async (callback) => binding.endpointServerChangedSubscribe(await this._nativeEndpoint, includeIssues, callback), diagnosticSources.get(this));
            await serverSubscription.next();
            return serverSubscription;
        }
    }
    async function* emptySubscription() { }
    function napiEntrypointsToRawEntrypoints(entrypoints, diagnosticSources) {
        return {
            apps: (entrypoints.apps || []).map((e, index) => new EndpointImpl(e, diagnosticSources, index)),
            libraries: (entrypoints.libraries || []).map((e) => new EndpointImpl(e, diagnosticSources)),
            appPaths: entrypoints.appPaths,
            libraryPaths: entrypoints.libraryPaths,
            issues: entrypoints.issues,
        };
    }
    return async function createProject(options, turboEngineOptions) {
        return new ProjectImpl(await binding.projectNew(await rustifyProjectOptions(options), turboEngineOptions || {}, {
            throwTurbopackInternalError,
        }));
    };
}
