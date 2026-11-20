import type { IApi } from '../../types';
export declare function getDiagnosticConfig(config: Record<string, unknown>): {
    hash: boolean | undefined;
    history: {
        type: string;
    } | undefined;
    mfsu: boolean | undefined;
    ssr: boolean | undefined;
    vite: boolean | undefined;
    utoopack: boolean | undefined;
};
export declare function getDiagnosticAppData(api: IApi): {
    bundler: string | undefined;
    framework: import("@umijs/core/dist/types").IFrameworkType | undefined;
    umi: {
        version: any;
    };
    bundleStatus: {
        done: boolean;
    };
} | {
    bundler: string | undefined;
    framework: import("@umijs/core/dist/types").IFrameworkType | undefined;
    umi: {
        version: any;
    };
    bundleStatus: {
        done: boolean;
    };
    userConfig: {
        hash: boolean | undefined;
        history: {
            type: string;
        } | undefined;
        mfsu: boolean | undefined;
        ssr: boolean | undefined;
        vite: boolean | undefined;
        utoopack: boolean | undefined;
    };
    config: {
        hash: boolean | undefined;
        history: {
            type: string;
        } | undefined;
        mfsu: boolean | undefined;
        ssr: boolean | undefined;
        vite: boolean | undefined;
        utoopack: boolean | undefined;
    };
    routes: {
        [k: string]: {
            id: string;
            parentId: string | undefined;
            name: string | undefined;
            path: string;
            absPath: string;
            redirect: string | undefined;
            isLayout: boolean;
            file: string | undefined;
        };
    };
    plugins: {
        [k: string]: {
            key: string;
            time: {
                register: number;
                hooks: {
                    [k: string]: number[];
                };
            };
        };
    };
    prepare: {
        buildResult: {
            metafile: {
                inputs: {
                    [k: string]: {
                        imports: {
                            path: string;
                        }[];
                    };
                };
            } | undefined;
        };
    };
    ui: {
        modules: {
            name: string;
            menus: {
                path: string;
                name: string;
                icon: string;
                url: string;
            }[] | undefined;
        }[];
    };
};
