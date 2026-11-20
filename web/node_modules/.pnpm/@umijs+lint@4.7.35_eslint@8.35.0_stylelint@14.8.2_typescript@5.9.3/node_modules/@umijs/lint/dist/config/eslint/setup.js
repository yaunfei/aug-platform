// src/config/eslint/setup.ts
if (process.env.UMI_UTLINT_MIGRATE !== "1") {
  require("../../../compiled/@rushstack/eslint-patch/lib/modern-module-resolution.js");
}
