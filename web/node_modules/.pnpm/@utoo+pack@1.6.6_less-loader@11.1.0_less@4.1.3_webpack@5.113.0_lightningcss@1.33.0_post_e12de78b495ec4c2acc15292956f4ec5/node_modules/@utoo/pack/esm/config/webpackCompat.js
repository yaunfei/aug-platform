import { compatOptionsFromWebpack, } from "@utoo/pack-shared";
import { readWebpackConfig } from "./readWebpackConfig.js";
export { compatOptionsFromWebpack, } from "@utoo/pack-shared";
export { readWebpackConfig } from "./readWebpackConfig.js";
export function resolveBundleOptions(options, projectPath, rootPath) {
    if (options.webpackMode) {
        let webpackConfig = options;
        const loadedConfig = readWebpackConfig(projectPath, rootPath);
        webpackConfig = { ...loadedConfig, ...webpackConfig };
        try {
            const result = compatOptionsFromWebpack(webpackConfig);
            if (!result.config.entry || result.config.entry.length === 0) {
                throw new Error('webpack.config.js is missing "entry" configuration.\n' +
                    "Please define an entry, for example:\n" +
                    '  module.exports = { entry: "./src/index.js" };');
            }
            return result;
        }
        catch (e) {
            throw new Error("Error converting webpack config: " + e);
        }
    }
    else {
        return options;
    }
}
