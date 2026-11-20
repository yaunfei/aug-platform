import * as Babel from '@umijs/bundler-utils/compiled/babel/core';
import * as t from '@umijs/bundler-utils/compiled/babel/types';
import { type TransformResult } from '@umijs/bundler-utils/compiled/esbuild';
import { IApi } from 'umi';
export declare function transformSync(content: any, opts: any): TransformResult<any>;
interface IOpts {
    contentTest?: (content: string) => Boolean;
    astTest?: (opts: {
        node: t.Node;
        content: string;
    }) => Boolean;
}
export declare function getNamespace(absFilePath: string, absSrcPath: string): string;
/**
 * Resolve namespace from object properties in declaration order.
 * Later explicit `namespace` overrides earlier ones.
 * If a spread appears after an explicit namespace, the final value cannot be
 * determined statically — return undefined so callers fall back to path naming.
 */
export declare function getNamespaceFromObjectExpression(node: t.ObjectExpression): string | undefined;
/**
 * Extract namespace from an export AST node.
 * Supports:
 * - object model: `export default { namespace: 'foo' }`
 * - hook/factory return: `export default () => ({ namespace: 'foo' })`
 * - dva-model-extend: `export default extend(base, { namespace: 'foo' })`
 */
export declare function getNamespaceFromExportNode(node: t.Node, path: Babel.NodePath): string | undefined;
export declare function getNamespaceFromFile(file: string, exportName?: string): string | undefined;
export declare function getExtraModelFilePath(modelPath: string): string;
export declare class Model {
    file: string;
    namespace: string;
    id: string;
    exportName: string;
    deps: string[];
    constructor(file: string, absSrcPath: string, sort: {} | undefined, id: number, opts?: {
        preferSourceNamespace?: boolean;
    });
    findDeps(sort: object): string[];
}
export declare class ModelUtils {
    api: IApi;
    opts: IOpts;
    count: number;
    constructor(api: IApi | null, opts: IOpts);
    getAllModels(opts: {
        sort?: object;
        extraModels: string[];
        preferSourceNamespace?: boolean;
    }): Model[];
    getModels(opts: {
        base: string;
        pattern?: string;
    }): string[];
    isModelValid(opts: {
        content: string;
        file: string;
    }): boolean;
    static topologicalSort: (models: Model[]) => string[];
    static getModelsContent(models: Model[]): string;
}
export {};
