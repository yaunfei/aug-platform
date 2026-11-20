import { describe, expect, it } from 'vitest';
import { diffStat, jsonDiff } from '@/utils/jsonDiff';

describe('jsonDiff', () => {
  it('相同文本全部 equal', () => {
    const lines = jsonDiff('a\nb', 'a\nb');
    expect(lines.every((line) => line.type === 'equal')).toBe(true);
    expect(diffStat(lines)).toEqual({ added: 0, removed: 0 });
  });

  it('标记新增与删除并保留行号', () => {
    const lines = jsonDiff('a\nb\nc', 'a\nx\nc');
    expect(lines.map((line) => line.type)).toEqual(['equal', 'remove', 'add', 'equal']);
    expect(lines[1].text).toBe('b');
    expect(lines[1].oldLine).toBe(2);
    expect(lines[2].text).toBe('x');
    expect(lines[2].newLine).toBe(2);
    expect(diffStat(lines)).toEqual({ added: 1, removed: 1 });
  });

  it('对象自动 JSON 化对比', () => {
    const lines = jsonDiff({ a: 1 }, { a: 2 });
    expect(diffStat(lines).removed).toBe(1);
    expect(diffStat(lines).added).toBe(1);
  });
});
