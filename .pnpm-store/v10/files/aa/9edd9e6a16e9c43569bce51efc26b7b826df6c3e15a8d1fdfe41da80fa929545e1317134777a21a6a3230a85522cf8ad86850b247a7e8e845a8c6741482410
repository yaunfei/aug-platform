export interface AnalyzeServer {
    url: string;
    close(): Promise<void>;
}
/** Serve an exported report on loopback, without keeping a compiler alive. */
export declare function serveAnalyzeReport(outputPath: string, port?: number): Promise<AnalyzeServer>;
