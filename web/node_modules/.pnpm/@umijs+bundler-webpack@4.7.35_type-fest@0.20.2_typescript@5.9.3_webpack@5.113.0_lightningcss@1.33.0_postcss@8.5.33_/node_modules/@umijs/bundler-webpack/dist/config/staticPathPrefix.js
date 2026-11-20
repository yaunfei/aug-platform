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

// src/config/staticPathPrefix.ts
var staticPathPrefix_exports = {};
__export(staticPathPrefix_exports, {
  DEFAULT_STATIC_PATH_PREFIX: () => DEFAULT_STATIC_PATH_PREFIX,
  resolveStaticPathPrefix: () => resolveStaticPathPrefix
});
module.exports = __toCommonJS(staticPathPrefix_exports);
var DEFAULT_STATIC_PATH_PREFIX = "static/";
function resolveStaticPathPrefix(opts) {
  var _a;
  if (opts.staticPathPrefix !== void 0) {
    return opts.staticPathPrefix;
  }
  if (((_a = opts.userConfig) == null ? void 0 : _a.staticPathPrefix) !== void 0) {
    return opts.userConfig.staticPathPrefix;
  }
  return DEFAULT_STATIC_PATH_PREFIX;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEFAULT_STATIC_PATH_PREFIX,
  resolveStaticPathPrefix
});
