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

// src/features/utoopack/utoopack.ts
var utoopack_exports = {};
__export(utoopack_exports, {
  default: () => utoopack_default,
  getPackVersionFromBundler: () => getPackVersionFromBundler,
  runBundleAnalyze: () => runBundleAnalyze
});
module.exports = __toCommonJS(utoopack_exports);
var import_utils = require("@umijs/utils");
var import_path = require("path");
var import_extractEntryAssets = require("../../utils/extractEntryAssets");
function cleanVersionRange(version) {
  return version == null ? void 0 : version.replace(/^[^\d]*/, "");
}
function getPackVersionFromBundler(bundlerEntry) {
  var _a;
  const resolvePaths = [(0, import_path.dirname)(bundlerEntry), bundlerEntry];
  for (const resolvePath of resolvePaths) {
    try {
      const pkgPath = require.resolve("@utoo/pack/package.json", {
        paths: [resolvePath]
      });
      const pkg = require(pkgPath);
      if (pkg.version) {
        return pkg.version;
      }
    } catch {
    }
  }
  const packageJsonCandidates = [
    (0, import_path.join)((0, import_path.dirname)(bundlerEntry), "../package.json"),
    (0, import_path.join)(bundlerEntry, "../package.json"),
    (0, import_path.join)(bundlerEntry, "package.json")
  ];
  for (const packageJsonPath of packageJsonCandidates) {
    try {
      const pkg = require(packageJsonPath);
      return cleanVersionRange((_a = pkg.dependencies) == null ? void 0 : _a["@utoo/pack"]);
    } catch {
    }
  }
  return void 0;
}
async function runBundleAnalyze(bundler, opts, logger, exportReport = false) {
  var _a;
  if (typeof bundler.analyze !== "function") {
    const message = "Utoopack analyze requires @umijs/bundler-utoopack with analyze support, please align @umijs/preset-umi and @umijs/bundler-utoopack versions";
    if (exportReport)
      throw new Error(message);
    logger.error(message);
    process.exit(1);
    return;
  }
  let server;
  let outputPath;
  try {
    logger.event("Bundle analyzing...");
    ({ outputPath } = await bundler.analyze(opts));
    logger.event(`Analyzer report written to ${outputPath}`);
    if (exportReport)
      return outputPath;
    if (!process.stdout.isTTY) {
      logger.ready(
        `Non-interactive terminal detected, skipping Analyzer UI server. Serve ${outputPath} with a static HTTP server and open its URL in a browser.`
      );
      return;
    }
    const port = (_a = process.env.ANALYZE_PORT) == null ? void 0 : _a.trim();
    const parsedPort = port ? Number(port) : NaN;
    server = await bundler.serveAnalyzeReport(
      outputPath,
      Number.isNaN(parsedPort) ? 8888 : parsedPort
    );
    logger.ready(`Bundle Analyzer available at ${server.url}`);
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    if (exportReport)
      throw err;
    if (outputPath) {
      logger.error(
        `Analyzer report written to ${outputPath}. Serve the directory with a static HTTP server and open its URL in a browser.`
      );
      logger.error(
        `Analyzer UI server failed: ${err.message}. A previous Analyzer process may still be running (Ctrl-C it in its terminal), or set ANALYZE_PORT to use another port.`
      );
    } else {
      logger.error(err);
    }
    await (server == null ? void 0 : server.close().catch(() => {
    }));
    process.exit(1);
  }
}
var utoopack_default = (api) => {
  api.describe({
    key: "utoopack",
    config: {
      schema({ zod }) {
        return zod.union([
          zod.boolean(),
          zod.object({
            root: zod.string(),
            watch: zod.object({
              pollIntervalMs: zod.number(),
              ignored: zod.array(zod.string()),
              nodeModulesRegexes: zod.array(zod.string())
            }).partial()
          }).partial()
        ]);
      }
    },
    enableBy: () => Boolean(api.userConfig.utoopack) || Boolean(process.env.FORCE_UTOOPACK)
  });
  api.onCheck(() => {
    (0, import_utils.checkVersion)(20, `Node 20 is required when using utoopack.`);
  });
  let assets = {
    // Will contain all js and mjs files
    js: [],
    // Will contain all css files
    css: []
  };
  api.modifyAppData((memo) => {
    memo.bundler = "utoopack";
    return memo;
  });
  api.modifyConfig((memo) => {
    if (!api.userConfig.utoopack) {
      return memo;
    }
    return {
      ...memo,
      mfsu: false,
      hmrGuardian: false,
      utoopack: {
        ...memo.utoopack
      }
    };
  });
  api.onStart(() => {
    const bundlerEntry = process.env.UTOOPACK || require.resolve("@umijs/bundler-utoopack");
    process.env.UTOOPACK = bundlerEntry;
    const packVersion = getPackVersionFromBundler(bundlerEntry);
    if (packVersion) {
      process.env.UTOOPACK_VERSION = packVersion;
    } else {
      delete process.env.UTOOPACK_VERSION;
    }
  });
  const updateAssets = ({ stats }) => {
    assets = (0, import_extractEntryAssets.extractEntryAssets)(
      (0, import_extractEntryAssets.extractEntryPointFilesFromStats)(stats),
      (0, import_extractEntryAssets.getUmiEntryFilesFromStats)(stats)
    );
  };
  api.onDevCompileDone(updateAssets);
  api.onBuildComplete(({ stats }) => {
    const entryAssets = (0, import_extractEntryAssets.extractEntryAssets)(
      (0, import_extractEntryAssets.extractEntryPointFilesFromStats)(stats),
      (0, import_extractEntryAssets.getUmiEntryFilesFromStats)(stats)
    );
    Object.entries(entryAssets).forEach(([ext, files]) => {
      if (!Array.isArray(assets[ext])) {
        assets[ext] = [];
      }
      assets[ext].push(...files);
    });
  });
  api.addHTMLStyles(() => {
    const { publicPath } = api.config;
    const displayPublicPath = publicPath === "auto" ? "/" : publicPath;
    return assets.css.map((css) => {
      return { src: `${displayPublicPath}${css}` };
    });
  });
  api.addHTMLHeadScripts(() => {
    const { publicPath } = api.config;
    const displayPublicPath = publicPath === "auto" ? "/" : publicPath;
    return assets.js.map((js) => {
      return { src: `${displayPublicPath}${js}` };
    });
  });
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  getPackVersionFromBundler,
  runBundleAnalyze
});
