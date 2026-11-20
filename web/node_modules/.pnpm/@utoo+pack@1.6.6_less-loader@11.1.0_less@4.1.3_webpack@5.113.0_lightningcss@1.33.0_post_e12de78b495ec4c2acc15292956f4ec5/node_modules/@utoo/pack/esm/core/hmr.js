import { formatIssue, HMR_ACTIONS_SENT_TO_BROWSER, } from "@utoo/pack-shared";
import { nanoid } from "nanoid";
import { WebSocketServer } from "ws";
import { resolveCacheDirectory } from "../utils/cacheDirectory.js";
import { cleanOutput, getOutputPath } from "../utils/cleanOutput.js";
import { debounce, getPackPath, processIssues } from "../utils/common.js";
import { isPersistentCachingEnabled, isTruthyEnv, normalizeTurbopackMemoryEviction, } from "../utils/env.js";
import { HtmlGenerationManager } from "../utils/HtmlGenerationManager.js";
import { processHtmlEntry } from "../utils/htmlEntry.js";
import { acquirePersistentCacheLock } from "../utils/lockfile.js";
import { normalizePath } from "../utils/normalizePath.js";
import { useWorkerThreads } from "../utils/runtimePluginStratety.js";
import { isNodeTarget } from "../utils/target.js";
import { formatDuration, formatTaskCount, TaskProgress, } from "../utils/taskProgress.js";
import { validateEntryPaths } from "../utils/validateEntry.js";
import { forwardBrowserLogs, isBrowserLogsMessage } from "./browserLogs.js";
import { consumeHmrSubscription } from "./hmrSubscription.js";
import { projectFactory } from "./project.js";
const wsServer = new WebSocketServer({ noServer: true });
const sessionId = Math.floor(Number.MAX_SAFE_INTEGER * Math.random());
export const HMR_CLIENT_MESSAGE_MAX_BYTES = 1000000;
/** Normalize and validate messages shared by the legacy and current HMR transports. */
export function parseHmrClientMessage(data) {
    let serializedData;
    if (typeof data === "string") {
        serializedData = data;
    }
    else if (Buffer.isBuffer(data)) {
        if (data.byteLength > HMR_CLIENT_MESSAGE_MAX_BYTES) {
            return { status: "too-large" };
        }
        serializedData = data.toString("utf8");
    }
    else if (Array.isArray(data) && data.every(Buffer.isBuffer)) {
        if (data.reduce((total, chunk) => total + chunk.byteLength, 0) >
            HMR_CLIENT_MESSAGE_MAX_BYTES) {
            return { status: "too-large" };
        }
        serializedData = Buffer.concat(data).toString("utf8");
    }
    else if (data instanceof ArrayBuffer) {
        if (data.byteLength > HMR_CLIENT_MESSAGE_MAX_BYTES) {
            return { status: "too-large" };
        }
        serializedData = Buffer.from(data).toString("utf8");
    }
    else if (ArrayBuffer.isView(data)) {
        if (data.byteLength > HMR_CLIENT_MESSAGE_MAX_BYTES) {
            return { status: "too-large" };
        }
        serializedData = Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString("utf8");
    }
    else {
        return { status: "malformed" };
    }
    if (Buffer.byteLength(serializedData) > HMR_CLIENT_MESSAGE_MAX_BYTES) {
        return { status: "too-large" };
    }
    try {
        const value = JSON.parse(serializedData);
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            return { status: "malformed" };
        }
        return { status: "ok", value: value };
    }
    catch (_a) {
        return { status: "malformed" };
    }
}
// Re-export HMR types from pack-shared for backward compatibility
export { HMR_ACTIONS_SENT_TO_BROWSER, } from "@utoo/pack-shared";
export const FAST_REFRESH_RUNTIME_RELOAD = "Fast Refresh had to perform a full reload due to a runtime error.";
function hasBlockingIssues(issues) {
    for (const issueMap of issues.values()) {
        for (const issue of issueMap.values()) {
            if (issue.severity !== "warning") {
                return true;
            }
        }
    }
    return false;
}
function hasBlockingResultIssues(result) {
    return result.issues.some((issue) => issue.severity === "error" || issue.severity === "fatal");
}
function addIssuesToErrors(errors, issues) {
    for (const issueMap of issues.values()) {
        for (const [key, issue] of issueMap) {
            if (issue.severity === "warning") {
                continue;
            }
            errors.set(key, {
                message: formatIssue(issue, false),
            });
        }
    }
}
function getCompilationErrors(issues) {
    const errors = new Map();
    addIssuesToErrors(errors, issues);
    return [...errors.values()];
}
function getClientIssueKey(id) {
    return `client:${id}`;
}
export async function createHotReloader(bundleOptions, projectPath, rootPath, onClientBuild) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const resolvedProjectPath = projectPath || process.cwd();
    const resolvedRootPath = rootPath || projectPath || process.cwd();
    const browserToTerminal = (_b = (_a = bundleOptions.config.devServer) === null || _a === void 0 ? void 0 : _a.browserToTerminal) !== null && _b !== void 0 ? _b : false;
    processHtmlEntry(bundleOptions.config, resolvedProjectPath);
    validateEntryPaths(bundleOptions.config, resolvedProjectPath);
    await cleanOutput(bundleOptions.config, resolvedProjectPath);
    const createProject = projectFactory({
        hasServerOutput: Boolean(((_c = bundleOptions.config.server) === null || _c === void 0 ? void 0 : _c.entry) ||
            ((_d = bundleOptions.config.server) === null || _d === void 0 ? void 0 : _d.function)),
        nodeTarget: isNodeTarget(bundleOptions.config.target),
    });
    const persistentCaching = isPersistentCachingEnabled(bundleOptions.config.persistentCaching);
    const turbopackMemoryEviction = normalizeTurbopackMemoryEviction(bundleOptions.config.turbopackMemoryEviction);
    const smallPreallocation = isTruthyEnv(process.env.UTOO_TURBOPACK_SMALL_PREALLOCATION);
    const cacheDirectory = resolveCacheDirectory(resolvedProjectPath, bundleOptions.config.cacheDirectory);
    const persistentCacheLock = await acquirePersistentCacheLock(cacheDirectory, "utoo pack dev", persistentCaching);
    const resolvedOutputPath = getOutputPath(bundleOptions.config, resolvedProjectPath);
    const htmlGenerationManager = new HtmlGenerationManager(bundleOptions.config, resolvedOutputPath, (_e = bundleOptions.config.output) === null || _e === void 0 ? void 0 : _e.publicPath);
    const shouldCreateWebpackStats = Boolean(process.env.ANALYZE) || Boolean(bundleOptions.config.stats);
    const showProgress = (_f = bundleOptions.tracing) !== null && _f !== void 0 ? _f : true;
    let project;
    try {
        project = await createProject({
            processEnv: (_g = bundleOptions.processEnv) !== null && _g !== void 0 ? _g : {},
            watch: {
                ...bundleOptions.watch,
                enable: true,
            },
            dev: true,
            buildId: bundleOptions.buildId || nanoid(),
            tracing: showProgress,
            config: {
                ...bundleOptions.config,
                mode: "development",
                stats: shouldCreateWebpackStats,
                optimization: {
                    ...bundleOptions.config.optimization,
                    minify: false,
                    moduleIds: "named",
                },
                persistentCaching,
                pluginRuntimeStrategy: (_j = (_h = bundleOptions === null || bundleOptions === void 0 ? void 0 : bundleOptions.config) === null || _h === void 0 ? void 0 : _h.pluginRuntimeStrategy) !== null && _j !== void 0 ? _j : (useWorkerThreads() ? "workerThreads" : "childProcesses"),
            },
            projectPath: normalizePath(resolvedProjectPath),
            rootPath: resolvedRootPath,
            packPath: getPackPath(),
        }, {
            persistentCaching,
            turbopackMemoryEviction,
            smallPreallocation,
            turbopackGc: bundleOptions.config.turbopackGc,
            cacheDirectory,
        });
    }
    catch (error) {
        persistentCacheLock === null || persistentCacheLock === void 0 ? void 0 : persistentCacheLock.unlockSync();
        throw error;
    }
    const progress = showProgress ? new TaskProgress(project) : undefined;
    const entrypointsSubscription = project.entrypointsSubscribe();
    let currentEntriesHandlingResolve;
    let currentEntriesHandling = new Promise((resolve) => (currentEntriesHandlingResolve = resolve));
    let hmrEventHappened = false;
    let hmrHash = 0;
    const clients = new Set();
    const clientStates = new WeakMap();
    const currentEntryIssues = new Map();
    const backgroundWatchSubscriptions = new Set();
    let currentWatchedEntrypoints = [];
    let currentEntrypoints = {};
    let backgroundWatchersStarted = false;
    let backgroundWatchGeneration = 0;
    let outputWriteTask = Promise.resolve();
    let closed = false;
    let closePromise;
    function queueOutputWrite(write) {
        const task = outputWriteTask.then(() => {
            if (closed)
                throw new Error("The dev server is closing or closed");
            return write();
        });
        outputWriteTask = task.then(() => { }, () => { });
        return task;
    }
    async function notifyClientBuild(isRebuild) {
        if (closed || hasBlockingIssues(currentEntryIssues))
            return;
        const clientPaths = hotReloader.getClientPaths();
        if (clientPaths.length > 0) {
            await (onClientBuild === null || onClientBuild === void 0 ? void 0 : onClientBuild({ clientPaths, isRebuild }));
        }
    }
    function markHmrEvent() {
        if (!progress || hmrEventHappened) {
            return;
        }
        progress.start("Compiling");
        hmrEventHappened = true;
    }
    function finishHmrEvent(duration) {
        if (!progress || !hmrEventHappened) {
            return;
        }
        const completedTasks = progress.stop();
        console.log(`Compiled in ${formatDuration(duration)} (${formatTaskCount(completedTasks)})`);
        hmrEventHappened = false;
    }
    function sendToClient(client, payload) {
        client.send(JSON.stringify(payload));
    }
    function sendEnqueuedMessages() {
        if (hasBlockingIssues(currentEntryIssues)) {
            return;
        }
        for (const client of clients) {
            const state = clientStates.get(client);
            if (!state) {
                continue;
            }
            if (hasBlockingIssues(state.clientIssues)) {
                return;
            }
            for (const payload of state.hmrPayloads.values()) {
                sendToClient(client, payload);
            }
            state.hmrPayloads.clear();
            if (state.turbopackUpdates.length > 0) {
                sendToClient(client, {
                    action: HMR_ACTIONS_SENT_TO_BROWSER.TURBOPACK_MESSAGE,
                    data: state.turbopackUpdates,
                });
                state.turbopackUpdates.length = 0;
            }
        }
    }
    const sendEnqueuedMessagesDebounce = debounce(sendEnqueuedMessages, 2);
    function sendTurbopackMessage(client, payload) {
        const state = clientStates.get(client);
        if (!state) {
            return;
        }
        payload.issues = [];
        state.turbopackUpdates.push(payload);
        markHmrEvent();
        sendEnqueuedMessagesDebounce();
    }
    const writtenEndpointPaths = new Map();
    function updateWrittenEndpointPaths(endpoints, paths) {
        if (!endpoints || !paths) {
            return;
        }
        endpoints.forEach((endpoint, index) => {
            const written = paths[index];
            if (written) {
                writtenEndpointPaths.set(endpoint, written);
                htmlGenerationManager.setWrittenEndpointPath(endpoint, written);
            }
        });
    }
    function setEntrypoints(entrypoints) {
        writtenEndpointPaths.clear();
        htmlGenerationManager.setEntrypoints(entrypoints);
        updateWrittenEndpointPaths(entrypoints.apps, entrypoints.appPaths);
        updateWrittenEndpointPaths(entrypoints.libraries, entrypoints.libraryPaths);
    }
    async function writeAllEntrypointsToDisk() {
        const result = await project.writeAllEntrypointsToDisk();
        processIssues(result, true, true);
        // All-write results contain new EndpointImpl objects. Keep the identities
        // used by subscriptions so subsequent endpoint writes update the same HTML groups.
        setEntrypoints({
            ...result,
            apps: currentEntrypoints.apps,
            libraries: currentEntrypoints.libraries,
        });
        await htmlGenerationManager.generateAll();
        return result;
    }
    async function writeEntrypointToDisk(entrypoint, generateHtml = true) {
        const result = await entrypoint.writeToDisk();
        processIssues(result, true, true);
        writtenEndpointPaths.set(entrypoint, result);
        htmlGenerationManager.setWrittenEndpointPath(entrypoint, result);
        if (generateHtml) {
            await htmlGenerationManager.generateForEndpoint(entrypoint);
        }
    }
    async function writeOutputToDisk(entrypoint) {
        if (shouldCreateWebpackStats) {
            await writeAllEntrypointsToDisk();
        }
        else {
            await writeEntrypointToDisk(entrypoint);
        }
    }
    async function disposeBackgroundWatchSubscriptions() {
        const subscriptions = [...backgroundWatchSubscriptions];
        backgroundWatchSubscriptions.clear();
        currentEntryIssues.clear();
        await Promise.all(subscriptions.map((subscription) => { var _a; return (_a = subscription.return) === null || _a === void 0 ? void 0 : _a.call(subscription); }));
    }
    function scheduleOutputWrite(entrypoint, generation) {
        if (!backgroundWatchersStarted ||
            closed ||
            generation !== backgroundWatchGeneration) {
            return;
        }
        currentEntriesHandling
            .then(() => queueOutputWrite(async () => {
            if (generation !== backgroundWatchGeneration)
                return;
            markHmrEvent();
            await writeOutputToDisk(entrypoint);
            await notifyClientBuild(true);
        }))
            .catch((error) => {
            if (!closed)
                console.error(error);
        });
    }
    async function refreshBackgroundWatchers() {
        const generation = ++backgroundWatchGeneration;
        await disposeBackgroundWatchSubscriptions();
        if (!backgroundWatchersStarted || closed) {
            return;
        }
        await Promise.all(currentWatchedEntrypoints.map(async (entrypoint) => {
            var _a, _b;
            const [clientChanges, serverChanges] = await Promise.all([
                entrypoint.clientChanged(),
                entrypoint.serverChanged(true),
            ]);
            if (closed || generation !== backgroundWatchGeneration) {
                await Promise.all([
                    (_a = clientChanges.return) === null || _a === void 0 ? void 0 : _a.call(clientChanges),
                    (_b = serverChanges.return) === null || _b === void 0 ? void 0 : _b.call(serverChanges),
                ]);
                return;
            }
            backgroundWatchSubscriptions.add(clientChanges);
            backgroundWatchSubscriptions.add(serverChanges);
            const watchChanges = async (subscription, issueKey) => {
                try {
                    for await (const data of subscription) {
                        if (closed || generation !== backgroundWatchGeneration) {
                            return;
                        }
                        processIssues(currentEntryIssues, issueKey, data, false, true);
                        if (hasBlockingResultIssues(data)) {
                            markHmrEvent();
                            sendEnqueuedMessagesDebounce();
                            continue;
                        }
                        scheduleOutputWrite(entrypoint, generation);
                    }
                }
                catch (error) {
                    if (!closed && generation === backgroundWatchGeneration) {
                        console.error(error);
                        process.exit(1);
                    }
                }
                finally {
                    backgroundWatchSubscriptions.delete(subscription);
                    currentEntryIssues.delete(issueKey);
                }
            };
            const entrypointIndex = currentWatchedEntrypoints.indexOf(entrypoint);
            void watchChanges(clientChanges, `entrypoint:${entrypointIndex}:client`);
            void watchChanges(serverChanges, `entrypoint:${entrypointIndex}:server`);
        }));
    }
    async function subscribeToHmrEvents(client, id, expectedVersion) {
        const state = clientStates.get(client);
        if (!state || state.subscriptions.has(id)) {
            return;
        }
        const subscription = project.hmrEvents(id, expectedVersion);
        state.subscriptions.set(id, subscription);
        const issueKey = getClientIssueKey(id);
        try {
            await consumeHmrSubscription(subscription, (data) => processIssues(state.clientIssues, issueKey, data, false, true), (data) => sendTurbopackMessage(client, data));
        }
        catch (e) {
            // The client might be using an HMR session from a previous server, tell them
            // to fully reload the page to resolve the issue. We can't use
            // `hotReloader.send` since that would force every connected client to
            // reload, only this client is out of date.
            const reloadAction = {
                action: HMR_ACTIONS_SENT_TO_BROWSER.RELOAD,
                data: `error in HMR event subscription for ${id}: ${e}`,
            };
            sendToClient(client, reloadAction);
            client.close();
            return;
        }
    }
    function unsubscribeFromHmrEvents(client, id) {
        const state = clientStates.get(client);
        if (!state) {
            return;
        }
        const subscription = state.subscriptions.get(id);
        subscription === null || subscription === void 0 ? void 0 : subscription.return();
        state.clientIssues.delete(getClientIssueKey(id));
    }
    async function handleEntrypointsSubscription() {
        for await (const entrypoints of entrypointsSubscription) {
            if (closed)
                return;
            ++backgroundWatchGeneration;
            if (!currentEntriesHandlingResolve) {
                currentEntriesHandling = new Promise(
                // eslint-disable-next-line no-loop-func
                (resolve) => (currentEntriesHandlingResolve = resolve));
            }
            await queueOutputWrite(async () => {
                var _a, _b;
                currentEntrypoints = entrypoints;
                currentWatchedEntrypoints = [
                    ...((_a = entrypoints.apps) !== null && _a !== void 0 ? _a : []),
                    ...((_b = entrypoints.libraries) !== null && _b !== void 0 ? _b : []),
                ];
                setEntrypoints(entrypoints);
                if (shouldCreateWebpackStats) {
                    await writeAllEntrypointsToDisk();
                }
                else {
                    await Promise.all(currentWatchedEntrypoints.map((entrypoint) => writeEntrypointToDisk(entrypoint, false)));
                    await htmlGenerationManager.generateAll();
                }
                if (backgroundWatchersStarted) {
                    await refreshBackgroundWatchers();
                    await notifyClientBuild(true).catch((error) => console.error(error));
                }
            });
            currentEntriesHandlingResolve();
            currentEntriesHandlingResolve = undefined;
        }
    }
    const hotReloader = {
        turbopackProject: project,
        serverStats: null,
        getClientPaths() {
            return [
                ...new Set([...writtenEndpointPaths.values()].flatMap((endpoint) => endpoint.clientPaths)),
            ];
        },
        async writeAllEntrypointsToDisk() {
            await currentEntriesHandling;
            return queueOutputWrite(async () => {
                const result = await writeAllEntrypointsToDisk();
                await notifyClientBuild(true);
                return result;
            });
        },
        onHMR(req, socket, head, onUpgrade) {
            wsServer.handleUpgrade(req, socket, head, (client) => {
                onUpgrade === null || onUpgrade === void 0 ? void 0 : onUpgrade(client);
                const subscriptions = new Map();
                clients.add(client);
                clientStates.set(client, {
                    hmrPayloads: new Map(),
                    turbopackUpdates: [],
                    subscriptions,
                    clientIssues: new Map(),
                });
                client.on("close", () => {
                    var _a;
                    // Remove active subscriptions
                    for (const subscription of subscriptions.values()) {
                        (_a = subscription.return) === null || _a === void 0 ? void 0 : _a.call(subscription);
                    }
                    clientStates.delete(client);
                    clients.delete(client);
                });
                client.addEventListener("message", ({ data }) => {
                    const result = parseHmrClientMessage(data);
                    if (result.status === "too-large") {
                        client.close(1009, "HMR client message exceeds the 1 MB limit");
                        return;
                    }
                    if (result.status === "malformed")
                        return;
                    const parsedData = result.value;
                    // messages
                    switch (parsedData.event) {
                        case "browser-logs":
                            if (isBrowserLogsMessage(parsedData)) {
                                void forwardBrowserLogs(parsedData, browserToTerminal, project, resolvedProjectPath, resolvedOutputPath).catch((error) => {
                                    console.error("Unable to forward browser logs", error);
                                });
                            }
                            break;
                        case "client-error": // { errorCount, clientId }
                        case "client-warning": // { warningCount, clientId }
                        case "client-success": // { clientId }
                        case "client-full-reload": // { stackTrace, hadRuntimeError }
                            const { hadRuntimeError, dependencyChain } = parsedData;
                            if (hadRuntimeError) {
                                console.warn(FAST_REFRESH_RUNTIME_RELOAD);
                            }
                            if (Array.isArray(dependencyChain) &&
                                typeof dependencyChain[0] === "string") {
                                const cleanedModulePath = dependencyChain[0]
                                    .replace(/^\[project\]/, ".")
                                    .replace(/ \[.*\] \(.*\)$/, "");
                                console.warn(`Fast Refresh had to perform a full reload when ${cleanedModulePath} changed.`);
                            }
                            break;
                        default:
                            // Might be a Turbopack message...
                            if (!parsedData.type) {
                                throw new Error(`unrecognized HMR message "${data}"`);
                            }
                    }
                    // Turbopack messages
                    switch (parsedData.type) {
                        case "turbopack-subscribe":
                            if (typeof parsedData.path === "string") {
                                subscribeToHmrEvents(client, parsedData.path, typeof parsedData.version === "string"
                                    ? parsedData.version
                                    : undefined);
                            }
                            break;
                        case "turbopack-unsubscribe":
                            if (typeof parsedData.path === "string") {
                                unsubscribeFromHmrEvents(client, parsedData.path);
                            }
                            break;
                        default:
                            if (!parsedData.event) {
                                throw new Error(`unrecognized Turbopack HMR message "${data}"`);
                            }
                    }
                });
                const turbopackConnected = {
                    action: HMR_ACTIONS_SENT_TO_BROWSER.TURBOPACK_CONNECTED,
                    data: { sessionId, browserToTerminal },
                };
                sendToClient(client, turbopackConnected);
                const errors = getCompilationErrors(currentEntryIssues);
                (async function () {
                    const sync = {
                        action: HMR_ACTIONS_SENT_TO_BROWSER.SYNC,
                        errors,
                        warnings: [],
                        hash: "",
                    };
                    sendToClient(client, sync);
                })();
            });
        },
        registerClient(ws) {
            const subscriptions = new Map();
            clients.add(ws);
            clientStates.set(ws, {
                hmrPayloads: new Map(),
                turbopackUpdates: [],
                subscriptions,
                clientIssues: new Map(),
            });
            const turbopackConnected = {
                action: HMR_ACTIONS_SENT_TO_BROWSER.TURBOPACK_CONNECTED,
                data: { sessionId, browserToTerminal },
            };
            sendToClient(ws, turbopackConnected);
            const errors = getCompilationErrors(currentEntryIssues);
            const sync = {
                action: HMR_ACTIONS_SENT_TO_BROWSER.SYNC,
                errors,
                warnings: [],
                hash: "",
            };
            sendToClient(ws, sync);
        },
        unregisterClient(ws) {
            var _a;
            const state = clientStates.get(ws);
            if (state) {
                for (const subscription of state.subscriptions.values()) {
                    (_a = subscription.return) === null || _a === void 0 ? void 0 : _a.call(subscription);
                }
            }
            clientStates.delete(ws);
            clients.delete(ws);
        },
        handleClientMessage(ws, data) {
            const result = parseHmrClientMessage(data);
            if (result.status === "too-large") {
                ws.close(1009, "HMR client message exceeds the 1 MB limit");
                return;
            }
            if (result.status === "malformed")
                return;
            const parsedData = result.value;
            switch (parsedData.event) {
                case "browser-logs":
                    if (isBrowserLogsMessage(parsedData)) {
                        void forwardBrowserLogs(parsedData, browserToTerminal, project, resolvedProjectPath, resolvedOutputPath).catch((error) => {
                            console.error("Unable to forward browser logs", error);
                        });
                    }
                    break;
                case "client-error":
                case "client-warning":
                case "client-success":
                case "client-full-reload": {
                    const { hadRuntimeError, dependencyChain } = parsedData;
                    if (hadRuntimeError) {
                        console.warn(FAST_REFRESH_RUNTIME_RELOAD);
                    }
                    if (Array.isArray(dependencyChain) &&
                        typeof dependencyChain[0] === "string") {
                        const cleanedModulePath = dependencyChain[0]
                            .replace(/^\[project\]/, ".")
                            .replace(/ \[.*\] \(.*\)$/, "");
                        console.warn(`Fast Refresh had to perform a full reload when ${cleanedModulePath} changed.`);
                    }
                    break;
                }
                default:
                    if (!parsedData.type) {
                        throw new Error(`unrecognized HMR message "${data}"`);
                    }
            }
            switch (parsedData.type) {
                case "turbopack-subscribe":
                    if (typeof parsedData.path === "string") {
                        subscribeToHmrEvents(ws, parsedData.path, typeof parsedData.version === "string"
                            ? parsedData.version
                            : undefined);
                    }
                    break;
                case "turbopack-unsubscribe":
                    if (typeof parsedData.path === "string") {
                        unsubscribeFromHmrEvents(ws, parsedData.path);
                    }
                    break;
                default:
                    if (!parsedData.event) {
                        throw new Error(`unrecognized Turbopack HMR message "${data}"`);
                    }
            }
        },
        send(action) {
            const payload = JSON.stringify(action);
            for (const client of clients) {
                client.send(payload);
            }
        },
        setHmrServerError(_error) {
            // Not implemented yet.
        },
        clearHmrServerError() {
            // Not implemented yet.
        },
        async start() {
            if (backgroundWatchersStarted) {
                return;
            }
            await queueOutputWrite(async () => {
                backgroundWatchersStarted = true;
                await refreshBackgroundWatchers();
                await notifyClientBuild(false);
            });
        },
        async buildFallbackError() {
            // Not implemented yet.
        },
        async activateLazyChunk(chunkPath) {
            await currentEntriesHandling;
            return queueOutputWrite(async () => {
                if (!(await project.activateLazyChunk(chunkPath))) {
                    return false;
                }
                const owners = [...writtenEndpointPaths.entries()]
                    .filter(([, written]) => written.clientPaths.includes(chunkPath))
                    .map(([endpoint]) => endpoint);
                if (owners.length === 0 || shouldCreateWebpackStats) {
                    // Refresh project-wide stats, or recover a chunk without a known owner.
                    await writeAllEntrypointsToDisk();
                }
                else {
                    await Promise.all(owners.map((endpoint) => writeEntrypointToDisk(endpoint, false)));
                    await htmlGenerationManager.generateAll();
                }
                await notifyClientBuild(true);
                return true;
            });
        },
        async close() {
            hmrEventHappened = false;
            progress === null || progress === void 0 ? void 0 : progress.stop();
            closed = true;
            const disposePromise = disposeBackgroundWatchSubscriptions();
            closePromise !== null && closePromise !== void 0 ? closePromise : (closePromise = outputWriteTask
                .then(() => (persistentCaching ? project.shutdown() : project.onExit()))
                .catch((err) => {
                console.error(err);
            })
                .finally(() => {
                persistentCacheLock === null || persistentCacheLock === void 0 ? void 0 : persistentCacheLock.unlockSync();
            }));
            for (const wsClient of clients) {
                wsClient.close();
            }
            clients.clear();
            await Promise.all([disposePromise, closePromise]);
        },
    };
    const initialBuildStart = Date.now();
    markHmrEvent();
    handleEntrypointsSubscription().catch((err) => {
        if (closed)
            return;
        console.error(err);
        process.exit(1);
    });
    // Write empty manifests
    await currentEntriesHandling;
    finishHmrEvent(Date.now() - initialBuildStart);
    async function handleProjectUpdates() {
        for await (const updateMessage of project.updateInfoSubscribe(30)) {
            switch (updateMessage.updateType) {
                case "start": {
                    hotReloader.send({ action: HMR_ACTIONS_SENT_TO_BROWSER.BUILDING });
                    break;
                }
                case "end": {
                    sendEnqueuedMessages();
                    const errors = new Map();
                    addIssuesToErrors(errors, currentEntryIssues);
                    for (const client of clients) {
                        const state = clientStates.get(client);
                        if (!state) {
                            continue;
                        }
                        const clientErrors = new Map(errors);
                        addIssuesToErrors(clientErrors, state.clientIssues);
                        sendToClient(client, {
                            action: HMR_ACTIONS_SENT_TO_BROWSER.BUILT,
                            hash: String(++hmrHash),
                            errors: [...clientErrors.values()],
                            warnings: [],
                        });
                    }
                    finishHmrEvent(updateMessage.value.duration);
                    break;
                }
                default:
            }
        }
    }
    handleProjectUpdates().catch((err) => {
        console.error(err);
        process.exit(1);
    });
    return hotReloader;
}
