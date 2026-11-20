var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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

// src/config/utlint/index.ts
var import_recommended = __toESM(require("../eslint/rules/recommended"));
var aliases = {
  "no-native-reassign": "no-global-assign",
  "@typescript-eslint/no-invalid-this": "no-invalid-this"
};
function nativeRules(source) {
  const rules = {};
  for (const [name, severity] of Object.entries(source)) {
    if (severity !== 0 && severity !== 1 && severity !== 2) {
      throw new TypeError(`Invalid severity for ${name}: ${severity}`);
    }
    rules[aliases[name] || name] = severity;
  }
  return rules;
}
var config = [
  {
    name: "umi/base",
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: nativeRules(import_recommended.default)
  },
  {
    name: "umi/typescript",
    files: ["**/*.{ts,tsx}"],
    rules: {
      ...nativeRules(import_recommended.typescript),
      // Preserve Umi's policy where native rule defaults differ from ESLint.
      "@typescript-eslint/ban-types": [
        2,
        { extendDefaults: true, types: { "{}": true } }
      ],
      "@typescript-eslint/no-this-alias": [2, { allowedNames: [] }],
      "@typescript-eslint/no-use-before-define": [2, { functions: true }]
    }
  },
  {
    name: "umi/jest",
    files: ["**/*.{test,spec,unit,e2e}.{ts,tsx,js,jsx}"],
    rules: nativeRules(import_recommended.jest)
  }
];
module.exports = config;
