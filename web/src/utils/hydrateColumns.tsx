import type { ProColumns } from '@ant-design/pro-components';
import { Popconfirm, Space } from 'antd';
import React from 'react';
import type { ColumnSchema, ComponentMeta, FormRecord } from '@/types/schema';
import { CUSTOM_RENDERERS } from '@/components/customRenderers';

export type RenderMode = 'form' | 'table' | 'detail';

export const BASE_VALUE_TYPES = [
  'text',
  'textarea',
  'select',
  'radio',
  'checkbox',
  'date',
  'dateTime',
  'dateRange',
  'digit',
  'money',
  'switch',
];

const NUMERIC_TYPES = new Set([
  'digit',
  'money',
  'percent',
  'slider',
  'rate',
  'second',
  'progress',
]);

const LAYOUT_TYPES = new Set(['group', 'divider', 'formList']);

const VALUE_TYPE_WHITELIST = new Set<string>(BASE_VALUE_TYPES);

let COMPONENT_META: Record<string, ComponentMeta> = {};

export function warnDefault(message: string): void {
  // eslint-disable-next-line no-console
  console.warn(`[hydrateColumns] ${message}`);
}

/** app.ts 启动时按注册表动态扩容白名单；custom 组件须有前端渲染器才放行。 */
export function registerComponents(components: ComponentMeta[]): void {
  const next: Record<string, ComponentMeta> = {};
  components.forEach((meta) => {
    next[meta.valueType] = meta;
    if (meta.custom) {
      if (meta.frontendRenderer && CUSTOM_RENDERERS[meta.frontendRenderer]) {
        VALUE_TYPE_WHITELIST.add(meta.valueType);
      } else {
        warnDefault(`custom 组件 ${meta.valueType} 缺少前端渲染器，降级为 text`);
      }
    } else {
      VALUE_TYPE_WHITELIST.add(meta.valueType);
    }
  });
  COMPONENT_META = next;
}

/** 测试用：恢复初始白名单。 */
export function resetRegisteredComponents(): void {
  COMPONENT_META = {};
  VALUE_TYPE_WHITELIST.clear();
  BASE_VALUE_TYPES.forEach((type) => VALUE_TYPE_WHITELIST.add(type));
}

export function isValueTypeAllowed(valueType: string): boolean {
  return VALUE_TYPE_WHITELIST.has(valueType);
}

export function getComponentMeta(valueType: string): ComponentMeta | undefined {
  return COMPONENT_META[valueType];
}

export function registeredComponents(): ComponentMeta[] {
  return Object.values(COMPONENT_META);
}

export function formatDateRange(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return value ? String(value) : '-';
  const text = value
    .map((item) => (item === null || item === undefined || item === '' ? '—' : String(item)))
    .join(' ~ ');
  return text || '-';
}

interface HydrateOptions {
  mode: RenderMode;
  showActions?: boolean;
  onDetail?: (record: Record<string, unknown>) => void;
  onEdit?: (record: Record<string, unknown>) => void;
  onDelete?: (record: Record<string, unknown>) => void;
  warn?: (message: string) => void;
}

type AnyColumn = ColumnSchema & Record<string, unknown>;

function preprocessLayout(
  columns: AnyColumn[],
  mode: RenderMode,
  warn: (message: string) => void,
): AnyColumn[] {
  const result: AnyColumn[] = [];
  (columns || []).forEach((column) => {
    if (!column) return;
    if (column.valueType === 'divider') {
      if (mode === 'form') result.push({ ...column });
      return;
    }
    if (column.valueType === 'group') {
      const children = preprocessLayout((column.columns || []) as AnyColumn[], mode, warn);
      if (mode === 'form') {
        result.push({
          ...column,
          columns: children.filter((child) => !child.hideInForm),
        });
      } else {
        result.push(...children);
      }
      return;
    }
    if (column.valueType === 'formList') {
      if (mode === 'form') {
        const children = preprocessLayout((column.columns || []) as AnyColumn[], mode, warn);
        result.push({
          ...column,
          columns: children.filter((child) => !child.hideInForm),
        });
      } else {
        result.push({
          ...column,
          valueType: 'text',
          hideInSearch: true,
          render: (_dom: unknown, record: Record<string, unknown>) => {
            const rows = record?.[column.dataIndex];
            const count = Array.isArray(rows) ? rows.length : 0;
            return `共 ${count} 条`;
          },
        });
      }
      return;
    }
    if (column.columns) {
      warn(`字段 ${column.dataIndex} 非布局组件却携带 columns，已忽略其子列`);
      const { columns: _ignored, ...rest } = column;
      result.push(rest);
      return;
    }
    result.push({ ...column });
  });
  return result;
}

