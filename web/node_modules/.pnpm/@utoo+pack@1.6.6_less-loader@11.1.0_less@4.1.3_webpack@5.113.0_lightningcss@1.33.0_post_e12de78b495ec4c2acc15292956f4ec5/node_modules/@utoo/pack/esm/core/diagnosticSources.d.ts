/** Shares immutable source text across the native diagnostic results of one project. */
export declare class DiagnosticSources {
    private readonly maxEntries;
    private readonly maxBytes;
    private readonly sources;
    private bytes;
    private disposed;
    constructor(maxEntries?: number, maxBytes?: number);
    intern<T>(value: T): T;
    clear(): void;
    dispose(): void;
}
