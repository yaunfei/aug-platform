import { cp, lstat, mkdir, mkdtemp, readFile, rename, rm, writeFile, } from "node:fs/promises";
import path from "node:path";
import { handleIssues } from "@utoo/pack-shared";
import { nanoid } from "nanoid";
import { resolveBundleOptions, } from "../config/webpackCompat.js";
import { projectFactory } from "../core/project.js";
import { resolveCacheDirectory } from "../utils/cacheDirectory.js";
import { getOutputPath } from "../utils/cleanOutput.js";
import { blockStdout, getPackPath } from "../utils/common.js";
import { isPersistentCachingEnabled, isTruthyEnv, normalizeTurbopackMemoryEviction, } from "../utils/env.js";
import { resolveRootPath } from "../utils/findRoot.js";
import { processHtmlEntry } from "../utils/htmlEntry.js";
import { acquirePersistentCacheLock } from "../utils/lockfile.js";
import { normalizePath } from "../utils/normalizePath.js";
import { useWorkerThreads } from "../utils/runtimePluginStratety.js";
import { formatDuration, formatTaskCount, TaskProgress, } from "../utils/taskProgress.js";
import { validateEntryPaths } from "../utils/validateEntry.js";
const REPORT_MARKER = "utoo-analyzer.json";
function overlaps(a, b) {
    const contains = (parent, child) => {
        const relative = path.relative(parent, child);
        return (relative === "" ||
            (!relative.startsWith(`..${path.sep}`) &&
                relative !== ".." &&
                !path.isAbsolute(relative)));
    };
    return contains(a, b) || contains(b, a);
}
async function validateReportDirectory(outputPath) {
    try {
        const info = await lstat(outputPath);
        if (!info.isDirectory() || info.isSymbolicLink()) {
            throw new Error(`Analyzer output must be a report directory: ${outputPath}`);
        }
        const marker = JSON.parse(await readFile(path.join(outputPath, REPORT_MARKER), "utf8"));
        if (marker.tool !== "@utoo/pack-analyzer") {
            throw new Error("Not an Analyzer report");
        }
    }
    catch (error) {
        if (error.code === "ENOENT") {
            // A missing marker in an existing directory is not permission to replace it.
            try {
                await lstat(outputPath);
            }
            catch (statError) {
                if (statError.code === "ENOENT")
                    return;
                throw statError;
            }
        }
        throw new Error(`Analyzer output already exists and is not a Pack Analyzer report: ${outputPath}`, { cause: error });
    }
}
/**
 * Analyze a production application build using the native module graph and output
 * source maps. The caller's configuration, bundles and Webpack stats are left intact.
 */
