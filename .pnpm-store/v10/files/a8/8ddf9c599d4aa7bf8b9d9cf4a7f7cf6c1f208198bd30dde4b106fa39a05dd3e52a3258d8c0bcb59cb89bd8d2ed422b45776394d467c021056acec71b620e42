import type { BrowserLogMethod, BrowserLogsMessage, BrowserToTerminal } from "@utoo/pack-shared";
import type { Project } from "./types";
export declare function isBrowserLogsMessage(value: unknown): value is BrowserLogsMessage;
export declare function shouldForwardBrowserLog(level: BrowserToTerminal, method: BrowserLogMethod): boolean;
export declare function forwardBrowserLogs(message: BrowserLogsMessage, level: BrowserToTerminal, project: Project, projectPath: string, outputPath: string): Promise<void>;
