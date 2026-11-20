import { describe, expect, it } from 'vitest';
import { validateSchema } from '@/utils/validateSchema';

describe('validateSchema', () => {
  it('合法 Schema 通过', () => {
    expect(
      validateSchema({ formKey: 'demo', title: '演示', columns: [{ dataIndex: 'a' }] }).ok,
    ).toBe(true);
  });

  it('非对象/空列被拒绝', () => {
    expect(validateSchema(null).ok).toBe(false);
    expect(validateSchema([]).ok).toBe(false);
    expect(validateSchema({ formKey: '', columns: [] }).errors).toHaveLength(2);
  });

  it('columns 含非对象项被拒绝', () => {
    const result = validateSchema({ formKey: 'demo', columns: [1] });
    expect(result.ok).toBe(false);
    expect(result.errors.join()).toContain('对象');
  });
});
