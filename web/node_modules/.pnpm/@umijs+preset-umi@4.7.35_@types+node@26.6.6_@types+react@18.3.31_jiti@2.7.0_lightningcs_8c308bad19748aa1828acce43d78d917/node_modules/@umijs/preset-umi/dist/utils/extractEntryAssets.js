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

// src/utils/extractEntryAssets.ts
var extractEntryAssets_exports = {};
__export(extractEntryAssets_exports, {
  extractEntryAssets: () => extractEntryAssets,
  extractEntryPointFilesFromStats: () => extractEntryPointFilesFromStats,
  extractUtooEntryAssets: () => extractUtooEntryAssets,
  getUmiEntryFilesFromStats: () => getUmiEntryFilesFromStats
});
module.exports = __toCommonJS(extractEntryAssets_exports);
var UMI_ASSETS_REG = {
  js: /(?:^|[/\\])umi(\.[^/\\]+)?\.js$/,
  css: /(?:^|[/\\])umi(\.[^/\\]+)?\.css$/
};
function isUmiEntryFile(file) {
  return !file.includes(".hot-update") && (UMI_ASSETS_REG.js.test(file) || UMI_ASSETS_REG.css.test(file));
}
function getAssetName(asset) {
  return typeof asset === "string" ? asset : asset == null ? void 0 : asset.name;
}
function extractEntryPointFilesFromStats(stats, entryName = "umi") {
  var _a;
  const statsJson = (stats == null ? void 0 : stats.toJson) ? stats.toJson() : stats || {};
  const entrypoint = (_a = statsJson.entrypoints) == null ? void 0 : _a[entryName];
  const files = /* @__PURE__ */ new Set();
  for (const asset of (entrypoint == null ? void 0 : entrypoint.assets) || []) {
    const name = getAssetName(asset);
    if (name) {
      files.add(name);
    }
  }
  for (const chunkId of (entrypoint == null ? void 0 : entrypoint.chunks) || []) {
    const chunk = (statsJson.chunks || []).find((item) => {
      var _a2, _b;
      return (item == null ? void 0 : item.id) === chunkId || ((_b = (_a2 = item == null ? void 0 : item.names) == null ? void 0 : _a2.includes) == null ? void 0 : _b.call(_a2, chunkId));
    });
    for (const file of (chunk == null ? void 0 : chunk.files) || []) {
      if (file) {
        files.add(file);
      }
    }
  }
  return Array.from(files);
}
function getUmiEntryFilesFromStats(stats) {
  var _a, _b;
  const realStats = stats.stats ? stats.stats[0] : stats;
  const compilation = realStats.compilation;
  const entrypoints = compilation == null ? void 0 : compilation.entrypoints;
  let files;
  if (typeof (entrypoints == null ? void 0 : entrypoints.get) === "function") {
    const entrypoint = entrypoints.get("umi");
    const entryChunk = (_a = entrypoint == null ? void 0 : entrypoint.getEntrypointChunk) == null ? void 0 : _a.call(entrypoint);
    if (entryChunk == null ? void 0 : entryChunk.files) {
      return Array.from(entryChunk.files).filter(isUmiEntryFile);
    }
    files = ((_b = entrypoint == null ? void 0 : entrypoint.getFiles) == null ? void 0 : _b.call(entrypoint)) || [];
  } else {
    const statsJson = entrypoints ? compilation : realStats;
    files = statsJson.entrypoints ? extractEntryPointFilesFromStats(statsJson) : Object.keys((compilation == null ? void 0 : compilation.assets) || {});
  }
  return Object.values(UMI_ASSETS_REG).flatMap((regexp) => {
    const candidates = files.filter(
      (file) => isUmiEntryFile(file) && regexp.test(file)
    );
    const flat = candidates.filter((file) => !/[/\\]/.test(file));
    return flat.length ? flat : candidates.length === 1 ? candidates : [];
  });
}
function extractEntryAssets(entryPointFiles, umiEntryFiles = entryPointFiles.filter(isUmiEntryFile)) {
  const assets = {
    // Will contain all js and mjs files
    js: [],
    // Will contain all css files
    css: []
  };
  const entryPointPublicPathMap = {};
  const extensionRegexp = /\.(css|js|mjs)(\?|$)/;
  const umiEntryFileSet = new Set(umiEntryFiles);
  entryPointFiles.forEach((entryPointPublicPath) => {
    const extMatch = extensionRegexp.exec(entryPointPublicPath);
    if (!extMatch) {
      return;
    }
    if (entryPointPublicPath.includes(".hot-update")) {
      return;
    }
    if (entryPointPublicPathMap[entryPointPublicPath]) {
      return;
    }
    if (umiEntryFileSet.has(entryPointPublicPath)) {
      return;
    }
    entryPointPublicPathMap[entryPointPublicPath] = true;
    const ext = extMatch[1] === "mjs" ? "js" : extMatch[1];
    assets[ext].push(entryPointPublicPath);
  });
  return assets;
}
function extractUtooEntryAssets(entryPointFiles) {
  const assets = {
    js: [],
    css: []
  };
  const UMI_CSS_REG = /^umi(\..+)?\.css$/;
  const cssPublicPathMap = {};
  const cssExtensionRegexp = /\.(css)(\?|$)/;
  entryPointFiles.forEach((entryPointPublicPath) => {
    if (!cssExtensionRegexp.test(entryPointPublicPath)) {
      return;
    }
    if (UMI_CSS_REG.test(entryPointPublicPath)) {
      return;
    }
    if (cssPublicPathMap[entryPointPublicPath]) {
      return;
    }
    cssPublicPathMap[entryPointPublicPath] = true;
    assets.css.push(entryPointPublicPath);
  });
  return assets;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  extractEntryAssets,
  extractEntryPointFilesFromStats,
  extractUtooEntryAssets,
  getUmiEntryFilesFromStats
});
