import type { ColumnSchema } from '@/types/schema';

export type EditorColumn = ColumnSchema & { _uid: string };

export const CONTAINER_TYPES = new Set(['group', 'formList']);
export const TABLE_ONLY_TYPES = new Set(['index', 'indexBorder', 'option']);

let uidSeed = 0;

export function nextUid(): string {
  uidSeed += 1;
  return `col_${uidSeed}`;
}

export function isContainer(column: Pick<ColumnSchema, 'valueType'> | null | undefined): boolean {
  return Boolean(column && CONTAINER_TYPES.has(column.valueType));
}

export function cloneColumns<T>(columns: T[]): T[] {
  return JSON.parse(JSON.stringify(columns)) as T[];
}

export function ensureUids(columns: ColumnSchema[] | undefined): EditorColumn[] {
  return (columns || []).map((column) => ({
    ...column,
    _uid: column._uid || nextUid(),
    columns: column.columns ? ensureUids(column.columns) : undefined,
  }));
}

export function stripUids(columns: EditorColumn[] | undefined): ColumnSchema[] {
  return (columns || []).map(({ _uid, columns: children, ...rest }) => ({
    ...rest,
    ...(children ? { columns: stripUids(children as EditorColumn[]) } : {}),
  }));
}

/** 递归展平（仅用于统计/查找，不改变结构）。 */
export function flattenEditorColumns(
  columns: EditorColumn[],
  depth = 0,
): Array<{ column: EditorColumn; depth: number; parentUid: string | null }> {
  const out: Array<{ column: EditorColumn; depth: number; parentUid: string | null }> = [];
  const walk = (list: EditorColumn[], level: number, parentUid: string | null) => {
    list.forEach((column) => {
      out.push({ column, depth: level, parentUid });
      if (column.columns) walk(column.columns as EditorColumn[], level + 1, column._uid);
    });
  };
  walk(columns, depth, null);
  return out;
}

export interface LocatedColumn {
  column: EditorColumn;
  list: EditorColumn[];
  index: number;
  parentUid: string | null;
}

export function locateColumn(columns: EditorColumn[], uid: string): LocatedColumn | null {
  const walk = (list: EditorColumn[], parentUid: string | null): LocatedColumn | null => {
    for (let index = 0; index < list.length; index += 1) {
      const column = list[index];
      if (column._uid === uid) return { column, list, index, parentUid };
      if (column.columns) {
        const found = walk(column.columns as EditorColumn[], column._uid);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(columns, null);
}

export function findColumn(columns: EditorColumn[], uid: string): EditorColumn | null {
  return locateColumn(columns, uid)?.column || null;
}

function removeByUid(list: EditorColumn[], uid: string): EditorColumn | null {
  for (let index = 0; index < list.length; index += 1) {
    const column = list[index];
    if (column._uid === uid) {
      list.splice(index, 1);
      return column;
    }
    if (column.columns) {
      const removed = removeByUid(column.columns as EditorColumn[], uid);
      if (removed) return removed;
    }
  }
  return null;
}

function parseDropId(overId: string): { kind: 'field' | 'container' | 'container-drop'; uid: string } {
  if (overId.startsWith('container-drop:')) {
    return { kind: 'container-drop', uid: overId.slice('container-drop:'.length) };
  }
  if (overId.startsWith('container:')) {
    return { kind: 'container', uid: overId.slice('container:'.length) };
  }
  if (overId.startsWith('field:')) {
    return { kind: 'field', uid: overId.slice('field:'.length) };
  }
  return { kind: 'field', uid: overId };
}

/**
 * 拖拽落点计算（纯函数）：
 * - 容器（group/formList）只能存在于顶层，禁止拖入容器；
 * - 普通字段可拖入容器或顶层；
 * - overId 支持 field:<uid> / container:<uid> / container-drop:<uid>。
 */
export function moveColumn(
  columns: EditorColumn[],
  activeId: string,
  overId: string,
): EditorColumn[] {
  if (!activeId || !overId || activeId === overId) return columns;
  const next = cloneColumns(columns);
  const active = locateColumn(next, activeId);
  if (!active) return columns;
  const moving = active.column;
  const target = parseDropId(overId);

  if (isContainer(moving)) {
    // 容器只能在顶层排序，禁止拖入任何容器节点/容器放置区
    if (target.kind === 'container-drop' || target.kind === 'container') return columns;
    const targetLoc = locateColumn(next, target.uid);
    if (!targetLoc || targetLoc.parentUid !== null) return columns;
    removeByUid(next, activeId);
    const after = locateColumn(next, target.uid);
    if (!after) return columns;
    next.splice(after.index, 0, moving);
    return next;
  }

  removeByUid(next, activeId);

  if (target.kind === 'container' || target.kind === 'container-drop') {
    const container = findColumn(next, target.uid);
    if (!container || !isContainer(container)) return columns;
    const children = (container.columns || []) as EditorColumn[];
    container.columns = [...children, moving];
    return next;
  }

  const after = locateColumn(next, target.uid);
  if (!after) return columns;
  after.list.splice(after.index, 0, moving);
  return next;
}

/** 全表单命名空间：顶层 + group 子列 + formList 自身（不含 formList 子列）。 */
export function collectGlobalDataIndexes(
  columns: EditorColumn[],
  excludeUid?: string,
): string[] {
  const out: string[] = [];
  const walk = (list: EditorColumn[]) => {
    list.forEach((column) => {
      if (column._uid === excludeUid) return;
      out.push(column.dataIndex);
      if (column.valueType === 'group' && column.columns) {
        walk(column.columns as EditorColumn[]);
      }
    });
  };
  walk(columns);
  return out;
}

/** formList 子列的独立命名空间。 */
export function collectListDataIndexes(
  listColumn: EditorColumn,
  excludeUid?: string,
): string[] {
  const out: string[] = [];
  const walk = (list: EditorColumn[]) => {
    list.forEach((column) => {
      if (column._uid === excludeUid) return;
      out.push(column.dataIndex);
      if (column.columns) walk(column.columns as EditorColumn[]);
    });
  };
  walk((listColumn.columns || []) as EditorColumn[]);
  return out;
}

/** 根据父容器返回应当查重的命名空间。 */
export function namespaceDataIndexes(
  columns: EditorColumn[],
  parentUid: string | null,
  excludeUid?: string,
): string[] {
  if (!parentUid) return collectGlobalDataIndexes(columns, excludeUid);
  const parent = findColumn(columns, parentUid);
  if (!parent) return collectGlobalDataIndexes(columns, excludeUid);
  if (parent.valueType === 'formList') {
    return collectListDataIndexes(parent, excludeUid);
  }
  return collectGlobalDataIndexes(columns, excludeUid);
}

export function countLeafFields(columns: EditorColumn[]): number {
  return flattenEditorColumns(columns).filter(({ column }) => !isContainer(column) && column.valueType !== 'divider').length;
}
