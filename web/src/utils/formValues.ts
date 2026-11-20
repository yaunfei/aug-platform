import dayjs, { type Dayjs } from 'dayjs';
import type { ColumnSchema, FormSchema } from '@/types/schema';

const DATE_TYPES = new Set([
  'date',
  'dateTime',
  'dateWeek',
  'dateMonth',
  'dateQuarter',
  'dateYear',
  'time',
  'fromNow',
  'dateTimeRange',
  'dateWeekRange',
  'dateMonthRange',
  'dateQuarterRange',
  'dateYearRange',
  'timeRange',
]);

const RANGE_TYPES = new Set([
  'dateRange',
  'dateTimeRange',
  'dateWeekRange',
  'dateMonthRange',
  'dateQuarterRange',
  'dateYearRange',
  'timeRange',
  'digitRange',
]);

/** 表单值 → 可提交 JSON：dayjs 转 ISO 字符串。 */
export function serializeFormValues(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (dayjs.isDayjs(value)) return (value as Dayjs).toISOString();
  if (Array.isArray(value)) return value.map((item) => serializeFormValues(item));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        serializeFormValues(item),
      ]),
    );
  }
  return value;
}

/** 记录数据 → 表单初始值：按 valueType 把 ISO 字符串还原为 dayjs。 */
export function buildInitialValues(
  schema: FormSchema | null | undefined,
  data: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!schema || !data) return {};
  const convert = (columns: ColumnSchema[] | undefined, source: Record<string, unknown>) => {
    const out: Record<string, unknown> = { ...source };
    (columns || []).forEach((column) => {
      const value = source?.[column.dataIndex];
      if (value === undefined || value === null) return;
      if (column.valueType === 'group' && column.columns) {
        Object.assign(out, convert(column.columns, value as Record<string, unknown>));
        return;
      }
      if (column.valueType === 'formList' && Array.isArray(value)) {
        out[column.dataIndex] = value.map((row) =>
          convert(column.columns, (row || {}) as Record<string, unknown>),
        );
        return;
      }
      if (DATE_TYPES.has(column.valueType)) {
        if (RANGE_TYPES.has(column.valueType) && Array.isArray(value)) {
          out[column.dataIndex] = value.map((item) => (item ? dayjs(item as string) : null));
        } else {
          out[column.dataIndex] = dayjs(value as string);
        }
      }
    });
    return out;
  };
  return convert(schema.columns, data);
}

/** 记录 data 展平到顶层，供 ProTable/ProDescriptions 使用。 */
export function flattenRecord(record: {
  id?: number;
  formKey?: string;
  schemaVersion?: number;
  data?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string | null;
}): Record<string, unknown> {
  return {
    ...(record.data || {}),
    id: record.id,
    formKey: record.formKey,
    schemaVersion: record.schemaVersion,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    createdBy: record.createdBy,
  };
}

/** 从展平记录中提取 Schema 内定义的字段（用于编辑回填）。 */
export function pickSchemaData(
  schema: FormSchema | null | undefined,
  flat: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const collect = (columns: ColumnSchema[] | undefined) => {
    (columns || []).forEach((column) => {
      if (column.valueType === 'divider') return;
      if (flat[column.dataIndex] !== undefined) out[column.dataIndex] = flat[column.dataIndex];
      if (column.valueType === 'group' && column.columns) collect(column.columns);
    });
  };
  collect(schema?.columns);
  return out;
}
