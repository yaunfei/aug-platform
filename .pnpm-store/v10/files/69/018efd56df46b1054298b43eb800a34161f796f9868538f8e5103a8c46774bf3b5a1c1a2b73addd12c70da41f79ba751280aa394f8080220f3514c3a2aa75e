import type { HmrIdentifiers, NapiUpdateMessage, NapiWrittenEndpoint, StackFrame, TurbopackInternalErrorOpts } from "../binding";
import * as binding from "../binding";
import { ConfigComplete } from "../config/types";
import { AnalyzeData, ProjectOptions, RawEntrypoints, Update } from "./types";
type ProjectCreationOptions = Omit<Required<ProjectOptions>, "rootPath"> & Partial<Pick<ProjectOptions, "rootPath">>;
/**
 * An error caused by a bug in Turbopack, and not the user's code (e.g. a Rust panic). These should
 * be written to a log file and details should not be shown to the user.
 *
 * These are constructed in Turbopack by calling `throwTurbopackInternalError`.
 */
export declare class TurbopackInternalError extends Error {
    name: string;
    location: string | undefined;
    constructor({ message, anonymizedLocation }: TurbopackInternalErrorOpts);
}
export declare function serializeConfig(config: ConfigComplete, isDev: boolean): Promise<string>;
export declare function projectFactory(endpointWatchOptions?: {
    hasServerOutput: boolean;
    nodeTarget: boolean;
}): (options: ProjectCreationOptions, turboEngineOptions: binding.NapiTurboEngineOptions) => Promise<{
    readonly _nativeProject: {
        __napiType: "Project";
    };
    update(options: Partial<ProjectOptions>): Promise<void>;
    writeAllEntrypointsToDisk(): Promise<TurbopackResult<RawEntrypoints>>;
    activateLazyChunk(chunkPath: string): Promise<boolean>;
    writeAnalyzeData(outputPath: string): Promise<TurbopackResult<AnalyzeData>>;
    entrypointsSubscribe(): AsyncGenerator<{
        apps: {
            readonly _nativeEndpoint: {
                __napiType: "Endpoint";
            };
            /** Undefined for library endpoints. */
            readonly _appIndex: number | undefined;
            writeToDisk(): Promise<TurbopackResult<NapiWrittenEndpoint>>;
            clientChanged(): Promise<AsyncIterableIterator<TurbopackResult<{}>>>;
            serverChanged(includeIssues: boolean): Promise<AsyncIterableIterator<TurbopackResult<{}>>>;
        }[];
        libraries: {
            readonly _nativeEndpoint: {
                __napiType: "Endpoint";
            };
            /** Undefined for library endpoints. */
            readonly _appIndex: number | undefined;
            writeToDisk(): Promise<TurbopackResult<NapiWrittenEndpoint>>;
            clientChanged(): Promise<AsyncIterableIterator<TurbopackResult<{}>>>;
            serverChanged(includeIssues: boolean): Promise<AsyncIterableIterator<TurbopackResult<{}>>>;
        }[];
        appPaths: NapiWrittenEndpoint[] | undefined;
        libraryPaths: NapiWrittenEndpoint[] | undefined;
        issues: binding.NapiIssue[];
    }, void, unknown>;
    hmrEvents(identifier: string, expectedVersion?: string): AsyncIterableIterator<TurbopackResult<Update>>;
    hmrIdentifiersSubscribe(): AsyncIterableIterator<TurbopackResult<HmrIdentifiers>>;
    traceSource(stackFrame: StackFrame, currentDirectoryFileUrl: string): Promise<StackFrame | null>;
    getSourceForAsset(filePath: string): Promise<string | null>;
    getSourceMap(filePath: string): Promise<string | null>;
    getSourceMapSync(filePath: string): string | null;
    getCompletedTaskCount(): number;
    updateInfoSubscribe(aggregationMs: number): AsyncIterableIterator<NapiUpdateMessage>;
    shutdown(): Promise<void>;
    onExit(): Promise<void>;
}>;
export {};
