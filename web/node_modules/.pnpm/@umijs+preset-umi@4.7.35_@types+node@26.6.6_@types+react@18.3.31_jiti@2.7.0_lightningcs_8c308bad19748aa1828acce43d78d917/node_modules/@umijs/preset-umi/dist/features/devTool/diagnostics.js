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

// src/features/devTool/diagnostics.ts
var diagnostics_exports = {};
__export(diagnostics_exports, {
  getDiagnosticAppData: () => getDiagnosticAppData,
  getDiagnosticConfig: () => getDiagnosticConfig
});
module.exports = __toCommonJS(diagnostics_exports);
var import_path = require("path");
function getDiagnosticConfig(config) {
  var _a;
  const history = (_a = config.history) == null ? void 0 : _a.type;
  return {
    hash: typeof config.hash === "boolean" ? config.hash : void 0,
    history: history === "browser" || history === "hash" || history === "memory" ? { type: history } : void 0,
    mfsu: config.mfsu === void 0 ? void 0 : Boolean(config.mfsu),
    ssr: config.ssr === void 0 ? void 0 : Boolean(config.ssr),
    vite: config.vite === void 0 ? void 0 : Boolean(config.vite),
    utoopack: config.utoopack === void 0 ? void 0 : Boolean(config.utoopack)
  };
}
function getDiagnosticAppData(api) {
  var _a, _b, _c, _d, _e;
  const data = api.appData;
  const summary = {
    bundler: typeof data.bundler === "string" ? data.bundler : void 0,
    framework: typeof data.framework === "string" ? data.framework : void 0,
    umi: {
      version: typeof ((_a = data.umi) == null ? void 0 : _a.version) === "string" ? data.umi.version : void 0
    },
    bundleStatus: { done: Boolean((_b = data.bundleStatus) == null ? void 0 : _b.done) }
  };
  if (!api.userConfig.ui) {
    return summary;
  }
  const routes = data.routes ?? {};
  const plugins = data.plugins ?? {};
  const modules = ((_c = data.ui) == null ? void 0 : _c.modules) ?? [];
  return {
    ...summary,
    userConfig: getDiagnosticConfig(api.userConfig),
    config: getDiagnosticConfig(api.config),
    routes: Object.fromEntries(
      Object.entries(routes).map(([id, route]) => [
        id,
        {
          id: route.id,
          parentId: route.parentId,
          name: typeof route.name === "string" ? route.name : void 0,
          path: route.path,
          absPath: route.absPath,
          redirect: isDiagnosticWebUrl(route.redirect) ? route.redirect.split(/[?#]/, 1)[0] : void 0,
          isLayout: Boolean(route.isLayout),
          file: projectPath(api.cwd, route.__absFile ?? route.file)
        }
      ])
    ),
    plugins: Object.fromEntries(
      Object.entries(plugins).map(([id, plugin], index) => [
        (0, import_path.isAbsolute)(id) ? `local-plugin-${index}` : id,
        {
          key: plugin.key,
          time: {
            register: plugin.time.register ?? 0,
            hooks: Object.fromEntries(
              Object.entries(plugin.time.hooks).map(([name, times]) => [
                name,
                times.filter(Number.isFinite)
              ])
            )
          }
        }
      ])
    ),
    prepare: {
      buildResult: {
        metafile: getImportGraph(api.cwd, (_e = (_d = data.prepare) == null ? void 0 : _d.buildResult) == null ? void 0 : _e.metafile)
      }
    },
    ui: {
      modules: modules.map((module2) => {
        var _a2;
        return {
          name: module2.name,
          menus: (_a2 = module2.menus) == null ? void 0 : _a2.flatMap(({ path, name, icon, url }) => {
            return isDiagnosticWebUrl(url) ? [{ path, name, icon, url }] : [];
          })
        };
      })
    }
  };
}
function projectPath(cwd, file) {
  if (!file)
    return;
  const fromProject = (0, import_path.relative)(cwd, (0, import_path.resolve)(cwd, file));
  if ((0, import_path.isAbsolute)(fromProject))
    return;
  const path = fromProject.split(import_path.sep).join("/");
  if (path && path !== ".." && !path.startsWith("../") && !/[:?#\\]/.test(path)) {
    return path;
  }
}
function getImportGraph(cwd, metafile) {
  if (!metafile)
    return;
  const externalPaths = /* @__PURE__ */ new Map();
  const getImportPath = (file) => {
    const localPath = projectPath(cwd, file);
    if (localPath)
      return localPath;
    const absolutePath = (0, import_path.resolve)(cwd, file);
    const existingPath = externalPaths.get(absolutePath);
    if (existingPath)
      return existingPath;
    const prefix = absolutePath.split(import_path.sep).includes("node_modules") ? "node_modules/" : "";
    const name = (0, import_path.basename)(absolutePath);
    const label = /^[\w.@-]+$/.test(name) ? name : "module";
    const path = `${prefix}external:${externalPaths.size + 1}/${label}`;
    externalPaths.set(absolutePath, path);
    return path;
  };
  return {
    inputs: Object.fromEntries(
      Object.entries(metafile.inputs).map(([file, input]) => [
        getImportPath(file),
        {
          imports: input.imports.map(({ path }) => ({
            path: getImportPath(path)
          }))
        }
      ])
    )
  };
}
function isDiagnosticWebUrl(url) {
  if (typeof url !== "string" || !url)
    return false;
  try {
    const target = new URL(url, "http://localhost");
    return (target.protocol === "http:" || target.protocol === "https:") && !target.username && !target.password;
  } catch {
    return false;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  getDiagnosticAppData,
  getDiagnosticConfig
});
