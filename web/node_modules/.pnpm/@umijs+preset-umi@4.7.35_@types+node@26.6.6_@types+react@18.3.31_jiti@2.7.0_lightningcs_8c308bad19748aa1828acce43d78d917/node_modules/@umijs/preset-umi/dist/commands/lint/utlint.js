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

// src/commands/lint/utlint.ts
var utlint_exports = {};
__export(utlint_exports, {
  runUtlint: () => runUtlint
});
module.exports = __toCommonJS(utlint_exports);
var import_child_process = require("child_process");
var import_path = require("path");
async function runUtlint(cwd, args) {
  let binPath;
  try {
    const pkgPath = require.resolve("@utoo/lint/package.json", {
      paths: [cwd]
    });
    binPath = (0, import_path.resolve)((0, import_path.dirname)(pkgPath), require(pkgPath).bin["utoo-lint"]);
  } catch (err) {
    throw new Error(
      "@utoo/lint is required for umi lint --utlint. Please install it in your project with npm install -D @utoo/lint (Node.js >=20).",
      { cause: err }
    );
  }
  await new Promise((resolve2, reject) => {
    (0, import_child_process.fork)(binPath, args, {
      cwd,
      stdio: "inherit",
      env: {
        ...process.env,
        // The migration tool reads rule configs without loading ESLint plugins.
        // Umi's ESLint resolution patch requires a real ESLint caller instead.
        UMI_UTLINT_MIGRATE: args[0] === "migrate" && args[1] === "eslint" ? "1" : "0"
      }
    }).once("error", reject).once("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`utoo-lint was terminated by ${signal}.`));
      } else {
        if (code)
          process.exitCode = code;
        resolve2();
      }
    });
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  runUtlint
});
