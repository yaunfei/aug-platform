"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyze = analyze;
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const pack_shared_1 = require("@utoo/pack-shared");
const nanoid_1 = require("nanoid");
const webpackCompat_1 = require("../config/webpackCompat");
const project_1 = require("../core/project");
const cacheDirectory_1 = require("../utils/cacheDirectory");
const cleanOutput_1 = require("../utils/cleanOutput");
const common_1 = require("../utils/common");
const env_1 = require("../utils/env");
const findRoot_1 = require("../utils/findRoot");
const htmlEntry_1 = require("../utils/htmlEntry");
const lockfile_1 = require("../utils/lockfile");
const normalizePath_1 = require("../utils/normalizePath");
const runtimePluginStratety_1 = require("../utils/runtimePluginStratety");
const taskProgress_1 = require("../utils/taskProgress");
const validateEntry_1 = require("../utils/validateEntry");
const REPORT_MARKER = "utoo-analyzer.json";
function overlaps(a, b) {
    const contains = (parent, child) => {
        const relative = node_path_1.default.relative(parent, child);
        return (relative === "" ||
            (!relative.startsWith(`..${node_path_1.default.sep}`) &&
                relative !== ".." &&
                !node_path_1.default.isAbsolute(relative)));
    };
    return contains(a, b) || contains(b, a);
}
async function validateReportDirectory(outputPath) {
    try {
        const info = await (0, promises_1.lstat)(outputPath);
        if (!info.isDirectory() || info.isSymbolicLink()) {
            throw new Error(`Analyzer output must be a report directory: ${outputPath}`);
        }
        const marker = JSON.parse(await (0, promises_1.readFile)(node_path_1.default.join(outputPath, REPORT_MARKER), "utf8"));
        if (marker.tool !== "@utoo/pack-analyzer") {
            throw new Error("Not an Analyzer report");
        }
    }
    catch (error) {
        if (error.code === "ENOENT") {
            // A missing marker in an existing directory is not permission to replace it.
            try {
                await (0, promises_1.lstat)(outputPath);
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
async function analyze(options, projectPath, rootPath, analyzeOptions = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    (0, common_1.blockStdout)();
    const resolvedProjectPath = node_path_1.default.resolve(projectPath || process.cwd());
    const bundleOptions = (0, webpackCompat_1.resolveBundleOptions)(options, resolvedProjectPath, rootPath);
    const config = {
        ...bundleOptions.config,
        entry: (_b = (_a = bundleOptions.config.entry) === null || _a === void 0 ? void 0 : _a.map((entry) => ({ ...entry }))) !== null && _b !== void 0 ? _b : [],
        mode: "production",
        sourceMaps: true,
        stats: false,
    };
    (0, htmlEntry_1.processHtmlEntry)(config, resolvedProjectPath);
    (0, validateEntry_1.validateEntryPaths)(config, resolvedProjectPath);
    const serverEntries = typeof ((_c = config.server) === null || _c === void 0 ? void 0 : _c.entry) === "string"
        ? [{ import: config.server.entry }]
        : ((_e = (_d = config.server) === null || _d === void 0 ? void 0 : _d.entry) !== null && _e !== void 0 ? _e : []);
    if (!config.entry.length && !serverEntries.length) {
        throw new Error("Native Analyzer requires at least one application entry.");
    }
    if (config.entry.some((entry) => entry.library)) {
        throw new Error("Native Analyzer supports application entries; library builds are not supported.");
    }
    const outputPath = node_path_1.default.resolve(resolvedProjectPath, analyzeOptions.outputPath || ".utoo/analyze");
    const buildOutputPaths = [(0, cleanOutput_1.getOutputPath)(config, resolvedProjectPath)];
    if ((_g = (_f = config.server) === null || _f === void 0 ? void 0 : _f.output) === null || _g === void 0 ? void 0 : _g.path) {
        buildOutputPaths.push(node_path_1.default.resolve(resolvedProjectPath, config.server.output.path));
    }
    if (buildOutputPaths.some((buildPath) => overlaps(outputPath, buildPath))) {
        throw new Error("Analyzer output must be outside the application's build output directory.");
    }
    await validateReportDirectory(outputPath);
    const uiPath = node_path_1.default.resolve((0, common_1.getPackPath)(), "../analyzer");
    await (0, promises_1.readFile)(node_path_1.default.join(uiPath, "index.html"));
    const cacheDirectory = (0, cacheDirectory_1.resolveCacheDirectory)(resolvedProjectPath, config.cacheDirectory);
    const persistentCaching = (0, env_1.isPersistentCachingEnabled)(config.persistentCaching);
    const lock = await (0, lockfile_1.acquirePersistentCacheLock)(cacheDirectory, "utoo pack analyze", persistentCaching);
    let project;
    let stagingPath;
    try {
        await (0, promises_1.mkdir)(node_path_1.default.dirname(outputPath), { recursive: true });
        stagingPath = await (0, promises_1.mkdtemp)(node_path_1.default.join(node_path_1.default.dirname(outputPath), `.${node_path_1.default.basename(outputPath)}-`));
        project = await (0, project_1.projectFactory)()({
            config: {
                ...config,
                pluginRuntimeStrategy: (_h = config.pluginRuntimeStrategy) !== null && _h !== void 0 ? _h : ((0, runtimePluginStratety_1.useWorkerThreads)() ? "workerThreads" : "childProcesses"),
            },
            projectPath: (0, normalizePath_1.normalizePath)(resolvedProjectPath),
            rootPath: (0, findRoot_1.resolveRootPath)(resolvedProjectPath, rootPath),
            processEnv: (_j = bundleOptions.processEnv) !== null && _j !== void 0 ? _j : {},
            watch: { enable: false },
            dev: false,
            buildId: bundleOptions.buildId || (0, nanoid_1.nanoid)(),
            tracing: (_k = bundleOptions.tracing) !== null && _k !== void 0 ? _k : true,
            packPath: (0, common_1.getPackPath)(),
        }, {
            persistentCaching,
            isShortSession: true,
            dependencyTracking: persistentCaching,
            cacheDirectory,
            turbopackMemoryEviction: (0, env_1.normalizeTurbopackMemoryEviction)(config.turbopackMemoryEviction),
            smallPreallocation: (0, env_1.isTruthyEnv)(process.env.UTOO_TURBOPACK_SMALL_PREALLOCATION),
            turbopackGc: config.turbopackGc,
        });
        const progress = ((_l = bundleOptions.tracing) !== null && _l !== void 0 ? _l : true) ? new taskProgress_1.TaskProgress(project) : undefined;
        const start = Date.now();
        progress === null || progress === void 0 ? void 0 : progress.start("Analyzing");
        let completedTasks = 0;
        const result = await project
            .writeAnalyzeData(node_path_1.default.join(stagingPath, "data"))
            .finally(() => {
            var _a;
            completedTasks = (_a = progress === null || progress === void 0 ? void 0 : progress.stop()) !== null && _a !== void 0 ? _a : 0;
        });
        (0, pack_shared_1.handleIssues)(result.issues);
        // Stop the compilation session before copying or serving the static report.
        await project.shutdown();
        project = undefined;
        await (0, promises_1.cp)(uiPath, stagingPath, { recursive: true });
        await (0, promises_1.writeFile)(node_path_1.default.join(stagingPath, "data/entries.json"), JSON.stringify(result.entries));
        await (0, promises_1.writeFile)(node_path_1.default.join(stagingPath, REPORT_MARKER), JSON.stringify({ tool: "@utoo/pack-analyzer", version: 1 }));
        await validateReportDirectory(outputPath);
        await (0, promises_1.rm)(outputPath, { recursive: true, force: true });
        await (0, promises_1.rename)(stagingPath, outputPath);
        stagingPath = undefined;
        if (progress) {
            console.log(`Analyzed in ${(0, taskProgress_1.formatDuration)(Date.now() - start)} (${(0, taskProgress_1.formatTaskCount)(completedTasks)})`);
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
                await (0, promises_1.rm)(stagingPath, { recursive: true, force: true });
        }
    }
}
