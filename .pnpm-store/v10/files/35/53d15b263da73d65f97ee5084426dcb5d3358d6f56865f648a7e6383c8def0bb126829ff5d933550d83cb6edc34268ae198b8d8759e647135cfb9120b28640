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

// src/cli/analyzeExport.ts
var analyzeExport_exports = {};
__export(analyzeExport_exports, {
  analyzeBuildExport: () => analyzeBuildExport
});
module.exports = __toCommonJS(analyzeExport_exports);
var import_analyzeReport = require("@umijs/bundler-utoopack/dist/analyzeReport");
var import_utils = require("@umijs/utils");
var import_child_process = require("child_process");
var import_events = require("events");
var import_promises = require("fs/promises");
var import_os = require("os");
var import_path = require("path");
async function analyzeBuildExport(args, outputFile) {
  try {
    const destination = outputFile && (0, import_path.resolve)(outputFile);
    const reportPath = await captureAnalyzeReport(args);
    if (!reportPath)
      return;
    if (destination) {
      await writeReportFile(reportPath, destination);
    } else {
      await (0, import_analyzeReport.writeAnalyzeReportJsonl)(reportPath, process.stdout);
    }
  } catch (error) {
    import_utils.logger.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
async function writeReportFile(reportPath, destination) {
  const temporaryDirectory = await (0, import_promises.mkdtemp)(
    (0, import_path.join)((0, import_path.dirname)(destination), ".umi-analyze-")
  );
  try {
    const temporaryFile = (0, import_path.join)(temporaryDirectory, "report.jsonl");
    await (0, import_promises.writeFile)(temporaryFile, (0, import_analyzeReport.analyzeReportJsonl)(reportPath));
    await (0, import_promises.rename)(temporaryFile, destination);
  } finally {
    await (0, import_promises.rm)(temporaryDirectory, { recursive: true, force: true });
  }
}
async function captureAnalyzeReport(args) {
  const worker = (0, import_child_process.fork)(
    require.resolve("./analyzeBuildWorker"),
    process.argv.slice(2),
    {
      stdio: [0, 2, 2, "ipc"]
    }
  );
  let reportPath;
  worker.on("message", (message) => {
    if (typeof (message == null ? void 0 : message.reportPath) === "string")
      reportPath = message.reportPath;
  });
  const forwardInterrupt = () => worker.kill("SIGINT");
  const forwardTermination = () => worker.kill("SIGTERM");
  process.on("SIGINT", forwardInterrupt);
  process.on("SIGTERM", forwardTermination);
  try {
    const closed = (0, import_events.once)(worker, "close");
    worker.send(args);
    const [code, signal] = await closed;
    if (code !== 0) {
      process.exitCode = code ?? (signal ? 128 + import_os.constants.signals[signal] : 1);
      return;
    }
    if (!reportPath) {
      throw new Error("Utoopack did not generate a bundle analysis report.");
    }
    return reportPath;
  } finally {
    process.off("SIGINT", forwardInterrupt);
    process.off("SIGTERM", forwardTermination);
    if (worker.exitCode === null && worker.signalCode === null)
      worker.kill();
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  analyzeBuildExport
});
