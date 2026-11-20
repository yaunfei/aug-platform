import type { ColumnSchema, FormSchema } from '@/types/schema';

interface FieldInfo {
  key: string;
  dataIndex: string;
  title: string;
  valueType: string;
  required: boolean;
  enumSignature: string;
}

function enumSignature(column: ColumnSchema): string {
  if (!column.valueEnum) return '';
  return Object.keys(column.valueEnum).sort().join(',');
}

function collectFields(columns: ColumnSchema[] | undefined, prefix: string, out: FieldInfo[]): void {
  for (const column of columns || []) {
    if (!column || column.valueType === 'divider') continue;
    const key = `${prefix}${column.dataIndex}`;
    if (column.valueType === 'group') {
      collectFields(column.columns, `${key}.`, out);
      continue;
    }
    const required = Boolean(
      (column.formItemProps?.rules || []).some((rule) => rule.required),
    );
    out.push({
      key,
      dataIndex: column.dataIndex,
      title: column.title || column.dataIndex,
      valueType: column.valueType,
      required,
      enumSignature: enumSignature(column),
    });
  }
}

function humanType(valueType: string): string {
  const labels: Record<string, string> = {
    text: '短文本',
    textarea: '长文本',
    select: '下拉单选',
    radio: '单选',
    checkbox: '多选',
    date: '日期',
    dateTime: '日期时间',
    dateRange: '日期区间',
    digit: '数字',
    money: '金额',
    switch: '开关',
    formList: '明细列表',
  };
  return labels[valueType] || valueType;
}

/**
 * 字段级变更摘要：added / removed / changed / titleChanged → 人类可读文本。
 * oldSchema 为 null 时视为全部新增（首次生成）。
 */
export function summarizeSchemaDiff(
  oldSchema: FormSchema | null | undefined,
  newSchema: FormSchema | null | undefined,
): string {
  if (!newSchema) return '未返回可用 Schema';
  const nextFields: FieldInfo[] = [];
  collectFields(newSchema.columns, '', nextFields);

  if (!oldSchema) {
    if (!nextFields.length) return '生成了空 Schema';
    const names = nextFields.map((field) => `「${field.title}」`).join('、');
    return `全新增 ${nextFields.length} 个字段：${names}`;
  }

  const prevFields: FieldInfo[] = [];
  collectFields(oldSchema.columns, '', prevFields);
  const prevMap = new Map(prevFields.map((field) => [field.key, field]));
  const nextMap = new Map(nextFields.map((field) => [field.key, field]));

  const parts: string[] = [];
  const added = nextFields.filter((field) => !prevMap.has(field.key));
  const removed = prevFields.filter((field) => !nextMap.has(field.key));
  if (added.length) {
    parts.push(`新增字段：${added.map((f) => `「${f.title}」(${f.dataIndex})`).join('、')}`);
  }
  if (removed.length) {
    parts.push(`删除字段：${removed.map((f) => `「${f.title}」(${f.dataIndex})`).join('、')}`);
  }

  const titleChanged: string[] = [];
  const typeChanged: string[] = [];
  const requiredChanged: string[] = [];
  const enumChanged: string[] = [];
  for (const field of nextFields) {
    const prev = prevMap.get(field.key);
    if (!prev) continue;
    if (prev.title !== field.title) {
      titleChanged.push(`「${prev.title}」→「${field.title}」`);
    }
    if (prev.valueType !== field.valueType) {
      typeChanged.push(
        `「${field.title}」${humanType(prev.valueType)} → ${humanType(field.valueType)}`,
      );
    }
    if (prev.required !== field.required) {
      requiredChanged.push(`「${field.title}」${field.required ? '改为必填' : '改为非必填'}`);
    }
    if (prev.enumSignature !== field.enumSignature) {
      enumChanged.push(`「${field.title}」选项变更`);
    }
  }
  if (titleChanged.length) parts.push(`重命名字段：${titleChanged.join('、')}`);
  if (typeChanged.length) parts.push(`修改组件类型：${typeChanged.join('、')}`);
  if (requiredChanged.length) parts.push(`调整必填：${requiredChanged.join('、')}`);
  if (enumChanged.length) parts.push(`调整选项：${enumChanged.join('、')}`);

  if ((oldSchema.title || '') !== (newSchema.title || '')) {
    parts.push(`表单标题：「${oldSchema.title || ''}」→「${newSchema.title || ''}」`);
  }

  return parts.length ? parts.join('；') : '字段无变化';
}
