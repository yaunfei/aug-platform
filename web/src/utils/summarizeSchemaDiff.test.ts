import { describe, expect, it } from 'vitest';
import { summarizeSchemaDiff } from '@/utils/summarizeSchemaDiff';
import type { FormSchema } from '@/types/schema';

const base: FormSchema = {
  formKey: 'demo',
  title: '演示',
  columns: [
    { dataIndex: 'name', title: '姓名', valueType: 'text', formItemProps: { rules: [{ required: true }] } },
    { dataIndex: 'phone', title: '电话', valueType: 'text' },
    { dataIndex: 'level', title: '级别', valueType: 'select', valueEnum: { a: { text: 'A' } } },
  ],
};

describe('summarizeSchemaDiff', () => {
  it('oldSchema 为 null 时全新增', () => {
    const text = summarizeSchemaDiff(null, base);
    expect(text).toContain('全新增 3 个字段');
    expect(text).toContain('姓名');
  });

  it('识别新增/删除/改名/必填/枚举变更', () => {
    const next: FormSchema = {
      ...base,
      title: '演示二',
      columns: [
        { dataIndex: 'name', title: '姓名（必填）', valueType: 'text', formItemProps: { rules: [{ required: true }] } },
        { dataIndex: 'email', title: '邮箱', valueType: 'text' },
        { dataIndex: 'level', title: '级别', valueType: 'select', valueEnum: { a: { text: 'A' }, b: { text: 'B' } } },
      ],
    };
    const text = summarizeSchemaDiff(base, next);
    expect(text).toContain('新增字段');
    expect(text).toContain('邮箱');
    expect(text).toContain('删除字段');
    expect(text).toContain('电话');
    expect(text).toContain('重命名字段');
    expect(text).toContain('调整选项');
    expect(text).toContain('表单标题');
  });

  it('无变化时返回提示', () => {
    expect(summarizeSchemaDiff(base, base)).toBe('字段无变化');
  });
});
