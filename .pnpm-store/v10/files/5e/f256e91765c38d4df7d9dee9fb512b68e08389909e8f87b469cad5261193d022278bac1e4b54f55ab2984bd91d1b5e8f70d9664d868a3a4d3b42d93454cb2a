import path from "path";
import { HtmlPlugin } from "../plugins/HtmlPlugin.js";
import { getInitialAssetsFromEndpointPaths } from "./getInitialAssets.js";
export class HtmlGenerationManager {
    constructor(config, outputDir, publicPath) {
        this.outputDir = outputDir;
        this.publicPath = publicPath;
        this.endpointOrder = [];
        this.endpointGroups = new Map();
        this.endpointGroupByEndpoint = new Map();
        this.writtenEndpointPaths = new Map();
        this.pendingGenerateAll = false;
        this.pendingEndpoints = new Set();
        this.generationQueue = Promise.resolve();
        const globalHtml = config.html;
        this.globalConfigs = Array.isArray(globalHtml)
            ? globalHtml
            : globalHtml
                ? [globalHtml]
                : [];
        this.appEntries = config.entry.filter((entry) => !entry.library);
        this.libraryEntries = config.entry.filter((entry) => !!entry.library);
    }
    get enabled() {
        return (this.globalConfigs.length > 0 ||
            this.appEntries.some((entry) => !!entry.html) ||
            this.libraryEntries.some((entry) => !!entry.html));
    }
    setEntrypoints(entrypoints) {
        this.endpointOrder.length = 0;
        this.endpointGroups.clear();
        this.endpointGroupByEndpoint.clear();
        this.writtenEndpointPaths.clear();
        this.addEntrypoints(entrypoints.apps, entrypoints.appPaths, this.appEntries, "app");
        this.addEntrypoints(entrypoints.libraries, entrypoints.libraryPaths, this.libraryEntries, "library");
    }
    setWrittenEndpointPath(endpoint, writtenEndpointPath) {
        this.writtenEndpointPaths.set(endpoint, writtenEndpointPath);
    }
    async generateAll() {
        if (!this.enabled) {
            return;
        }
        this.pendingGenerateAll = true;
        await this.scheduleGeneration();
    }
    async generateForEndpoint(endpoint) {
        if (!this.enabled) {
            return;
        }
        this.pendingEndpoints.add(endpoint);
        await this.scheduleGeneration();
    }
    addEntrypoints(endpoints, paths, entries, kind) {
        if (endpoints && endpoints.length !== entries.length) {
            throw new Error(`Expected ${entries.length} ${kind} endpoint(s), received ${endpoints.length}`);
        }
        if (endpoints && paths && paths.length !== endpoints.length) {
            throw new Error(`Expected ${endpoints.length} written ${kind} endpoint path(s), received ${paths.length}`);
        }
        endpoints === null || endpoints === void 0 ? void 0 : endpoints.forEach((endpoint, index) => {
            var _a;
            this.endpointOrder.push(endpoint);
            const config = (_a = entries[index]) === null || _a === void 0 ? void 0 : _a.html;
            if (config) {
                const key = this.getHtmlOutputKey(config);
                let group = this.endpointGroups.get(key);
                if (group) {
                    // Multiple module scripts extracted from one HTML entry intentionally
                    // share an output file. Keep all owning endpoints in the same group so
                    // generating that file cannot overwrite all but the last script.
                    group.config = config;
                    group.endpoints.push(endpoint);
                }
                else {
                    group = { config, endpoints: [endpoint] };
                    this.endpointGroups.set(key, group);
                }
                this.endpointGroupByEndpoint.set(endpoint, group);
            }
            const writtenEndpointPath = paths === null || paths === void 0 ? void 0 : paths[index];
            if (writtenEndpointPath) {
                this.writtenEndpointPaths.set(endpoint, writtenEndpointPath);
            }
        });
    }
    async generateGlobalHtml() {
        if (this.globalConfigs.length === 0) {
            return;
        }
        const assets = getInitialAssetsFromEndpointPaths(this.getWrittenEndpointPaths(this.endpointOrder));
        for (const config of this.globalConfigs) {
            await new HtmlPlugin(config).generate(this.outputDir, assets, this.publicPath);
        }
    }
    async generateEndpointHtml(group) {
        const writtenEndpointPaths = this.getWrittenEndpointPaths(group.endpoints);
        if (writtenEndpointPaths.length === 0) {
            return;
        }
        const assets = getInitialAssetsFromEndpointPaths(writtenEndpointPaths);
        await new HtmlPlugin(group.config).generate(this.outputDir, assets, this.publicPath);
    }
    getWrittenEndpointPaths(endpoints) {
        return endpoints.flatMap((endpoint) => {
            const written = this.writtenEndpointPaths.get(endpoint);
            return written ? [written] : [];
        });
    }
    getHtmlOutputKey(config) {
        var _a, _b, _c;
        const outputDir = path.resolve((_b = (_a = config.output) === null || _a === void 0 ? void 0 : _a.path) !== null && _b !== void 0 ? _b : this.outputDir);
        return path.join(outputDir, (_c = config.filename) !== null && _c !== void 0 ? _c : "index.html");
    }
    scheduleGeneration() {
        const drain = async () => {
            while (this.pendingGenerateAll || this.pendingEndpoints.size > 0) {
                const generateAll = this.pendingGenerateAll;
                this.pendingGenerateAll = false;
                const endpoints = [...this.pendingEndpoints];
                this.pendingEndpoints.clear();
                await this.generateGlobalHtml();
                const groups = generateAll
                    ? [...this.endpointGroups.values()]
                    : [
                        ...new Set(endpoints.flatMap((endpoint) => {
                            const group = this.endpointGroupByEndpoint.get(endpoint);
                            return group ? [group] : [];
                        })),
                    ];
                for (const group of groups) {
                    await this.generateEndpointHtml(group);
                }
            }
        };
        const queued = this.generationQueue.then(drain, drain);
        this.generationQueue = queued.catch(() => { });
        return queued;
    }
}
