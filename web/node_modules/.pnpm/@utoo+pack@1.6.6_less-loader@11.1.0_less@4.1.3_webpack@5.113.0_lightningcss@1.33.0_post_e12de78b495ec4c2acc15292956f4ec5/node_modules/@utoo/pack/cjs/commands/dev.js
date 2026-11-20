"use strict";
/**
 * Dev server implementation using Hono + @hono/node-server + @hono/node-ws.
 * Keeps the same public API as dev.ts; do not remove dev.ts until this is verified.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.serve = serve;
const node_server_1 = require("@hono/node-server");
const serve_static_1 = require("@hono/node-server/serve-static");
const node_ws_1 = require("@hono/node-ws");
const fs_1 = __importDefault(require("fs"));
const get_port_1 = __importDefault(require("get-port"));
const hono_1 = require("hono");
const accept_1 = require("hono/utils/accept");
const https_1 = __importDefault(require("https"));
const path_1 = __importDefault(require("path"));
const webpackCompat_1 = require("../config/webpackCompat");
const hmr_1 = require("../core/hmr");
const proxyHono_1 = require("../core/proxyHono");
const cleanOutput_1 = require("../utils/cleanOutput");
const common_1 = require("../utils/common");
const findRoot_1 = require("../utils/findRoot");
const mkcert_1 = require("../utils/mkcert");
const printServerInfo_1 = require("../utils/printServerInfo");
const xcodeProfile_1 = require("../utils/xcodeProfile");
// --- Path helpers (same logic as dev.ts, not exported) ---
function parsePath(pathStr) {
    const hashIndex = pathStr.indexOf("#");
    const queryIndex = pathStr.indexOf("?");
    const hasQuery = queryIndex > -1 && (hashIndex < 0 || queryIndex < hashIndex);
    if (hasQuery || hashIndex > -1) {
        return {
            pathname: pathStr.substring(0, hasQuery ? queryIndex : hashIndex),
            query: hasQuery
                ? pathStr.substring(queryIndex, hashIndex > -1 ? hashIndex : undefined)
                : "",
            hash: hashIndex > -1 ? pathStr.slice(hashIndex) : "",
        };
    }
    return { pathname: pathStr, query: "", hash: "" };
}
function pathHasPrefix(pathStr, prefix) {
    if (typeof pathStr !== "string") {
        return false;
    }
    const { pathname } = parsePath(pathStr);
    return pathname === prefix || pathname.startsWith(prefix + "/");
}
function removePathPrefix(pathStr, prefix) {
    if (!pathHasPrefix(pathStr, prefix)) {
        return pathStr;
    }
    const withoutPrefix = pathStr.slice(prefix.length);
    if (withoutPrefix.startsWith("/")) {
        return withoutPrefix;
    }
    return `/${withoutPrefix}`;
}
function normalizedPublicPath(publicPath) {
    const escapedPublicPath = (publicPath === null || publicPath === void 0 ? void 0 : publicPath.replace(/^\/+|\/+$/g, "")) || false;
    if (!escapedPublicPath) {
        return "";
    }
    try {
        if (URL.canParse(escapedPublicPath)) {
            const u = new URL(escapedPublicPath).toString();
            return u.endsWith("/") ? u.slice(0, -1) : u;
        }
    }
    catch (_a) { }
    return `/${escapedPublicPath}`;
}
function isRuntimeResolvedPublicPath(publicPath) {
    return publicPath === "runtime" || publicPath === "auto";
}
// --- Public types (match dev.ts for index switch) ---
// The `.<hex>` suffix produced by `[contenthash]` filename templates. Turbopack's
// default `_<hash>` suffix is derived from the asset ident, so it stays the same
// when a manifest chunk is rewritten and needs no stripping.
const CONTENT_HASH_SUFFIX = /\.[0-9a-f]{6,}(\.js)$/;
/**
 * Finds the most recently written chunk in `distRoot` that shares the
 * content-hash-less stem of `chunkPath` (relative to `distRoot`).
 */
