"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.build = build;
const pack_shared_1 = require("@utoo/pack-shared");
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const nanoid_1 = require("nanoid");
const path_1 = __importDefault(require("path"));
const webpackCompat_1 = require("../config/webpackCompat");
const project_1 = require("../core/project");
const cacheDirectory_1 = require("../utils/cacheDirectory");
const cleanOutput_1 = require("../utils/cleanOutput");
const common_1 = require("../utils/common");
const env_1 = require("../utils/env");
const findRoot_1 = require("../utils/findRoot");
const HtmlGenerationManager_1 = require("../utils/HtmlGenerationManager");
const htmlEntry_1 = require("../utils/htmlEntry");
const lockfile_1 = require("../utils/lockfile");
const normalizePath_1 = require("../utils/normalizePath");
const runtimePluginStratety_1 = require("../utils/runtimePluginStratety");
const taskProgress_1 = require("../utils/taskProgress");
const validateEntry_1 = require("../utils/validateEntry");
const xcodeProfile_1 = require("../utils/xcodeProfile");
function build(options, projectPath, rootPath) {
    const bundleOptions = (0, webpackCompat_1.resolveBundleOptions)(options, projectPath, rootPath);
    rootPath = (0, findRoot_1.resolveRootPath)(projectPath, rootPath);
    return buildInternal(bundleOptions, projectPath, rootPath);
}
async function buildInternal(bundleOptions, projectPath, rootPath) {
    var _a, _b, _c, _d, _e, _f, _g;
    (0, common_1.blockStdout)();
    if (process.env.XCODE_PROFILE) {
        await (0, xcodeProfile_1.xcodeProfilingReady)();
    }
    const resolvedProjectPath = projectPath || process.cwd();
    const resolvedRootPath = rootPath || projectPath || process.cwd();
    const persistentCaching = (0, env_1.isPersistentCachingEnabled)(bundleOptions.config.persistentCaching);
    const turbopackMemoryEviction = (0, env_1.normalizeTurbopackMemoryEviction)(bundleOptions.config.turbopackMemoryEviction);
    const smallPreallocation = (0, env_1.isTruthyEnv)(process.env.UTOO_TURBOPACK_SMALL_PREALLOCATION);
    const shouldCreateWebpackStats = Boolean(process.env.ANALYZE) || Boolean(bundleOptions.config.stats);
    const showProgress = (_a = bundleOptions.tracing) !== null && _a !== void 0 ? _a : true;
    (0, htmlEntry_1.processHtmlEntry)(bundleOptions.config, resolvedProjectPath);
    (0, validateEntry_1.validateEntryPaths)(bundleOptions.config, resolvedProjectPath);
    await (0, cleanOutput_1.cleanOutput)(bundleOptions.config, resolvedProjectPath);
    const createProject = (0, project_1.projectFactory)();
    const cacheDirectory = (0, cacheDirectory_1.resolveCacheDirectory)(resolvedProjectPath, bundleOptions.config.cacheDirectory);
    const persistentCacheLock = await (0, lockfile_1.acquirePersistentCacheLock)(cacheDirectory, "utoo pack build", persistentCaching);
    let project;
    try {
        project = await createProject({
            processEnv: (_b = bundleOptions.processEnv) !== null && _b !== void 0 ? _b : {},
            watch: {
                enable: false,
            },
            dev: (_c = bundleOptions.dev) !== null && _c !== void 0 ? _c : false,
            buildId: bundleOptions.buildId || (0, nanoid_1.nanoid)(),
            tracing: showProgress,
            config: {
                ...bundleOptions.config,
                stats: shouldCreateWebpackStats,
                pluginRuntimeStrategy: (_e = (_d = bundleOptions === null || bundleOptions === void 0 ? void 0 : bundleOptions.config) === null || _d === void 0 ? void 0 : _d.pluginRuntimeStrategy) !== null && _e !== void 0 ? _e : ((0, runtimePluginStratety_1.useWorkerThreads)() ? "workerThreads" : "childProcesses"),
            },
            projectPath: (0, normalizePath_1.normalizePath)(resolvedProjectPath),
            rootPath: resolvedRootPath,
            packPath: (0, common_1.getPackPath)(),
        }, {
            persistentCaching,
            isShortSession: true,
            turbopackMemoryEviction,
            smallPreallocation,
            turbopackGc: bundleOptions.config.turbopackGc,
            // Build mode is a short-lived, one-shot compilation, so avoid paying
            // dependency graph bookkeeping cost unless the persistent cache needs it.
            dependencyTracking: persistentCaching,
            cacheDirectory,
        });
        const progress = showProgress ? new taskProgress_1.TaskProgress(project) : undefined;
        const compileStart = Date.now();
        progress === null || progress === void 0 ? void 0 : progress.start("Compiling");
        let completedTasks = 0;
        const entrypoints = await project
            .writeAllEntrypointsToDisk()
            .finally(() => {
            var _a;
            completedTasks = (_a = progress === null || progress === void 0 ? void 0 : progress.stop()) !== null && _a !== void 0 ? _a : 0;
        });
        if (showProgress) {
            console.log(`Compiled in ${(0, taskProgress_1.formatDuration)(Date.now() - compileStart)} (${(0, taskProgress_1.formatTaskCount)(completedTasks)})`);
        }
        (0, pack_shared_1.handleIssues)(entrypoints.issues);
        const htmlGenerationManager = new HtmlGenerationManager_1.HtmlGenerationManager(bundleOptions.config, (0, cleanOutput_1.getOutputPath)(bundleOptions.config, resolvedProjectPath), (_f = bundleOptions.config.output) === null || _f === void 0 ? void 0 : _f.publicPath);
        htmlGenerationManager.setEntrypoints(entrypoints);
        await htmlGenerationManager.generateAll();
        if (process.env.ANALYZE) {
            await analyzeBundle(((_g = bundleOptions.config.output) === null || _g === void 0 ? void 0 : _g.path) || "dist");
        }
    }
    finally {
        await (project === null || project === void 0 ? void 0 : project.shutdown());
        persistentCacheLock === null || persistentCacheLock === void 0 ? void 0 : persistentCacheLock.unlockSync();
    }
    // TODO: Maybe run tasks in worker is a better way, see
    // https://github.com/vercel/next.js/blob/512d8283054407ab92b2583ecce3b253c3be7b85/packages/next/src/lib/worker.ts
}
async function analyzeBundle(outputPath) {
    const statsPath = path_1.default.join(outputPath, "stats.json");
    if (!fs_1.default.existsSync(statsPath)) {
        console.warn(`Stats file not found at ${statsPath}. Make sure to enable stats in your configuration.`);
        return;
    }
    return new Promise((resolve, reject) => {
        const analyzer = (0, child_process_1.spawn)("npx", ["webpack-bundle-analyzer", statsPath], {
            stdio: "inherit",
            shell: true,
        });
        analyzer.on("error", (error) => {
            reject(new Error(`Failed to start bundle analyzer: ${error.message}`));
        });
        analyzer.on("close", () => {
            // The analyzer process has finished, so we can resolve the promise
            // to allow the build process to exit gracefully.
            resolve();
        });
    });
}
