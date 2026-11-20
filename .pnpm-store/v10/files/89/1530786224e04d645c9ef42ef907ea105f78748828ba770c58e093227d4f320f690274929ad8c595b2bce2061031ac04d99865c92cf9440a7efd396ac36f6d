"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defineConfig = exports.moduleReferencesVersion = exports.serve = exports.serveAnalyzeReport = exports.exportAnalyzeReport = exports.analyze = exports.build = void 0;
const analyze_1 = require("./commands/analyze");
Object.defineProperty(exports, "analyze", { enumerable: true, get: function () { return analyze_1.analyze; } });
const build_1 = require("./commands/build");
Object.defineProperty(exports, "build", { enumerable: true, get: function () { return build_1.build; } });
const dev_1 = require("./commands/dev");
Object.defineProperty(exports, "serve", { enumerable: true, get: function () { return dev_1.serve; } });
var exportAnalyzeReport_1 = require("./commands/exportAnalyzeReport");
Object.defineProperty(exports, "exportAnalyzeReport", { enumerable: true, get: function () { return exportAnalyzeReport_1.exportAnalyzeReport; } });
var serveAnalyzeReport_1 = require("./commands/serveAnalyzeReport");
Object.defineProperty(exports, "serveAnalyzeReport", { enumerable: true, get: function () { return serveAnalyzeReport_1.serveAnalyzeReport; } });
/** Version of the native browser module-reference configuration contract. */
var moduleReferences_1 = require("./core/moduleReferences");
Object.defineProperty(exports, "moduleReferencesVersion", { enumerable: true, get: function () { return moduleReferences_1.moduleReferencesVersion; } });
var defineConfig_1 = require("./defineConfig");
Object.defineProperty(exports, "defineConfig", { enumerable: true, get: function () { return defineConfig_1.defineConfig; } });
const utoopack = { build: build_1.build, serve: dev_1.serve, analyze: analyze_1.analyze };
exports.default = utoopack;
__exportStar(require("./config/types"), exports);
__exportStar(require("./config/webpackCompat"), exports);
__exportStar(require("./core/types"), exports);
__exportStar(require("./utils/findRoot"), exports);
