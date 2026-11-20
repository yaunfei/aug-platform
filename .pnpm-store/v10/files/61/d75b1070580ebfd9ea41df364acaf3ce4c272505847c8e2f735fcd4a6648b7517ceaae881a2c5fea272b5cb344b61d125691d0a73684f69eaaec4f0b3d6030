import type { BundleOptions } from "../config/types";
import { type WebpackConfig } from "../config/webpackCompat";
import type { AnalyzeData } from "../core/types";
export interface AnalyzeOptions {
    /** Report directory, resolved from projectPath. Defaults to .utoo/analyze. */
    outputPath?: string;
}
export interface AnalyzeResult extends AnalyzeData {
    outputPath: string;
}
/**
 * Analyze a production application build using the native module graph and output
 * source maps. The caller's configuration, bundles and Webpack stats are left intact.
 */
export declare function analyze(options: BundleOptions | WebpackConfig, projectPath?: string, rootPath?: string, analyzeOptions?: AnalyzeOptions): Promise<AnalyzeResult>;
