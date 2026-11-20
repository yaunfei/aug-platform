export type DiffType = 'equal' | 'add' | 'remove';

export interface DiffLine {
  type: DiffType;
  text: string;
  oldLine?: number;
  newLine?: number;
}

function toLines(value: unknown): string[] {
  if (typeof value === 'string') return value.split('\n');
  return JSON.stringify(value, null, 2).split('\n');
}

/**
 * 零依赖 LCS 行级 diff，用于版本 JSON 对比（红绿高亮）。
 * 对超大文本退化为“整体删除 + 整体新增”，避免 O(n*m) 内存膨胀。
 */
export function jsonDiff(oldValue: unknown, newValue: unknown): DiffLine[] {
  const oldLines = toLines(oldValue);
  const newLines = toLines(newValue);
  const n = oldLines.length;
  const m = newLines.length;

  if (n * m > 4_000_000) {
    return [
      ...oldLines.map((text, i) => ({ type: 'remove' as const, text, oldLine: i + 1 })),
      ...newLines.map((text, i) => ({ type: 'add' as const, text, newLine: i + 1 })),
    ];
  }

  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] =
        oldLines[i] === newLines[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (oldLines[i] === newLines[j]) {
      result.push({ type: 'equal', text: oldLines[i], oldLine: i + 1, newLine: j + 1 });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ type: 'remove', text: oldLines[i], oldLine: i + 1 });
      i += 1;
    } else {
      result.push({ type: 'add', text: newLines[j], newLine: j + 1 });
      j += 1;
    }
  }
  while (i < n) {
    result.push({ type: 'remove', text: oldLines[i], oldLine: i + 1 });
    i += 1;
  }
  while (j < m) {
    result.push({ type: 'add', text: newLines[j], newLine: j + 1 });
    j += 1;
  }
  return result;
}

export function diffStat(lines: DiffLine[]): { added: number; removed: number } {
  return lines.reduce(
    (acc, line) => {
      if (line.type === 'add') acc.added += 1;
      if (line.type === 'remove') acc.removed += 1;
      return acc;
    },
    { added: 0, removed: 0 },
  );
}
