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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/server/server.ts
var server_exports = {};
__export(server_exports, {
  createServer: () => createServer
});
module.exports = __toCommonJS(server_exports);
var import_bundler_utils = require("@umijs/bundler-utils");
var import_express = __toESM(require("@umijs/bundler-utils/compiled/express"));
var import_utils = require("@umijs/utils");
var import_http = __toESM(require("http"));
var import_vite = require("../../compiled/vite");
var import_middlewares = __toESM(require("./plugins/middlewares"));
var import_onHotUpdate = __toESM(require("./plugins/onHotUpdate"));
async function createServer(opts) {
  var _a, _b;
  const startTms = +/* @__PURE__ */ new Date();
  const { viteConfig, userConfig, onDevCompileDone } = opts;
  const app = (0, import_express.default)();
  const viteConfigServer = { ...viteConfig.server };
  if (userConfig.https) {
    const httpsConfig = await (0, import_bundler_utils.resolveHttpsConfig)(userConfig.https);
    if (httpsConfig) {
      userConfig.https = viteConfigServer.https = {
        key: httpsConfig.key,
        cert: httpsConfig.cert
      };
    }
  }
  const vite = await (0, import_vite.createServer)({
    ...viteConfig,
    plugins: [
      ...viteConfig.plugins || [],
      ...((_a = opts.afterMiddlewares) == null ? void 0 : _a.length) ? [(0, import_middlewares.default)(opts.afterMiddlewares)] : [],
      // use `handleHotUpdate` vite hook to workaround `onDevCompileDone` umi hook
      ...typeof onDevCompileDone === "function" ? [
        (0, import_onHotUpdate.default)(async (modules) => {
          await onDevCompileDone({
            time: 0,
            isFirstCompile: false,
            stats: modules
          });
        })
      ] : []
    ],
    server: { ...viteConfigServer, middlewareMode: true }
  });
  (_b = opts.beforeMiddlewares) == null ? void 0 : _b.forEach((m) => app.use(m));
  if (opts.onBeforeMiddleware) {
    opts.onBeforeMiddleware(app);
  }
  if (userConfig.proxy) {
    (0, import_bundler_utils.createProxy)(userConfig.proxy, app);
  }
  app.use(vite.middlewares);
  const server = userConfig.https ? await (0, import_bundler_utils.createHttpsServer)(app, userConfig.https) : import_http.default.createServer(app);
  if (!server) {
    return null;
  }
  const protocol = userConfig.https ? "https:" : "http:";
  const port = opts.port || 8e3;
  server.listen(port, async () => {
    var _a2;
    if (typeof onDevCompileDone === "function") {
      await onDevCompileDone({
        time: +/* @__PURE__ */ new Date() - startTms,
        isFirstCompile: true,
        stats: (_a2 = vite.environments.client.depsOptimizer) == null ? void 0 : _a2.metadata
      });
    }
    const banner = (0, import_utils.getDevBanner)(protocol, opts.host, port);
    console.log(banner.before);
    import_utils.logger.ready(banner.main);
    console.log(banner.after);
  });
  return server;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createServer
});
