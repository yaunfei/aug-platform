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

// src/setConfigByName/setConfigByName.ts
var setConfigByName_exports = {};
__export(setConfigByName_exports, {
  setConfigByName: () => setConfigByName
});
module.exports = __toCommonJS(setConfigByName_exports);
var import_parser = require("@umijs/bundler-utils/compiled/babel/parser");
var t = __toESM(require("@umijs/bundler-utils/compiled/babel/types"));
var import_getConfigObject = require("../utils/getConfigObject");
function setConfigByName(ast, name, value) {
  const config = (0, import_getConfigObject.getConfigObject)(ast);
  if (typeof value !== "string") {
    value = JSON.stringify(value);
  }
  let valueObject = t.stringLiteral(value);
  try {
    JSON.parse(value);
    valueObject = (0, import_parser.parseExpression)(value);
  } catch (error) {
  }
  const property = config.properties.slice().reverse().find((property2) => (0, import_getConfigObject.isConfigProperty)(property2, name));
  if (t.isObjectProperty(property)) {
    property.value = valueObject;
    property.shorthand = false;
  } else if (t.isObjectMethod(property)) {
    const replacement = t.objectProperty(
      property.key,
      valueObject,
      property.computed
    );
    t.inheritsComments(replacement, property);
    config.properties[config.properties.indexOf(property)] = replacement;
  } else {
    const key = t.isValidIdentifier(name) ? t.identifier(name) : t.stringLiteral(name);
    config.properties.push(t.objectProperty(key, valueObject));
  }
  return ast;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  setConfigByName
});
