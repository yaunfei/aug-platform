import Config from '@umijs/bundler-webpack/compiled/webpack-5-chain';
import { Env, IConfig } from '../types';
interface IOpts {
    config: Config;
    userConfig: IConfig;
    cwd: string;
    env: Env;
    browsers: any;
    /**
     * When set (including ''), override file-loader `name` so SVGR URL fallbacks
     * honor staticPathPrefix. When omitted/undefined, keep file-loader's default
     * `[contenthash].[ext]` at the output root (pre-configurable-prefix behavior).
     */
    staticPathPrefix?: string;
}
export declare function addSVGRules(opts: IOpts): Promise<void>;
export {};
