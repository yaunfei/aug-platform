// src/cli/analyzeBuildWorker.ts
var import_utils = require("@umijs/utils");
var import_service = require("../service/service");
process.once("message", async (args) => {
  var _a, _b;
  try {
    (0, import_utils.checkLocal)();
    (0, import_utils.setNoDeprecation)();
    const reportPath = await new import_service.Service().run2({ name: "build", args });
    (_a = process.send) == null ? void 0 : _a.call(process, { reportPath });
  } catch (error) {
    import_utils.logger.error(error);
    process.exitCode = 1;
  } finally {
    (_b = process.disconnect) == null ? void 0 : _b.call(process);
  }
});
