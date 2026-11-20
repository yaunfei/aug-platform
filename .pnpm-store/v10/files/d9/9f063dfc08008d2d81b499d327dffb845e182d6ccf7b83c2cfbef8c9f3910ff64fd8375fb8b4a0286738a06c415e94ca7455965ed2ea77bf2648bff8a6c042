import { handleIssues } from "@utoo/pack-shared";
import { spawn } from "child_process";
import fs from "fs";
import { nanoid } from "nanoid";
import path from "path";
import { resolveBundleOptions } from "../config/webpackCompat.js";
import { projectFactory } from "../core/project.js";
import { resolveCacheDirectory } from "../utils/cacheDirectory.js";
import { cleanOutput, getOutputPath } from "../utils/cleanOutput.js";
import { blockStdout, getPackPath } from "../utils/common.js";
import { isPersistentCachingEnabled, isTruthyEnv, normalizeTurbopackMemoryEviction, } from "../utils/env.js";
import { resolveRootPath } from "../utils/findRoot.js";
import { HtmlGenerationManager } from "../utils/HtmlGenerationManager.js";
import { processHtmlEntry } from "../utils/htmlEntry.js";
import { acquirePersistentCacheLock } from "../utils/lockfile.js";
import { normalizePath } from "../utils/normalizePath.js";
import { useWorkerThreads } from "../utils/runtimePluginStratety.js";
import { formatDuration, formatTaskCount, TaskProgress, } from "../utils/taskProgress.js";
import { validateEntryPaths } from "../utils/validateEntry.js";
import { xcodeProfilingReady } from "../utils/xcodeProfile.js";
export function build(options, projectPath, rootPath) {
    const bundleOptions = resolveBundleOptions(options, projectPath, rootPath);
    rootPath = resolveRootPath(projectPath, rootPath);
    return buildInternal(bundleOptions, projectPath, rootPath);
}
async function buildInternal(bundleOptions, projectPath, rootPath) {
    var _a, _b, _c, _d, _e, _f, _g;
    blockStdout();
    if (process.env.XCODE_PROFILE) {
        await xcodeProfilingReady();
    }
    const resolvedProjectPath = projectPath || process.cwd();
    const resolvedRootPath = rootPath || projectPath || process.cwd();
    const persistentCaching = isPersistentCachingEnabled(bundleOptions.config.persistentCaching);
    const turbopackMemoryEviction = normalizeTurbopackMemoryEviction(bundleOptions.config.turbopackMemoryEviction);
    const smallPreallocation = isTruthyEnv(process.env.UTOO_TURBOPACK_SMALL_PREALLOCATION);
    const shouldCreateWebpackStats = Boolean(process.env.ANALYZE) || Boolean(bundleOptions.config.stats);
    const showProgress = (_a = bundleOptions.tracing) !== null && _a !== void 0 ? _a : true;
    processHtmlEntry(bundleOptions.config, resolvedProjectPath);
    validateEntryPaths(bundleOptions.config, resolvedProjectPath);
    await cleanOutput(bundleOptions.config, resolvedProjectPath);
    const createProject = projectFactory();
    const cacheDirectory = resolveCacheDirectory(resolvedProjectPath, bundleOptions.config.cacheDirectory);
    const persistentCacheLock = await acquirePersistentCacheLock(cacheDirectory, "utoo pack build", persistentCaching);
    let project;
    try {
        project = await createProject({
            processEnv: (_b = bundleOptions.processEnv) !== null && _b !== void 0 ? _b : {},
            watch: {
                enable: false,
            },
            dev: (_c = bundleOptions.dev) !== null && _c !== void 0 ? _c : false,
            buildId: bundleOptions.buildId || nanoid(),
            tracing: showProgress,
            config: {
                ...bundleOptions.config,
                stats: shouldCreateWebpackStats,
                pluginRuntimeStrategy: (_e = (_d = bundleOptions === null || bundleOptions === void 0 ? void 0 : bundleOptions.config) === null || _d === void 0 ? void 0 : _d.pluginRuntimeStrategy) !== null && _e !== void 0 ? _e : (useWorkerThreads() ? "workerThreads" : "childProcesses"),
            },
            projectPath: normalizePath(resolvedProjectPath),
            rootPath: resolvedRootPath,
            packPath: getPackPath(),
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
        const progress = showProgress ? new TaskProgress(project) : undefined;
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
            console.log(`Compiled in ${formatDuration(Date.now() - compileStart)} (${formatTaskCount(completedTasks)})`);
        }
        handleIssues(entrypoints.issues);
        const htmlGenerationManager = new HtmlGenerationManager(bundleOptions.config, getOutputPath(bundleOptions.config, resolvedProjectPath), (_f = bundleOptions.config.output) === null || _f === void 0 ? void 0 : _f.publicPath);
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
    const statsPath = path.join(outputPath, "stats.json");
    if (!fs.existsSync(statsPath)) {
        console.warn(`Stats file not found at ${statsPath}. Make sure to enable stats in your configuration.`);
        return;
    }
    return new Promise((resolve, reject) => {
        const analyzer = spawn("npx", ["webpack-bundle-analyzer", statsPath], {
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