async function latestChunkWithSameStem(distRoot, chunkPath) {
    const dir = path_1.default.posix.dirname(chunkPath);
    const stem = path_1.default.posix
        .basename(chunkPath)
        .replace(CONTENT_HASH_SUFFIX, "$1");
    const absDir = path_1.default.join(distRoot, dir);
    let entries;
    try {
        entries = await fs_1.default.promises.readdir(absDir);
    }
    catch (_a) {
        return null;
    }
    let latest = null;
    for (const name of entries) {
        if (name.replace(CONTENT_HASH_SUFFIX, "$1") !== stem)
            continue;
        const { mtimeMs } = await fs_1.default.promises.stat(path_1.default.join(absDir, name));
        if (!latest || mtimeMs > latest.mtimeMs)
            latest = { name, mtimeMs };
    }
    return latest ? path_1.default.posix.join(dir, latest.name) : null;
}
async function resolveDevConfig(options, projectPath, rootPath, serverOptions) {
    var _a, _b, _d, _e, _f, _g;
    const cfgDevServer = (_b = (_a = options.config) === null || _a === void 0 ? void 0 : _a.devServer) !== null && _b !== void 0 ? _b : {};
    const port = typeof (serverOptions === null || serverOptions === void 0 ? void 0 : serverOptions.port) !== "undefined"
        ? serverOptions.port
        : ((_d = cfgDevServer.port) !== null && _d !== void 0 ? _d : 3000);
    const hostname = (_f = (_e = serverOptions === null || serverOptions === void 0 ? void 0 : serverOptions.hostname) !== null && _e !== void 0 ? _e : cfgDevServer.host) !== null && _f !== void 0 ? _f : "localhost";
    const useHttps = typeof (serverOptions === null || serverOptions === void 0 ? void 0 : serverOptions.https) !== "undefined"
        ? serverOptions.https
        : cfgDevServer.https;
    let selfSignedCertificate = serverOptions === null || serverOptions === void 0 ? void 0 : serverOptions.selfSignedCertificate;
    if (useHttps && !selfSignedCertificate) {
        try {
            const cert = await (0, mkcert_1.createSelfSignedCertificate)(hostname);
            if (cert)
                selfSignedCertificate = cert;
        }
        catch (_h) {
            // fall back to http
        }
    }
    const bundleOptions = {
        ...options,
        config: {
            ...options.config,
            devServer: {
                hot: true,
                ...(((_g = options.config) === null || _g === void 0 ? void 0 : _g.devServer) || {}),
            },
        },
        packPath: (0, common_1.getPackPath)(),
    };
    const projectPathResolved = projectPath || process.cwd();
    const rootPathResolved = rootPath !== null && rootPath !== void 0 ? rootPath : projectPathResolved;
    const actualPort = await (0, get_port_1.default)({ port, host: hostname });
    if (actualPort !== port) {
        console.warn(`Port ${port} is in use, using available port ${actualPort} instead.`);
    }
    const serveOptsBase = {
        port: actualPort,
        hostname,
        ...(useHttps && selfSignedCertificate
            ? {
                createServer: https_1.default.createServer,
                serverOptions: {
                    key: fs_1.default.readFileSync(selfSignedCertificate.key),
                    cert: fs_1.default.readFileSync(selfSignedCertificate.cert),
                },
            }
            : {}),
    };
    return {
        bundleOptions,
        projectPathResolved,
        rootPathResolved,
        serveOptsBase,
    };
}
function serve(options, projectPath, rootPath, serverOptions) {
    const bundleOptions = (0, webpackCompat_1.resolveBundleOptions)(options, projectPath, rootPath);
    rootPath = (0, findRoot_1.resolveRootPath)(projectPath, rootPath);
    return runDev(bundleOptions, projectPath, rootPath, serverOptions).then((handle) => {
        if (serverOptions === null || serverOptions === void 0 ? void 0 : serverOptions.returnHandle)
            return handle;
    });
}
const HMR_PATH = "/turbopack-hmr";
async function runDev(options, projectPath, rootPath, serverOptions) {
    var _a, _b, _d, _e, _f, _g, _h;
    (0, common_1.blockStdout)();
    process.title = "utoopack-dev-server";
    if (process.env.XCODE_PROFILE) {
        await (0, xcodeProfile_1.xcodeProfilingReady)();
    }
    process.env.NODE_ENV = "development";
    const { bundleOptions, projectPathResolved, rootPathResolved, serveOptsBase, } = await resolveDevConfig(options, projectPath, rootPath, serverOptions);
    const hotReloader = await (0, hmr_1.createHotReloader)(bundleOptions, projectPathResolved, rootPathResolved, serverOptions === null || serverOptions === void 0 ? void 0 : serverOptions.onClientBuild);
    let server;
    let webSocket;
    let closePromise;
    const exception = (error) => {
        console.error(error);
    };
    const rejectionHandled = () => { };
    const onSignal = () => {
        void handle.close().then(() => process.exit(0), (error) => {
            console.error(error);
            process.exit(1);
        });
    };
    const closeResources = async () => {
        process.off("SIGINT", onSignal);
        process.off("rejectionHandled", rejectionHandled);
        process.off("uncaughtException", exception);
        process.off("unhandledRejection", exception);
        const closeHttp = new Promise((resolve, reject) => {
            if (!server) {
                resolve();
                return;
            }
            server.close((error) => {
                if (error &&
                    error.code !== "ERR_SERVER_NOT_RUNNING") {
                    reject(error);
                }
                else {
                    resolve();
                }
            });
            // Stop accepting requests before terminating existing HTTP connections.
            if ("closeAllConnections" in server &&
                typeof server.closeAllConnections === "function") {
                server.closeAllConnections();
            }
        });
        const closeWebSocket = new Promise((resolve, reject) => {
            if (!webSocket) {
                resolve();
                return;
            }
            for (const client of webSocket.wss.clients) {
                client.terminate();
            }
            webSocket.wss.close((error) => {
                if (error)
                    reject(error);
                else
                    resolve();
            });
        });
        const results = await Promise.allSettled([
            closeHttp,
            closeWebSocket,
            hotReloader.close(),
        ]);
        const errors = results.flatMap((result) => result.status === "rejected" ? [result.reason] : []);
        if (errors.length > 0) {
            throw new AggregateError(errors, "Failed to close the dev server");
        }
    };
    const handle = {
        port: serveOptsBase.port,
        hostname: serveOptsBase.hostname,
        writeAllEntrypointsToDisk() {
            if (closePromise) {
                return Promise.reject(new Error("The dev server is closing or closed"));
            }
            return hotReloader.writeAllEntrypointsToDisk();
        },
        close() {
            // Keep handling forwarded signals until the pending cache flush finishes.
            closePromise !== null && closePromise !== void 0 ? closePromise : (closePromise = closeResources().finally(() => {
                process.off("SIGTERM", onSignal);
            }));
            return closePromise;
        },
    };
    try {
        await hotReloader.start();
        const distRoot = (0, cleanOutput_1.getOutputPath)(options.config, projectPathResolved);
        const publicPath = (_b = (_a = options.config) === null || _a === void 0 ? void 0 : _a.output) === null || _b === void 0 ? void 0 : _b.publicPath;
        // Skip prefix stripping for runtime-resolved publicPath modes and when publicPath is absent.
        const normalizedPrefix = publicPath && !isRuntimeResolvedPublicPath(publicPath)
            ? normalizedPublicPath(publicPath)
            : "";
        const app = new hono_1.Hono();
        webSocket = (0, node_ws_1.createNodeWebSocket)({ app });
        const { injectWebSocket, upgradeWebSocket } = webSocket;
        // Manifest chunks of lazily compiled dynamic imports are rewritten under a
        // new content hash on activation; serve the browser's stable URL from there.
        const lazyChunkAliases = new Map();
        const stripPublicPathPrefix = (reqPath) => {
            if (!normalizedPrefix)
                return reqPath;
            // Absolute-URL publicPath: do not rewrite (match dev.ts).
            if (normalizedPrefix.startsWith("http://") ||
                normalizedPrefix.startsWith("https://")) {
                return reqPath;
            }
            if (pathHasPrefix(reqPath, normalizedPrefix)) {
                return removePathPrefix(reqPath, normalizedPrefix);
            }
            return reqPath;
        };
        const rewriteRequestPath = (reqPath) => {
            // Aliases are keyed by the output-relative chunk path, i.e. after the
            // public-path prefix is removed.
            const distPath = stripPublicPathPrefix(reqPath);
            const alias = lazyChunkAliases.get(distPath.replace(/^\/+/, ""));
            return alias ? `/${alias}` : distPath;
        };
        // HMR WebSocket route must be registered before "/*" so it is not handled by serveStatic
        app.get(HMR_PATH, upgradeWebSocket((_c) => ({
            onOpen(_ev, ws) {
                hotReloader.registerClient(ws);
            },
            onMessage(ev, ws) {
                try {
                    const data = typeof ev.data === "string" ? ev.data : ev.data.toString();
                    hotReloader.handleClientMessage(ws, data);
                }
                catch (err) {
                    console.error("HMR message error", err);
                }
            },
            onClose(_ev, ws) {
                hotReloader.unregisterClient(ws);
            },
            onError(err) {
                console.error("HMR WebSocket error", err);
            },
        })));
        const proxyRules = (_e = (_d = bundleOptions.config) === null || _d === void 0 ? void 0 : _d.devServer) === null || _e === void 0 ? void 0 : _e.proxy;
        if (proxyRules && proxyRules.length > 0) {
            app.use("*", (0, proxyHono_1.createHttpProxyMiddleware)(proxyRules));
        }
        if ((_g = (_f = bundleOptions.config) === null || _f === void 0 ? void 0 : _f.devServer) === null || _g === void 0 ? void 0 : _g.lazyDynamicImports) {
            // Requesting the manifest chunk of a lazily compiled dynamic import is what
            // activates it, so rebuild the owning entrypoints before serveStatic reads it.
            app.use("/*", async (c, next) => {
                if ((c.req.method === "GET" || c.req.method === "HEAD") &&
                    c.req.path.includes("lazy-compilation-")) {
                    const chunkPath = decodeURIComponent(stripPublicPathPrefix(c.req.path)).replace(/^\/+/, "");
                    try {
                        if (await hotReloader.activateLazyChunk(chunkPath)) {
                            // The activated manifest has different content, so a content-hashed
                            // chunk filename puts it under a new name while the browser keeps
                            // requesting the URL baked into the entry. Serve the newest file
                            // with the same stem for that URL.
                            const current = await latestChunkWithSameStem(distRoot, chunkPath);
                            if (current && current !== chunkPath) {
                                lazyChunkAliases.set(chunkPath, current);
                            }
                        }
                    }
                    catch (err) {
                        console.error(err);
                    }
                }
                await next();
            });
        }
        // GET handles HEAD automatically in Hono; serveStatic serves both
        app.get("/*", (0, serve_static_1.serveStatic)({
            root: distRoot,
            rewriteRequestPath,
        }));
        // Framework integrations keep their own routing unless they explicitly opt in.
        if ((serverOptions === null || serverOptions === void 0 ? void 0 : serverOptions.historyApiFallback) === true) {
            const serveIndex = (0, serve_static_1.serveStatic)({ root: distRoot, path: "index.html" });
            app.get("/*", (c, next) => {
                var _a, _b, _d;
                let pathname;
                try {
                    pathname = decodeURIComponent(c.req.path);
                }
                catch (_e) {
                    return next();
                }
                if (pathname === HMR_PATH ||
                    path_1.default.posix.basename(pathname).includes(".")) {
                    return next();
                }
                // Both the SPA shell and the miss response depend on Accept.
                c.header("Vary", "Accept", { append: true });
                const acceptedTypes = (0, accept_1.parseAccept)((c.req.header("accept") || "*/*").toLowerCase());
                const htmlAccept = (_b = (_a = acceptedTypes.find(({ type }) => type === "text/html")) !== null && _a !== void 0 ? _a : acceptedTypes.find(({ type }) => type === "text/*")) !== null && _b !== void 0 ? _b : acceptedTypes.find(({ type }) => type === "*/*");
                if (!(htmlAccept === null || htmlAccept === void 0 ? void 0 : htmlAccept.q) || ((_d = acceptedTypes[0]) === null || _d === void 0 ? void 0 : _d.type) === "application/json") {
                    return next();
                }
                return serveIndex(c, next);
            });
        }
        app.all("*", (c) => {
            if (c.req.method === "GET" || c.req.method === "HEAD") {
                return c.notFound();
            }
            return c.body(null, 405, { Allow: "GET, HEAD" });
        });
        server = (0, node_server_1.serve)({
            ...serveOptsBase,
            fetch: app.fetch,
        });
        injectWebSocket(server);
        const httpServer = server;
        if (!httpServer.listening) {
            await new Promise((resolve, reject) => {
                const onListening = () => {
                    httpServer.off("error", onError);
                    resolve();
                };
                const onError = (error) => {
                    httpServer.off("listening", onListening);
                    reject(error);
                };
                httpServer.once("listening", onListening);
                httpServer.once("error", onError);
            });
        }
        await ((_h = serverOptions === null || serverOptions === void 0 ? void 0 : serverOptions.onReady) === null || _h === void 0 ? void 0 : _h.call(serverOptions, {
            port: serveOptsBase.port,
            hostname: serveOptsBase.hostname,
            clientPaths: hotReloader.getClientPaths(),
        }));
        if ((serverOptions === null || serverOptions === void 0 ? void 0 : serverOptions.logServerInfo) !== false) {
            const scheme = serveOptsBase.serverOptions ? "https" : "http";
            const displayHost = serveOptsBase.hostname === "0.0.0.0"
                ? "localhost"
                : serveOptsBase.hostname;
            (0, printServerInfo_1.printServerInfo)(scheme, displayHost, serveOptsBase.port);
        }
        if ((serverOptions === null || serverOptions === void 0 ? void 0 : serverOptions.handleSignals) !== false) {
            process.on("SIGINT", onSignal);
            process.on("SIGTERM", onSignal);
            process.on("rejectionHandled", rejectionHandled);
            process.on("uncaughtException", exception);
            process.on("unhandledRejection", exception);
        }
        return handle;
    }
    catch (error) {
        try {
            await handle.close();
        }
        catch (closeError) {
            throw new AggregateError([error, closeError], "Failed to start and close the dev server");
        }
        throw error;
    }
}
