import { describe, expect, it } from 'vitest';
import {
  hydrateColumns,
  registerComponents,
  resetRegisteredComponents,
} from '@/utils/hydrateColumns';
import type { ComponentMeta } from '@/types/schema';

const baseColumns = [
  { dataIndex: 'name', title: '姓名', valueType: 'text' },
  {
    dataIndex: 'level',
    title: '级别',
    valueType: 'select',
    valueEnum: { p0: { text: '致命' }, p1: { text: '严重' } },
  },
  { dataIndex: 'amount', title: '金额', valueType: 'money' },
];

describe('hydrateColumns', () => {
  it('table 模式除操作列/dateRange render 外原样透传', () => {
    const input = [
      ...baseColumns,
      { dataIndex: 'occur_range', title: '发生时间', valueType: 'dateRange' },
    ];
    const out = hydrateColumns(input as any, { mode: 'table' });
    expect(out[0]).toEqual(input[0]);
    expect(out[1]).toEqual(input[1]);
    expect(out[2]).toEqual(input[2]);
    const range = out[3] as any;
    expect(range.hideInSearch).toBe(true);
    expect(typeof range.render).toBe('function');
    const { render: _render, ...rest } = range;
    expect(rest).toEqual({ ...input[3], hideInSearch: true });
    expect(out[4].title).toBe('操作');
    expect(out[4].valueType).toBe('option');
  });

  it('form 模式保留布局嵌套并过滤 hideInForm 子列', () => {
    const input = [
      {
        dataIndex: 'base',
        title: '基本信息',
        valueType: 'group',
        columns: [
          { dataIndex: 'name', title: '姓名', valueType: 'text' },
          { dataIndex: 'secret', title: '隐藏', valueType: 'text', hideInForm: true },
        ],
      },
      {
        dataIndex: 'items',
        title: '明细',
        valueType: 'formList',
        columns: [{ dataIndex: 'sku', title: 'SKU', valueType: 'text' }],
      },
    ];
    const [group, list] = hydrateColumns(input as any, { mode: 'form' }) as any[];
    expect(group.valueType).toBe('group');
    expect(group.columns).toHaveLength(1);
    expect(group.columns[0].dataIndex).toBe('name');
    expect(list.valueType).toBe('formList');
    expect(list.columns[0].dataIndex).toBe('sku');
  });

  it('table 模式展平 group、丢弃 divider、formList 降级为条数', () => {
    const input = [
      {
        dataIndex: 'base',
        title: '基本信息',
        valueType: 'group',
        columns: [{ dataIndex: 'name', title: '姓名', valueType: 'text' }],
      },
      { dataIndex: 'line', title: '分隔', valueType: 'divider' },
      {
        dataIndex: 'items',
        title: '明细',
        valueType: 'formList',
        columns: [{ dataIndex: 'sku', title: 'SKU', valueType: 'text' }],
      },
    ];
    const out = hydrateColumns(input as any, { mode: 'table' }) as any[];
    expect(out.map((column) => column.dataIndex)).toEqual(['name', 'items', 'operation']);
    const list = out[1];
    expect(list.valueType).toBe('text');
    expect(list.render(undefined, { items: [{}, {}] })).toBe('共 2 条');
  });

  it('custom 组件改写 valueType=text 并注入渲染器', () => {
    const meta: ComponentMeta = {
      valueType: 'phone',
      label: '手机号',
      custom: true,
      frontendRenderer: 'phone',
      requiresValueEnum: false,
      layout: false,
      childrenPolicy: 'forbidden',
      allowedFieldProps: ['placeholder'],
    };
    registerComponents([meta]);
    const out = hydrateColumns(
      [{ dataIndex: 'phone', title: '电话', valueType: 'phone' }] as any,
      { mode: 'table' },
    ) as any[];
    expect(out[0].valueType).toBe('text');
    expect(typeof out[0].render).toBe('function');
    resetRegisteredComponents();
  });

  it('未注册 valueType 降级 text 且不白屏', () => {
    const warnings: string[] = [];
    const out = hydrateColumns(
      [{ dataIndex: 'x', title: '未知', valueType: 'not_exist' }] as any,
      { mode: 'table', warn: (message) => warnings.push(message) },
    ) as any[];
    expect(out[0].valueType).toBe('text');
    expect(warnings[0]).toContain('降级为 text');
  });

  it('form 模式数值规则补 type=number 与 transform', () => {
    const out = hydrateColumns(
      [
        {
          dataIndex: 'amount',
          title: '金额',
          valueType: 'money',
          formItemProps: {
            rules: [
              { required: true, message: '必填' },
              { min: 0, max: 1000 },
              { pattern: '^\\d+$', message: '数字' },
            ],
          },
        },
      ] as any,
      { mode: 'form' },
    ) as any[];
    const rules = out[0].formItemProps.rules;
    expect(rules[0].type).toBeUndefined();
    expect(rules[1].type).toBe('number');
    expect(typeof rules[2].transform).toBe('function');
    expect(rules[2].transform(12)).toBe('12');
  });

  it('非法 pattern 被剔除并告警', () => {
    const warnings: string[] = [];
    const out = hydrateColumns(
      [
        {
          dataIndex: 'amount',
          title: '金额',
          valueType: 'digit',
          formItemProps: { rules: [{ pattern: '[', message: 'bad' }] },
        },
      ] as any,
      { mode: 'form', warn: (message) => warnings.push(message) },
    ) as any[];
    expect(out[0].formItemProps.rules[0].pattern).toBeUndefined();
    expect(warnings.join()).toContain('pattern');
  });

  it('checkbox 在 table 模式 hideInSearch', () => {
    const out = hydrateColumns(
      [{ dataIndex: 'tags', title: '标签', valueType: 'checkbox', valueEnum: { a: { text: 'A' } } }] as any,
      { mode: 'table' },
    ) as any[];
    expect(out[0].hideInSearch).toBe(true);
  });
});
