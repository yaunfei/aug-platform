var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/server/plugins/middlewares.ts
var middlewares_exports = {};
__export(middlewares_exports, {
  default: () => middlewaresPlugin
});
module.exports = __toCommonJS(middlewares_exports);
var originalUrlKey = Symbol("bundler-vite:original-url");
function resolveMiddleware(middleware) {
  const resolved = middleware.toString().includes("{ compiler }") ? middleware({}) : middleware;
  return Array.isArray(resolved) ? resolved : [resolved];
}
function stripBase(url, base) {
  if (base === "/") {
    return url;
  }
  const basePath = new URL(base, "http://vite.local").pathname.replace(
    /\/$/,
    ""
  );
  const pathname = url.split("?")[0];
  if (pathname === basePath || pathname.startsWith(`${basePath}/`)) {
    return url.slice(basePath.length) || "/";
  }
  return url;
}
function captureOriginalUrl(base) {
  return function bundlerViteCaptureOriginalUrl(req, _res, next) {
    req[originalUrlKey] = stripBase(req.url, base);
    next();
  };
}
function preserveOriginalUrl(middleware) {
  return function bundlerViteAfterMiddleware(req, res, next) {
    const viteUrl = req.url;
    req.url = req[originalUrlKey] ?? req.url;
    middleware(req, res, (err) => {
      req.url = viteUrl;
      next(err);
    });
  };
}
function middlewaresPlugin(middlewares) {
  return {
    name: "bundler-vite:middlewares",
    enforce: "pre",
    configureServer(server) {
      server.middlewares.use(captureOriginalUrl(server.config.base));
      return () => {
        middlewares.flatMap(resolveMiddleware).forEach((middleware) => {
          server.middlewares.use(preserveOriginalUrl(middleware));
        });
      };
    }
  };
}