export async function analyze(options, projectPath, rootPath, analyzeOptions = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    blockStdout();
    const resolvedProjectPath = path.resolve(projectPath || process.cwd());
    const bundleOptions = resolveBundleOptions(options, resolvedProjectPath, rootPath);
    const config = {
        ...bundleOptions.config,
        entry: (_b = (_a = bundleOptions.config.entry) === null || _a === void 0 ? void 0 : _a.map((entry) => ({ ...entry }))) !== null && _b !== void 0 ? _b : [],
        mode: "production",
        sourceMaps: true,
        stats: false,
    };
    processHtmlEntry(config, resolvedProjectPath);
    validateEntryPaths(config, resolvedProjectPath);
    const serverEntries = typeof ((_c = config.server) === null || _c === void 0 ? void 0 : _c.entry) === "string"
        ? [{ import: config.server.entry }]
        : ((_e = (_d = config.server) === null || _d === void 0 ? void 0 : _d.entry) !== null && _e !== void 0 ? _e : []);
    if (!config.entry.length && !serverEntries.length) {
        throw new Error("Native Analyzer requires at least one application entry.");
    }
    if (config.entry.some((entry) => entry.library)) {
        throw new Error("Native Analyzer supports application entries; library builds are not supported.");
    }
    const outputPath = path.resolve(resolvedProjectPath, analyzeOptions.outputPath || ".utoo/analyze");
    const buildOutputPaths = [getOutputPath(config, resolvedProjectPath)];
    if ((_g = (_f = config.server) === null || _f === void 0 ? void 0 : _f.output) === null || _g === void 0 ? void 0 : _g.path) {
        buildOutputPaths.push(path.resolve(resolvedProjectPath, config.server.output.path));
    }
    if (buildOutputPaths.some((buildPath) => overlaps(outputPath, buildPath))) {
        throw new Error("Analyzer output must be outside the application's build output directory.");
    }
    await validateReportDirectory(outputPath);
    const uiPath = path.resolve(getPackPath(), "../analyzer");
    await readFile(path.join(uiPath, "index.html"));
    const cacheDirectory = resolveCacheDirectory(resolvedProjectPath, config.cacheDirectory);
    const persistentCaching = isPersistentCachingEnabled(config.persistentCaching);
    const lock = await acquirePersistentCacheLock(cacheDirectory, "utoo pack analyze", persistentCaching);
    let project;
    let stagingPath;
    try {
        await mkdir(path.dirname(outputPath), { recursive: true });
        stagingPath = await mkdtemp(path.join(path.dirname(outputPath), `.${path.basename(outputPath)}-`));
        project = await projectFactory()({
            config: {
                ...config,
                pluginRuntimeStrategy: (_h = config.pluginRuntimeStrategy) !== null && _h !== void 0 ? _h : (useWorkerThreads() ? "workerThreads" : "childProcesses"),
            },
            projectPath: normalizePath(resolvedProjectPath),
            rootPath: resolveRootPath(resolvedProjectPath, rootPath),
            processEnv: (_j = bundleOptions.processEnv) !== null && _j !== void 0 ? _j : {},
            watch: { enable: false },
            dev: false,
            buildId: bundleOptions.buildId || nanoid(),
            tracing: (_k = bundleOptions.tracing) !== null && _k !== void 0 ? _k : true,
            packPath: getPackPath(),
        }, {
            persistentCaching,
            isShortSession: true,
            dependencyTracking: persistentCaching,
            cacheDirectory,
            turbopackMemoryEviction: normalizeTurbopackMemoryEviction(config.turbopackMemoryEviction),
            smallPreallocation: isTruthyEnv(process.env.UTOO_TURBOPACK_SMALL_PREALLOCATION),
            turbopackGc: config.turbopackGc,
        });
        const progress = ((_l = bundleOptions.tracing) !== null && _l !== void 0 ? _l : true) ? new TaskProgress(project) : undefined;
        const start = Date.now();
        progress === null || progress === void 0 ? void 0 : progress.start("Analyzing");
        let completedTasks = 0;
        const result = await project
            .writeAnalyzeData(path.join(stagingPath, "data"))
            .finally(() => {
            var _a;
            completedTasks = (_a = progress === null || progress === void 0 ? void 0 : progress.stop()) !== null && _a !== void 0 ? _a : 0;
        });
        handleIssues(result.issues);
        // Stop the compilation session before copying or serving the static report.
        await project.shutdown();
        project = undefined;
        await cp(uiPath, stagingPath, { recursive: true });
        await writeFile(path.join(stagingPath, "data/entries.json"), JSON.stringify(result.entries));
        await writeFile(path.join(stagingPath, REPORT_MARKER), JSON.stringify({ tool: "@utoo/pack-analyzer", version: 1 }));
        await validateReportDirectory(outputPath);
        await rm(outputPath, { recursive: true, force: true });
        await rename(stagingPath, outputPath);
        stagingPath = undefined;
        if (progress) {
            console.log(`Analyzed in ${formatDuration(Date.now() - start)} (${formatTaskCount(completedTasks)})`);
        }
        return { outputPath, entries: result.entries };
    }
    finally {
        try {
            await (project === null || project === void 0 ? void 0 : project.shutdown());
        }
        finally {
            lock === null || lock === void 0 ? void 0 : lock.unlockSync();
            if (stagingPath)
                await rm(stagingPath, { recursive: true, force: true });
        }
    }
}
