"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInitialAssetsFromStats = getInitialAssetsFromStats;
exports.getInitialAssetsFromEndpointPaths = getInitialAssetsFromEndpointPaths;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function isJavascriptAsset(file) {
    return (file.endsWith(".js") &&
        !file.endsWith(".LICENSE.txt") &&
        !file.endsWith(".map"));
}
function getInitialAssetsFromStats(outputDir) {
    const assets = { js: new Set(), css: new Set() };
    const statsPath = path_1.default.join(outputDir, "stats.json");
    if (fs_1.default.existsSync(statsPath)) {
        try {
            const stats = JSON.parse(fs_1.default.readFileSync(statsPath, "utf-8"));
            if (stats.entrypoints) {
                Object.values(stats.entrypoints).forEach((entrypoint) => {
                    var _a;
                    (_a = entrypoint.assets) === null || _a === void 0 ? void 0 : _a.forEach((asset) => {
                        if (asset.name.endsWith(".js")) {
                            assets.js.add(asset.name);
                        }
                        if (asset.name.endsWith(".css")) {
                            assets.css.add(asset.name);
                        }
                    });
                });
            }
        }
        catch (e) {
            console.warn("Failed to read stats.json for assets discovery", e);
        }
    }
    return { js: [...assets.js], css: [...assets.css] };
}
function getInitialAssetsFromEndpointPaths(endpoints) {
    const assets = { js: new Set(), css: new Set() };
    endpoints.forEach((endpoint) => {
        endpoint.clientPaths.forEach((file) => {
            if (isJavascriptAsset(file)) {
                assets.js.add(file);
            }
            if (file.endsWith(".css")) {
                assets.css.add(file);
            }
        });
    });
    return { js: [...assets.js], css: [...assets.css] };
}