function normalizeNumericRules(
  column: AnyColumn,
  warn: (message: string) => void,
): AnyColumn {
  const rules = column.formItemProps?.rules;
  if (!Array.isArray(rules) || !rules.length) return column;
  const nextRules = rules.map((rawRule) => {
    const rule: Record<string, unknown> = { ...rawRule };
    if (typeof rule.pattern === 'string' && rule.pattern) {
      try {
        // eslint-disable-next-line no-new
        new RegExp(rule.pattern);
      } catch {
        warn(`字段 ${column.dataIndex} 的 pattern 无法编译，已剔除`);
        delete rule.pattern;
      }
    }
    if (rule.pattern !== undefined || rule.len !== undefined) {
      rule.transform = (value: unknown) => String(value);
    }
    if (rule.min !== undefined || rule.max !== undefined) {
      rule.type = 'number';
    }
    return rule;
  });
  return {
    ...column,
    formItemProps: { ...column.formItemProps, rules: nextRules },
  };
}

function hydrateColumn(
  column: AnyColumn,
  options: HydrateOptions,
  warn: (message: string) => void,
): AnyColumn {
  let result: AnyColumn = { ...column };
  if (column.columns) {
    result.columns = (column.columns as AnyColumn[]).map((child) =>
      hydrateColumn(child, options, warn),
    );
  }

  const valueType = column.valueType;
  const meta = COMPONENT_META[valueType];

  if (meta?.custom) {
    const renderer = meta.frontendRenderer ? CUSTOM_RENDERERS[meta.frontendRenderer] : undefined;
    if (!renderer) {
      warn(`custom 组件 ${valueType} 缺少前端渲染器，降级为 text`);
    }
    result.valueType = 'text';
    if (renderer?.render) result.render = renderer.render;
    if (options.mode === 'form' && renderer?.renderFormItem) {
      result.renderFormItem = renderer.renderFormItem;
    }
  } else if (!LAYOUT_TYPES.has(valueType) && !VALUE_TYPE_WHITELIST.has(valueType)) {
    warn(`未注册的 valueType：${valueType}，已降级为 text`);
    result.valueType = 'text';
  }

  if (valueType === 'dateRange' && options.mode !== 'form') {
    result.hideInSearch = true;
    result.render = (dom: unknown) => formatDateRange(dom);
  } else if (valueType === 'checkbox' && options.mode === 'table') {
    result.hideInSearch = true;
  }

  if (options.mode === 'form' && NUMERIC_TYPES.has(valueType)) {
    result = normalizeNumericRules(result, warn);
  }

  return result;
}

function buildActionColumn(options: HydrateOptions): AnyColumn {
  return {
    dataIndex: 'operation',
    title: '操作',
    valueType: 'option',
    width: 180,
    fixed: 'right',
    hideInSearch: true,
    render: (_dom: unknown, record: Record<string, unknown>) => {
      const actions: React.ReactNode[] = [];
      if (options.onDetail) {
        actions.push(
          <a key="detail" onClick={() => options.onDetail?.(record)}>
            详情
          </a>,
        );
      }
      if (options.onEdit) {
        actions.push(
          <a key="edit" onClick={() => options.onEdit?.(record)}>
            编辑
          </a>,
        );
      }
      if (options.onDelete) {
        actions.push(
          <Popconfirm
            key="delete"
            title="确定删除该记录？"
            description="删除后不可恢复"
            onConfirm={() => options.onDelete?.(record)}
          >
            <a style={{ color: '#ff4d4f' }}>删除</a>
          </Popconfirm>,
        );
      }
      return actions.length ? <Space size="middle">{actions}</Space> : '-';
    },
  };
}

/**
 * 动态渲染管线：后端 columns 已是 ProComponents 格式，这里只注入 JSON 表达不了的
 * 运行时部分（render / renderFormItem / 操作列 / 数值规则补全），其余字段原样透传。
 */
export function hydrateColumns(
  columns: ColumnSchema[] | undefined,
  options: HydrateOptions,
): ProColumns<Record<string, unknown>>[] {
  const warn = options.warn || warnDefault;
  const preprocessed = preprocessLayout((columns || []) as AnyColumn[], options.mode, warn);
  const result = preprocessed.map((column) => hydrateColumn(column, options, warn));
  if (options.mode === 'table' && options.showActions !== false) {
    result.push(buildActionColumn(options));
  }
  return result as unknown as ProColumns<Record<string, unknown>>[];
}

export type { FormRecord };
