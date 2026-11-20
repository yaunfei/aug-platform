import type { IOpts } from './types';
export interface IUtoopackAnalyzeOpts extends Omit<IOpts, 'onBuildComplete' | 'watch' | 'cache' | 'rootDir'> {
}
export interface IUtoopackAnalyzeResult {
    /** Absolute path of the generated report directory */
    outputPath: string;
}
export interface IUtoopackAnalyzeServer {
    url: string;
    close(): Promise<void>;
}
export declare function analyze(opts: IUtoopackAnalyzeOpts): Promise<IUtoopackAnalyzeResult>;
export declare function serveAnalyzeReport(reportPath: string, port?: number): Promise<IUtoopackAnalyzeServer>;
