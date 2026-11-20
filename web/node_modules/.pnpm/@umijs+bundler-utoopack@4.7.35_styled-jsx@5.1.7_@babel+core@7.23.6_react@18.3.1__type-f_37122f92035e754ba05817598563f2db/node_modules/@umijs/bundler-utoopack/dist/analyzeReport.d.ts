import type { Writable } from 'stream';
export declare function analyzeReportJsonl(reportPath: string): AsyncGenerator<string, void, unknown>;
export declare function writeAnalyzeReportJsonl(reportPath: string, output: Writable): Promise<void>;
