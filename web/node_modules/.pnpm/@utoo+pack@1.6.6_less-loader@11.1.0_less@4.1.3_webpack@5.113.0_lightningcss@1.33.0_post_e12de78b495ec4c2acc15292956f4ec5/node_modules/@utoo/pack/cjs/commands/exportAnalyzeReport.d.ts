export type AnalyzeExportEnvironment = "client" | "server";
export type AnalyzeExportCoverage = "exact" | "unsupported" | "not_a_chunk";
export interface AnalyzeExportOptions {
    environment?: AnalyzeExportEnvironment;
    /** Exact display name or /entry-N ID. Use an ID to disambiguate equal names. */
    entry?: string;
}
export interface AnalyzeExportMetaRecord {
    type: "meta";
    schema_version: 1;
    tool: "@utoo/pack";
    module_index_hash: string;
    entry_count: number;
    selected_entries: number;
}
export interface AnalyzeExportModuleRecord {
    type: "module";
    ident: string;
    path: string;
    dependencies: {
        sync: string[];
        async: string[];
        traced: string[];
    };
}
export interface AnalyzeExportRoot {
    id: string;
    module_ident: string;
    module_path: string;
    role: string;
    entry_kind?: string;
    client_references: Array<{
        module_ident: string;
        module_path: string;
        reference_kind: string;
    }>;
}
export interface AnalyzeExportEntryRecord {
    type: "entry";
    /** Stable within this report; join output, part and group records on this ID. */
    entry: string;
    name: string;
    environment: AnalyzeExportEnvironment;
    roots: AnalyzeExportRoot[] | null;
    coverage: {
        roots: "exact" | "unknown";
        groups: "exact" | "unknown";
    };
}
export interface AnalyzeExportOutputRecord {
    type: "output";
    entry: string;
    filename: string;
    /** The output's environment, which can differ from its entry's environment. */
    environment: AnalyzeExportEnvironment;
    kind: "emitted" | "traced";
    modules: string[];
    async_loaders: string[];
    coverage: AnalyzeExportCoverage;
    size: number;
    compressed_size: number;
}
export interface AnalyzeExportPartRecord {
    type: "part";
    entry: string;
    /** Unique within the entry. Do not deduplicate by filename + source_path. */
    id: number;
    filename: string;
    source_path: string;
    size: number;
    compressed_size: number;
}
export interface AnalyzeExportGroupRecord {
    type: "group";
    entry: string;
    id: number;
    kind: string;
    trigger_module_ident: string | null;
    trigger_join: "none" | "joined";
    outputs: string[];
}
export type AnalyzeExportRecord = AnalyzeExportMetaRecord | AnalyzeExportModuleRecord | AnalyzeExportEntryRecord | AnalyzeExportOutputRecord | AnalyzeExportPartRecord | AnalyzeExportGroupRecord;
/**
 * Export saved build evidence without loading native bindings, compiling or serving.
 * Keeps the complete module graph and only one entry's payload in memory. Filters
 * select entry records, not module graph nodes, so import chains remain intact.
 * A later invalid entry can reject after earlier records were yielded: consumers
 * must discard partial output on failure. Compressed sizes are estimates.
 */
export declare function exportAnalyzeReport(reportPath: string, options?: AnalyzeExportOptions): AsyncGenerator<AnalyzeExportRecord>;
