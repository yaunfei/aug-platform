export interface ValidateResult {
  ok: boolean;
  errors: string[];
}

/**
 * 前端二次轻校验：非空对象 + formKey 字符串 + columns 非空对象数组。
 * 完整契约以后端校验为准，这里只防白屏与明显错误。
 */
export function validateSchema(schema: unknown): ValidateResult {
  const errors: string[] = [];
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return { ok: false, errors: ['Schema 必须是非空 JSON 对象'] };
  }
  const value = schema as Record<string, unknown>;
  if (typeof value.formKey !== 'string' || !value.formKey.trim()) {
    errors.push('formKey 必须是非空字符串');
  }
  if (!Array.isArray(value.columns) || value.columns.length === 0) {
    errors.push('columns 必须是非空数组');
  } else if (value.columns.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) {
    errors.push('columns 每一项必须是对象');
  }
  if (value.title !== undefined && typeof value.title !== 'string') {
    errors.push('title 必须是字符串');
  }
  return { ok: errors.length === 0, errors };
}
