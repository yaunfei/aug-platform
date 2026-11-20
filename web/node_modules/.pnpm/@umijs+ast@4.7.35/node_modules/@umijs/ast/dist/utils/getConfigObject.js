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

// src/utils/getConfigObject.ts
var getConfigObject_exports = {};
__export(getConfigObject_exports, {
  getConfigObject: () => getConfigObject,
  isConfigProperty: () => isConfigProperty
});
module.exports = __toCommonJS(getConfigObject_exports);
var traverse = __toESM(require("@umijs/bundler-utils/compiled/babel/traverse"));
var t = __toESM(require("@umijs/bundler-utils/compiled/babel/types"));
function unwrapExpression(node) {
  while ((node == null ? void 0 : node.type) === "TSSatisfiesExpression" || t.isTSAsExpression(node) || t.isTSTypeAssertion(node) || t.isTSNonNullExpression(node) || t.isParenthesizedExpression(node)) {
    node = node.expression;
  }
  return node;
}
function getConfigValue(node) {
  const value = unwrapExpression(node);
  return t.isCallExpression(value) && t.isIdentifier(value.callee, { name: "defineConfig" }) ? unwrapExpression(value.arguments[0]) : value;
}
function getLocalConfigObject(ast, declaration, reference) {
  let config;
  traverse.default(ast, {
    Program(path) {
      const binding = path.scope.getBinding(reference.name);
      if ((binding == null ? void 0 : binding.kind) !== "const" || !binding.constant || !binding.path.isVariableDeclarator() || !t.isIdentifier(binding.path.node.id, { name: reference.name }) || binding.referencePaths.length !== 1 || binding.referencePaths[0].node !== reference) {
        return;
      }
      const statement = binding.path.parent;
      const body = path.node.body;
      const index = t.isVariableDeclaration(statement) ? body.indexOf(statement) : -1;
      if (index < 0 || index >= body.indexOf(declaration))
        return;
      const value = getConfigValue(binding.path.node.init);
      if (t.isObjectExpression(value))
        config = value;
    }
  });
  return config;
}
function getConfigObject(ast) {
  const declaration = ast.program.body.find(
    (node) => t.isExportDefaultDeclaration(node)
  );
  if (t.isExportDefaultDeclaration(declaration)) {
    const config = getConfigValue(declaration.declaration);
    if (t.isObjectExpression(config))
      return config;
    if (t.isIdentifier(config)) {
      const local = getLocalConfigObject(ast, declaration, config);
      if (local)
        return local;
    }
  }
  throw new Error(
    "Can't modify config file, due to file format. Use an inline object, or a local const object referenced only by the default export, with or without defineConfig."
  );
}
function isConfigProperty(property, name) {
  return (t.isObjectProperty(property) || t.isObjectMethod(property)) && (t.isStringLiteral(property.key, { value: name }) || !property.computed && t.isIdentifier(property.key, { name }));
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  getConfigObject,
  isConfigProperty
});
