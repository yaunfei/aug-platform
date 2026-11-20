import { describe, expect, it } from 'vitest';
import {
  collectGlobalDataIndexes,
  collectListDataIndexes,
  ensureUids,
  findColumn,
  moveColumn,
  namespaceDataIndexes,
  stripUids,
} from '@/components/VisualEditor/columnTreeUtils';

function buildColumns() {
  return ensureUids([
    { dataIndex: 'name', title: '姓名', valueType: 'text' },
    {
      dataIndex: 'base',
      title: '基本信息',
      valueType: 'group',
      columns: [{ dataIndex: 'age', title: '年龄', valueType: 'digit' }],
    },
    {
      dataIndex: 'items',
      title: '明细',
      valueType: 'formList',
      columns: [{ dataIndex: 'sku', title: 'SKU', valueType: 'text' }],
    },
  ]);
}

describe('columnTreeUtils', () => {
  it('ensureUids/stripUids 往返还原', () => {
    const columns = buildColumns();
    const stripped = stripUids(columns);
    expect(JSON.stringify(stripped)).not.toContain('_uid');
    expect(stripped[0]).toEqual({ dataIndex: 'name', title: '姓名', valueType: 'text' });
  });

  it('全表单命名空间包含 group 子列但不含 formList 子列', () => {
    const columns = buildColumns();
    const names = collectGlobalDataIndexes(columns);
    expect(names).toEqual(expect.arrayContaining(['name', 'base', 'age', 'items']));
    expect(names).not.toContain('sku');
    const list = findColumn(columns, columns[2]._uid)!;
    expect(collectListDataIndexes(list)).toEqual(['sku']);
  });

  it('formList 子列使用独立命名空间', () => {
    const columns = buildColumns();
    const list = columns[2];
    expect(namespaceDataIndexes(columns, list._uid)).toEqual(['sku']);
    expect(namespaceDataIndexes(columns, null)).not.toContain('sku');
  });

  it('顶层字段可拖入容器，容器不能拖入容器', () => {
    const columns = buildColumns();
    const group = columns[1];
    const top = columns[0];
    const moved = moveColumn(columns, top._uid, `container:${group._uid}`);
    expect(findColumn(moved, top._uid)!.dataIndex).toBe('name');
    expect((findColumn(moved, group._uid)!.columns || []).map((item: any) => item.dataIndex)).toContain(
      'name',
    );

    const list = moved.find((item) => item.valueType === 'formList')!;
    const unchanged = moveColumn(moved, list._uid, `container:${group._uid}`);
    expect(unchanged).toBe(moved);
  });

  it('字段可跨容器移动到指定字段位置', () => {
    const columns = buildColumns();
    const list = columns[2];
    const sku = (list.columns as any[])[0];
    const moved = moveColumn(columns, sku._uid, columns[0]._uid);
    expect(collectGlobalDataIndexes(moved)).toContain('sku');
  });
});
