/**
 * Dev server implementation using Hono + @hono/node-server + @hono/node-ws.
 * Keeps the same public API as dev.ts; do not remove dev.ts until this is verified.
 */
import { BundleOptions } from "../config/types";
import { type WebpackConfig } from "../config/webpackCompat";
import type { Project } from "../core/types";
export interface SelfSignedCertificate {
    key: string;
    cert: string;
    rootCA?: string;
}
export interface DevServerReadyContext {
    port: number;
    hostname: string;
    /** Initial client asset paths written for all configured endpoints. */
    clientPaths: string[];
}
export interface DevServerClientBuildContext {
    /** Client asset paths written for all configured endpoints. */
    clientPaths: string[];
    isRebuild: boolean;
}
export interface DevServerHandle {
    port: number;
    hostname: string;
    /** Write current entrypoints and their HTML before an integration publishes its build. */
    writeAllEntrypointsToDisk: Project["writeAllEntrypointsToDisk"];
    /** Close the HTTP server, HMR connections and project without exiting the process. */
    close(): Promise<void>;
}
export interface StartServerOptions {
    port: number;
    https?: boolean;
    hostname?: string;
    logServerInfo?: boolean;
    /** Serve index.html for unmatched SPA routes. Defaults to false; the CLI enables it. */
    historyApiFallback?: boolean;
    /** Handle process signals and errors. Defaults to true; embedded servers can opt out. */
    handleSignals?: boolean;
    selfSignedCertificate?: SelfSignedCertificate;
    /**
     * Awaited after successful client output, stats and HTML writes, including
     * rebuilds without a browser. The initial call precedes onReady.
     */
    onClientBuild?: (context: DevServerClientBuildContext) => void | Promise<void>;
    /**
     * Called after the initial dev build has been written and the HTTP server is
     * listening. Integrations can await this instead of polling the internal
     * server port.
     */
    onReady?: (context: DevServerReadyContext) => void | Promise<void>;
}
export declare function serve(options: BundleOptions | WebpackConfig, projectPath: string | undefined, rootPath: string | undefined, serverOptions: StartServerOptions & {
    returnHandle: true;
}): Promise<DevServerHandle>;
export declare function serve(options: BundleOptions | WebpackConfig, projectPath: string | undefined, rootPath: string | undefined, serverOptions: StartServerOptions & {
    returnHandle: false;
}): Promise<void>;
export declare function serve(options: BundleOptions | WebpackConfig, projectPath: string | undefined, rootPath: string | undefined, serverOptions: StartServerOptions & {
    returnHandle: boolean;
}): Promise<DevServerHandle | void>;
export declare function serve(options: BundleOptions | WebpackConfig, projectPath?: string, rootPath?: string, serverOptions?: StartServerOptions & {
    returnHandle?: false;
}): Promise<void>;
