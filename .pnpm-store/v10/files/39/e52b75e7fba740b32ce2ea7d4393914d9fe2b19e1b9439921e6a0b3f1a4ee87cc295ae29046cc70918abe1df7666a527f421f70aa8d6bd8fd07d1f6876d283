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

// src/analyze.ts
var analyze_exports = {};
__export(analyze_exports, {
  analyze: () => analyze,
  serveAnalyzeReport: () => serveAnalyzeReport
});
module.exports = __toCommonJS(analyze_exports);
var import_config = require("./config");
var REPORT_OUTPUT_DIR = ".turbopack/analyze";
var REINSTALL_HINT = "Utoopack analyze requires @utoo/pack >= 1.6.0, please reinstall @umijs/bundler-utoopack";
async function analyze(opts) {
  const { analyze: utooPackAnalyze, findRootDir } = require("@utoo/pack");
  if (typeof utooPackAnalyze !== "function") {
    throw new Error(REINSTALL_HINT);
  }
  const normalizedCwd = (0, import_config.normalizeUtoopackPath)(opts.cwd);
  const rootDir = (0, import_config.getUtoopackRootDir)(
    normalizedCwd,
    opts.config.utoopack,
    findRootDir
  );
  const utooPackConfig = await (0, import_config.getProdUtooPackConfig)({
    ...opts,
    cwd: normalizedCwd,
    rootDir
  });
  const result = await utooPackAnalyze(utooPackConfig, normalizedCwd, rootDir, {
    outputPath: REPORT_OUTPUT_DIR
  });
  return { outputPath: result.outputPath };
}
async function serveAnalyzeReport(reportPath, port) {
  const {
    serveAnalyzeReport: utooPackServeAnalyzeReport
  } = require("@utoo/pack");
  if (typeof utooPackServeAnalyzeReport !== "function") {
    throw new Error(REINSTALL_HINT);
  }
  return utooPackServeAnalyzeReport(reportPath, port);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  analyze,
  serveAnalyzeReport
});
