import fs from "fs";
import path from "path";
function isJavascriptAsset(file) {
    return (file.endsWith(".js") &&
        !file.endsWith(".LICENSE.txt") &&
        !file.endsWith(".map"));
}
export function getInitialAssetsFromStats(outputDir) {
    const assets = { js: new Set(), css: new Set() };
    const statsPath = path.join(outputDir, "stats.json");
    if (fs.existsSync(statsPath)) {
        try {
            const stats = JSON.parse(fs.readFileSync(statsPath, "utf-8"));
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
export function getInitialAssetsFromEndpointPaths(endpoints) {
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
