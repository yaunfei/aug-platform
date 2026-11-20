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

// src/features/devTool/devTool.ts
var devTool_exports = {};
__export(devTool_exports, {
  default: () => devTool_default,
  resolveDevToolFile: () => resolveDevToolFile
});
module.exports = __toCommonJS(devTool_exports);
var import_utils = require("@umijs/utils");
var import_fs = require("fs");
var import_path = require("path");
var import_diagnostics = require("./diagnostics");
var devToolAppDist = (0, import_path.join)(__dirname, "../../../devToolAppDist");
var assetsDir = (0, import_path.join)(__dirname, "../../../assets");
var devTool_default = (api) => {
  api.addBeforeMiddlewares(async () => {
    const $ = await api.applyPlugins({
      key: "modifyDevToolLoadingHTML",
      type: api.ApplyPluginsType.modify,
      initialValue: import_utils.cheerio.load(
        (0, import_fs.readFileSync)((0, import_path.join)(assetsDir, "bundle-status.html"), "utf-8")
      )
    });
    const loadingHtml = $.html();
    return [
      (req, res, next) => {
        var _a, _b, _c;
        const { path } = req;
        const enableVite = api.appData.vite;
        if (path.startsWith("/__umi/api/")) {
          const shortPath = path.replace("/__umi/api/", "");
          if (shortPath === "config") {
            return res.json((0, import_diagnostics.getDiagnosticConfig)(api.config));
          }
          if (shortPath === "app-data") {
            return res.json((0, import_diagnostics.getDiagnosticAppData)(api));
          }
          if (shortPath === "bundle-status") {
            const isMFSUEnable = api.config.mfsu !== false;
            return res.json({
              bundler: api.appData.bundler,
              bundleStatus: api.appData.bundleStatus,
              ...isMFSUEnable && !enableVite ? {
                mfsuBundleStatus: api.appData.mfsuBundleStatus
              } : {}
            });
          }
          if (shortPath === "status") {
            const isBundleDone = (_a = api.appData.bundleStatus) == null ? void 0 : _a.done;
            if (enableVite && isBundleDone) {
              return res.end();
            }
            const isMFSUDone = api.config.mfsu ? (_b = api.appData.mfsuBundleStatus) == null ? void 0 : _b.done : true;
            if (isMFSUDone && isBundleDone) {
              return res.end();
            }
            return res.status(400).end();
          }
          return next();
        }
        if (!process.env.DEVTOOL_LOCAL && path.startsWith("/__umi/")) {
          const shortPath = path.replace("/__umi/", "");
          const file = resolveDevToolFile(devToolAppDist, shortPath);
          if (file === null) {
            return res.status(403).end();
          }
          if (!file) {
            return res.status(404).end();
          }
          return res.sendFile(file.path, { root: file.root });
        }
        if (((_c = req.headers.accept) == null ? void 0 : _c.includes("text/html")) || req.headers.accept === "*/*") {
          const isDone = api.appData.bundleStatus.done && (enableVite || api.config.mfsu === false || api.appData.mfsuBundleStatus.done);
          if (!isDone) {
            res.setHeader("Content-Type", "text/html");
            res.send(loadingHtml);
            return;
          }
        }
        return next();
      }
    ];
  });
};
function isOutsideRoot(relativePath) {
  return relativePath === ".." || relativePath.startsWith(`..${import_path.sep}`) || (0, import_path.isAbsolute)(relativePath);
}
function realpathIfPresent(file) {
  try {
    return (0, import_fs.realpathSync)(file);
  } catch (err) {
    const { code } = err;
    if (code !== "ENOENT" && code !== "ENOTDIR") {
      throw err;
    }
  }
}
function resolveDevToolFile(root, file) {
  const requestedPath = (0, import_path.relative)(root, (0, import_path.join)(root, file || "index.html"));
  if (isOutsideRoot(requestedPath)) {
    return null;
  }
  const realRoot = realpathIfPresent(root);
  if (!realRoot) {
    return;
  }
  const realFile = realpathIfPresent((0, import_path.join)(realRoot, requestedPath)) ?? realpathIfPresent((0, import_path.join)(realRoot, "index.html"));
  if (!realFile) {
    return;
  }
  const realRelativePath = (0, import_path.relative)(realRoot, realFile);
  if (isOutsideRoot(realRelativePath)) {
    return null;
  }
  return { path: realRelativePath || ".", root: realRoot };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  resolveDevToolFile
});
