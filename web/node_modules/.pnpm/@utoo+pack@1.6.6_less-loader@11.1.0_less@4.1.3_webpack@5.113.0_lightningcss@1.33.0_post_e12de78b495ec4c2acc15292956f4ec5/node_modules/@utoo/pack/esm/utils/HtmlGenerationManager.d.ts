import type { NapiWrittenEndpoint } from "../binding";
import type { ConfigComplete } from "../config/types";
import type { Endpoint, RawEntrypoints } from "../core/types";
export declare class HtmlGenerationManager {
    private readonly outputDir;
    private readonly publicPath?;
    private readonly globalConfigs;
    private readonly appEntries;
    private readonly libraryEntries;
    private readonly endpointOrder;
    private readonly endpointGroups;
    private readonly endpointGroupByEndpoint;
    private readonly writtenEndpointPaths;
    private pendingGenerateAll;
    private readonly pendingEndpoints;
    private generationQueue;
    constructor(config: ConfigComplete, outputDir: string, publicPath?: string | undefined);
    get enabled(): boolean;
    setEntrypoints(entrypoints: RawEntrypoints): void;
    setWrittenEndpointPath(endpoint: Endpoint, writtenEndpointPath: NapiWrittenEndpoint): void;
    generateAll(): Promise<void>;
    generateForEndpoint(endpoint: Endpoint): Promise<void>;
    private addEntrypoints;
    private generateGlobalHtml;
    private generateEndpointHtml;
    private getWrittenEndpointPaths;
    private getHtmlOutputKey;
    private scheduleGeneration;
}
