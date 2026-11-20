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

// src/analyzeReport.ts
var analyzeReport_exports = {};
__export(analyzeReport_exports, {
  analyzeReportJsonl: () => analyzeReportJsonl,
  writeAnalyzeReportJsonl: () => writeAnalyzeReportJsonl
});
module.exports = __toCommonJS(analyzeReport_exports);
var import_events = require("events");
async function* analyzeReportJsonl(reportPath) {
  const { exportAnalyzeReport } = require("@utoo/pack/analyze");
  for await (const record of exportAnalyzeReport(reportPath)) {
    yield JSON.stringify(record) + "\n";
  }
}
async function writeAnalyzeReportJsonl(reportPath, output) {
  for await (const line of analyzeReportJsonl(reportPath)) {
    if (!output.write(line)) {
      await (0, import_events.once)(output, "drain");
    }
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  analyzeReportJsonl,
  writeAnalyzeReportJsonl
});
