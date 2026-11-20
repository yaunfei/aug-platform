import type { IConfig } from '../types';
export declare const DEFAULT_STATIC_PATH_PREFIX = "static/";
/**
 * Resolve webpack assetModuleFilename directory prefix.
 * opts.staticPathPrefix wins (used by mfsu dep builds); otherwise userConfig;
 * default remains `static/` for backward compatibility.
 */
export declare function resolveStaticPathPrefix(opts: {
    staticPathPrefix?: string;
    userConfig?: Pick<IConfig, 'staticPathPrefix'>;
}): string;
