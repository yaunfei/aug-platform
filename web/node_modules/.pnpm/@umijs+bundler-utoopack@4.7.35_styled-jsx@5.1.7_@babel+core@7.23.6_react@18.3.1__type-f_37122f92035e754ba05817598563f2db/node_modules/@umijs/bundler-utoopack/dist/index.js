var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __reExport = (target, mod, secondTarget) => (__copyProps(target, mod, "default"), secondTarget && __copyProps(secondTarget, mod, "default"));
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  analyze: () => import_analyze.analyze,
  build: () => build,
  buildSSR: () => buildSSR,
  createDevStatsFromClientPaths: () => createDevStatsFromClientPaths,
  dev: () => dev,
  findRootDir: () => import_pack.findRootDir,
  isUtoopackProxyStartupError: () => isUtoopackProxyStartupError,
  serveAnalyzeReport: () => import_analyze.serveAnalyzeReport
});
module.exports = __toCommonJS(src_exports);
var import_bundler_utils = require("@umijs/bundler-utils");
var import_express = __toESM(require("@umijs/bundler-utils/compiled/express"));
var import_http_proxy_middleware = require("@umijs/bundler-utils/compiled/http-proxy-middleware");
var import_utils = require("@umijs/utils");
var import_fs = __toESM(require("fs"));
var import_http = __toESM(require("http"));
var import_path = __toESM(require("path"));
var import_config = require("./config");
var import_util = require("./util");
var import_pack = require("@utoo/pack");
var import_analyze = require("./analyze");
__reExport(src_exports, require("./config"), module.exports);
function isUtoopackProxyStartupError(error, utooServePort) {
  return (error == null ? void 0 : error.code) === "ECONNREFUSED" && Number(error == null ? void 0 : error.port) === utooServePort && (!(error == null ? void 0 : error.address) || error.address === "127.0.0.1");
}
function addStatsCompatibility(stats) {
  stats.hasErrors = () => false;
  stats.toJson = () => stats;
  stats.toString = () => {
  };
  stats.compilation = {
    ...stats,
    assets: (stats.assets || []).reduce(
      (acc, cur) => Object.assign(acc, { [cur.name]: cur }),
      {}
    )
  };
  return stats;
}
function createDevStatsFromClientPaths(clientPaths, entryNames) {
  const assets = Array.from(new Set(clientPaths ?? [])).map((name) => ({
    name
  }));
  return addStatsCompatibility({
    assets,
    chunks: [],
    modules: [],
    entrypoints: Object.fromEntries(
      entryNames.map((entryName) => [entryName, { assets, chunks: [] }])
    )
  });
}
async function build(opts) {
  var _a, _b, _c;
  const { cwd, onBuildComplete } = opts;
  const normalizedCwd = (0, import_config.normalizeUtoopackPath)(cwd);
  const buildStartTime = Date.now();
  const { build: utooPackBuild, findRootDir: findRootDir2 } = require("@utoo/pack");
  const rootDir = (0, import_config.getUtoopackRootDir)(
    normalizedCwd,
    opts.config.utoopack,
    findRootDir2
  );
  const utooPackConfig = await (0, import_config.getProdUtooPackConfig)({
    ...opts,
    cwd: normalizedCwd,
    rootDir
  });
  try {
    await utooPackBuild(utooPackConfig, normalizedCwd, rootDir);
  } catch (e) {
    console.error(e.message);
    const err = new Error("Build with utoopack failed.");
    err.stack = null;
    throw err;
  }
  const statsPath = import_path.default.join(
    ((_a = utooPackConfig.config.output) == null ? void 0 : _a.path) || "dist",
    "stats.json"
  );
  const stats = JSON.parse(import_fs.default.readFileSync(statsPath, "utf-8"));
  stats.hasErrors = () => false;
  stats.toJson = () => stats;
  stats.toString = () => {
  };
  stats.compilation = {
    ...stats,
    assets: stats.assets.reduce(
      (acc, cur) => Object.assign(acc, { [cur.name]: cur }),
      {}
    )
  };
  const time = Date.now() - buildStartTime;
  await (onBuildComplete == null ? void 0 : onBuildComplete({
    stats,
    time,
    isFirstCompile: true
  }));
  const absOutputPath = import_path.default.resolve(
    normalizedCwd,
    ((_b = utooPackConfig.config.output) == null ? void 0 : _b.path) || "dist"
  );
  console.log(
    (0, import_util.getBuildBanner)({
      packVersion: process.env.UTOOPACK_VERSION,
      duration: time,
      outputPath: import_path.default.relative(normalizedCwd, absOutputPath) || ".",
      assetCount: (_c = stats.assets) == null ? void 0 : _c.length
    })
  );
  return stats;
}
async function buildSSR(opts) {
  var _a;
  const { cwd } = opts;
  const normalizedCwd = (0, import_config.normalizeUtoopackPath)(cwd);
  const buildStartTime = Date.now();
  const { build: utooPackBuild, findRootDir: findRootDir2 } = require("@utoo/pack");
  const rootDir = (0, import_config.getUtoopackRootDir)(
    normalizedCwd,
    opts.config.utoopack,
    findRootDir2
  );
  const utooPackConfig = await (0, import_config.getSSRUtooPackConfig)({
    ...opts,
    cwd: normalizedCwd,
    rootDir
  });
  try {
    await utooPackBuild(utooPackConfig, normalizedCwd, rootDir);
  } catch (e) {
    console.error(e.message);
    const err = new Error("Build SSR with utoopack failed.");
    err.stack = null;
    throw err;
  }
  const statsPath = import_path.default.join(
    ((_a = utooPackConfig.config.output) == null ? void 0 : _a.path) || "server",
    "stats.json"
  );
  const stats = JSON.parse(import_fs.default.readFileSync(statsPath, "utf-8"));
  stats.hasErrors = () => false;
  stats.toJson = () => stats;
  stats.toString = () => {
  };
  stats.compilation = {
    ...stats,
    assets: stats.assets.reduce(
      (acc, cur) => Object.assign(acc, { [cur.name]: cur }),
      {}
    )
  };
  const time = Date.now() - buildStartTime;
  stats.time = time;
  return stats;
}
async function dev(opts) {
  var _a;
  const { cwd, onDevCompileDone } = opts;
  const normalizedCwd = (0, import_config.normalizeUtoopackPath)(cwd);
  if (!opts) {
    throw new Error("opts should be supplied");
  }
  const devStartTime = Date.now();
  const protocol = opts.config.https ? "https:" : "http:";
  const { findRootDir: findRootDir2, serve: utooPackServe } = require("@utoo/pack");
  const rootDir = (0, import_config.getUtoopackRootDir)(
    normalizedCwd,
    opts.config.utoopack,
    findRootDir2
  );
  const utooPackConfig = await (0, import_config.getDevUtooPackConfig)({
    ...opts,
    cwd: normalizedCwd,
    rootDir
  });
  const app = (0, import_express.default)();
  const cors = require("cors");
  const proxy = require("express-http-proxy");
  const port = opts.port || 8e3;
  let utooServePort;
  const getUtooServeTarget = () => `http://127.0.0.1:${utooServePort}`;
  const respondWhileStarting = (res) => res.status(503).type("text").send("Utoopack dev server is starting.");
  app.use(
    cors({
      origin: true,
      methods: ["GET", "HEAD", "PUT", "POST", "PATCH", "DELETE", "OPTIONS"],
      credentials: true
    })
  );
  app.use(require("compression")());
  if (opts.onBeforeMiddleware) {
    opts.onBeforeMiddleware(app);
  }
  (opts.beforeMiddlewares || []).forEach((m) => app.use(m));
  const wsProxy = (0, import_http_proxy_middleware.createProxyMiddleware)("/turbopack-hmr", {
    router: getUtooServeTarget,
    // upgrades are handled by server.on('upgrade') below
    ws: false,
    logLevel: "silent"
  });
  app.use(
    "/turbopack-hmr",
    (req, res, next) => utooServePort === void 0 ? respondWhileStarting(res) : wsProxy(req, res, next)
  );
  if (opts.config.proxy) {
    (0, import_bundler_utils.createProxy)(opts.config.proxy, app);
  }
  const publicPathPrefix = (() => {
    const p = opts.config.publicPath;
    if (!p || p === "/" || p === "auto")
      return null;
    return p.startsWith("/") ? p : "/" + p;
  })();
  app.use(
    (req, res, next) => utooServePort === void 0 && ["GET", "HEAD"].includes(req.method) ? respondWhileStarting(res) : next()
  );
  app.use(
    proxy(getUtooServeTarget, {
      memoizeHost: false,
      proxyReqPathResolver: function(req) {
        if (publicPathPrefix && req.url.startsWith(publicPathPrefix)) {
          const stripped = req.url.slice(publicPathPrefix.length - 1);
          return stripped || "/";
        }
        return req.url;
      },
      proxyReqOptDecorator: function(proxyReqOpts) {
        proxyReqOpts.agent = false;
        return proxyReqOpts;
      },
      filter: function(req, _res) {
        return req.method == "GET" || req.method == "HEAD";
      },
      skipToNextHandlerFilter: function(proxyRes) {
        return proxyRes.statusCode !== 200 && proxyRes.statusCode !== 304;
      },
      proxyErrorHandler: function(err, res, next) {
        if (isUtoopackProxyStartupError(err, utooServePort)) {
          if (!res.headersSent) {
            res.writeHead(503, { "Content-Type": "text/plain" });
          }
          return res.end("Utoopack dev server is starting.");
        }
        if ((err == null ? void 0 : err.code) === "ECONNRESET") {
          res.setHeader(
            "X-Timeout-Reason",
            "express-http-proxy reset the request."
          );
          res.writeHead(504, { "Content-Type": "text/plain" });
          return res.end();
        }
        return next(err);
      }
    })
  );
  (opts.afterMiddlewares || []).forEach((m) => {
    if (m.toString().includes("{ compiler }")) {
      app.use(m({}));
    } else {
      app.use(m);
    }
  });
  app.use(
    require("connect-history-api-fallback")({
      index: "/"
    })
  );
  let server;
  const httpsOpts = opts.config.https;
  if (httpsOpts) {
    httpsOpts.hosts || (httpsOpts.hosts = import_utils.lodash.uniq(
      [
        ...httpsOpts.hosts || [],
        // always add localhost, 127.0.0.1, ip and host
        "127.0.0.1",
        "localhost",
        opts.ip,
        opts.host !== "0.0.0.0" && opts.host
      ].filter(Boolean)
    ));
    server = await (0, import_bundler_utils.createHttpsServer)(app, httpsOpts);
  } else {
    server = import_http.default.createServer(app);
  }
  const sockets = /* @__PURE__ */ new Set();
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });
  const serverReady = new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => {
      server.off("error", reject);
      resolve();
    });
  });
  if (wsProxy.upgrade) {
    const upgrade = wsProxy.upgrade;
    const handleUpgrade = (req, socket, head) => {
      var _a2;
      if (!((_a2 = req.url) == null ? void 0 : _a2.startsWith("/turbopack-hmr")))
        return;
      if (utooServePort === void 0) {
        return socket.end("HTTP/1.1 503 Service Unavailable\r\n\r\n");
      }
      upgrade(req, socket, head);
    };
    server.on("upgrade", handleUpgrade);
  }
  const createStatsObject = () => {
    var _a2;
    let stats2;
    const statsPath = import_path.default.join(
      ((_a2 = utooPackConfig.config.output) == null ? void 0 : _a2.path) || "dist",
      "stats.json"
    );
    try {
      stats2 = JSON.parse(import_fs.default.readFileSync(statsPath, "utf-8"));
    } catch (e) {
      throw new Error(
        `File stats.json not found by utoopack dev at ${statsPath}: ${e.message}`
      );
    }
    return addStatsCompatibility(stats2);
  };
  let clientPaths;
  let stats;
  let hasPublishedClientBuild = false;
  let canPublishClientBuild = false;
  let clientBuildQueue = Promise.resolve();
  const shouldReadFullStats = Boolean(process.env.ANALYZE) || Boolean(utooPackConfig.config.stats);
  const publishClientBuild = (paths) => {
    const pathsSnapshot = [...paths ?? []];
    const task = clientBuildQueue.then(async () => {
      const isFirstCompile = !hasPublishedClientBuild;
      stats = shouldReadFullStats ? createStatsObject() : createDevStatsFromClientPaths(pathsSnapshot, Object.keys(opts.entry));
      hasPublishedClientBuild = true;
      await (onDevCompileDone == null ? void 0 : onDevCompileDone({
        stats,
        // The pack callback does not expose rebuild duration.
        time: isFirstCompile ? Date.now() - devStartTime : 0,
        isFirstCompile
      }));
    });
    clientBuildQueue = task.then(
      () => {
      },
      () => {
      }
    );
    return task;
  };
  const servePromise = Promise.resolve().then(
    () => utooPackServe(utooPackConfig, normalizedCwd, rootDir, {
      port: port + 1,
      hostname: "127.0.0.1",
      logServerInfo: false,
      returnHandle: true,
      // Umi owns shutdown when it registers the returned close callback.
      ...opts.onDevServerReady ? { handleSignals: false } : {},
      onClientBuild(context) {
        clientPaths = context.clientPaths;
        if (canPublishClientBuild) {
          return publishClientBuild(clientPaths);
        }
      },
      onReady(context) {
        utooServePort = context.port;
        clientPaths ?? (clientPaths = context.clientPaths ?? []);
      }
    })
  );
  const exception = (error) => console.error(error);
  const rejectionHandled = () => {
  };
  let closePromise;
  const close = () => {
    closePromise || (closePromise = (async () => {
      process.off("uncaughtException", exception);
      process.off("unhandledRejection", exception);
      process.off("rejectionHandled", rejectionHandled);
      const results = await Promise.allSettled([
        (async () => {
          await serverReady.catch(() => {
          });
          await new Promise((resolve, reject) => {
            server.close((error) => {
              if (error && error.code !== "ERR_SERVER_NOT_RUNNING") {
                reject(error);
              } else {
                resolve();
              }
            });
            sockets.forEach((socket) => socket.destroy());
          });
        })(),
        (async () => {
          const handle = await servePromise.catch(() => void 0);
          await (handle == null ? void 0 : handle.close());
        })()
      ]);
      const failed = results.find((result) => result.status === "rejected");
      if (failed)
        throw failed.reason;
    })());
    return closePromise;
  };
  try {
    await Promise.all([serverReady, servePromise]);
    if (opts.onDevServerReady) {
      process.on("uncaughtException", exception);
      process.on("unhandledRejection", exception);
      process.on("rejectionHandled", rejectionHandled);
    }
    (_a = opts.onDevServerReady) == null ? void 0 : _a.call(opts, { close });
    const initialClientBuild = publishClientBuild(clientPaths);
    canPublishClientBuild = true;
    await initialClientBuild;
    const time = Date.now() - devStartTime;
    console.log(
      (0, import_util.getDevBanner)({
        protocol,
        host: opts.host,
        port,
        ip: opts.ip,
        packVersion: process.env.UTOOPACK_VERSION,
        duration: time
      })
    );
    return stats;
  } catch (e) {
    try {
      await close();
    } catch (closeError) {
      console.error(closeError.message);
    }
    console.error(e.message);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  analyze,
  build,
  buildSSR,
  createDevStatsFromClientPaths,
  dev,
  findRootDir,
  isUtoopackProxyStartupError,
  serveAnalyzeReport,
  ...require("./config")
});
