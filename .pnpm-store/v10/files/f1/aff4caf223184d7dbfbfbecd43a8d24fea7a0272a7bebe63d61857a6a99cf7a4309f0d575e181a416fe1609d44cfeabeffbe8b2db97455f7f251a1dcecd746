// src/cli/forkedDev.ts
var import_utils = require("@umijs/utils");
var import_constants = require("../constants");
var import_service = require("../service/service");
(0, import_utils.setNodeTitle)(`${import_constants.FRAMEWORK_NAME}-dev`);
(0, import_utils.setNoDeprecation)();
(async () => {
  var _a;
  let closed = false;
  try {
    let onSignal = function(signal) {
      receivedSignal = true;
      shutdown(signal);
    };
    const args = (0, import_utils.yParser)(process.argv.slice(2));
    const service = new import_service.Service();
    let startup;
    let receivedSignal = false;
    const signalHandlers = {
      SIGINT: () => onSignal("SIGINT"),
      SIGQUIT: () => onSignal("SIGQUIT"),
      SIGTERM: () => onSignal("SIGTERM")
    };
    for (const signal of ["SIGINT", "SIGQUIT", "SIGTERM"]) {
      process.on(signal, signalHandlers[signal]);
    }
    process.on("message", (data) => {
      var _a2;
      if ((data == null ? void 0 : data.type) === "SHUTDOWN") {
        shutdown(((_a2 = data.payload) == null ? void 0 : _a2.signal) || "SIGTERM");
      }
    });
    process.once("disconnect", () => shutdown("SIGTERM"));
    (_a = process.channel) == null ? void 0 : _a.unref();
    async function shutdown(signal) {
      if (closed)
        return;
      closed = true;
      const timer = setTimeout(() => process.exit(1), 5e3);
      timer.unref();
      try {
        await startup.catch(() => {
        });
        const cleanup = receivedSignal ? [] : process.rawListeners(signal).filter((listener) => listener !== signalHandlers[signal]).map(async (listener) => listener.call(process, signal));
        cleanup.push(
          Promise.resolve().then(
            () => service.applyPlugins({
              key: "onExit",
              args: {
                signal
              }
            })
          )
        );
        for (const result of await Promise.allSettled(cleanup)) {
          if (result.status === "rejected") {
            process.exitCode = 1;
            import_utils.logger.fatal(result.reason);
          }
        }
        process.exit(process.exitCode || 0);
      } catch (e) {
        import_utils.logger.fatal(e);
        process.exit(1);
      } finally {
        clearTimeout(timer);
      }
    }
    startup = service.run2({
      name: import_constants.DEV_COMMAND,
      args
    });
    if (process.connected === false)
      shutdown("SIGTERM");
    await startup;
  } catch (e) {
    process.exitCode = 1;
    import_utils.logger.fatal(e);
    import_utils.printHelp.exit();
    if (!closed)
      process.exit(1);
  }
})();
