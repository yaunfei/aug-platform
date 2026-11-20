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

// src/cli/fork.ts
var fork_exports = {};
__export(fork_exports, {
  default: () => start
});
module.exports = __toCommonJS(fork_exports);
var import_utils = require("@umijs/utils");
var import_child_process = require("child_process");
var usedPorts = [];
var terminations = /* @__PURE__ */ new WeakMap();
function start({ scriptPath }) {
  let child;
  let restarting = false;
  let stopping = false;
  function spawn() {
    const worker = (0, import_child_process.fork)(scriptPath, process.argv.slice(2), {
      execArgv: getExecArgv()
    });
    child = worker;
    worker.on("message", (data) => {
      var _a;
      const { type, payload } = data || {};
      if (type === "RESTART" && !restarting && !stopping) {
        restarting = true;
        terminate(worker).then(() => (payload == null ? void 0 : payload.port) && waitForPort(payload.port)).then(() => {
          if (stopping)
            return;
          if (payload == null ? void 0 : payload.port)
            process.env.PORT = payload.port;
          restarting = false;
          spawn();
        }).catch((err) => {
          import_utils.logger.error(err);
          process.exit(1);
        });
      }
      (_a = process.send) == null ? void 0 : _a.call(process, data);
    });
  }
  spawn();
  return {
    get child() {
      return child;
    },
    stop(signal) {
      stopping = true;
      return terminate(child, signal);
    }
  };
}
function terminate(child, signal = "SIGTERM") {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }
  const pending = terminations.get(child);
  if (pending)
    return pending;
  const termination = new Promise((resolve) => {
    let exited = false;
    const kill = () => {
      if (!exited)
        child.kill(signal);
    };
    const timer = setTimeout(() => child.kill("SIGKILL"), 5e3);
    child.once("exit", () => {
      exited = true;
      clearTimeout(timer);
      resolve();
    });
    if (child.connected) {
      try {
        child.send({ type: "SHUTDOWN", payload: { signal } }, (err) => {
          if (err)
            kill();
        });
      } catch {
        kill();
      }
    } else {
      kill();
    }
  });
  terminations.set(child, termination);
  return termination;
}
function getExecArgv() {
  const execArgv = process.execArgv.slice(0);
  const inspectArgvIndex = execArgv.findIndex(
    (argv) => argv.includes("--inspect-brk")
  );
  if (inspectArgvIndex > -1) {
    const inspectArgv = execArgv[inspectArgvIndex];
    execArgv.splice(
      inspectArgvIndex,
      1,
      inspectArgv.replace(/--inspect-brk=(.*)/, (_match, s1) => {
        let port;
        try {
          port = parseInt(s1) + 1;
        } catch (e) {
          port = 9230;
        }
        if (usedPorts.includes(port)) {
          port += 1;
        }
        usedPorts.push(port);
        return `--inspect-brk=${port}`;
      })
    );
  }
  return execArgv;
}
function waitForPort(port, totalTry = 20) {
  return new Promise((resolve) => {
    import_utils.portfinder.getPort({ port }, (err, findPort) => {
      if (err || findPort === port || totalTry <= 0)
        return resolve();
      setTimeout(() => waitForPort(port, totalTry - 1).then(resolve), 100);
    });
  });
}
