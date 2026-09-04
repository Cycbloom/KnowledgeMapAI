import type { SparseVector } from '../../shared/types/ai';

/**
 * 稀疏向量工具：用于 pgvector sparsevec 列的读写。
 *
 * pgvector 的 sparsevec(N) 中 N 是**总维度数**（即最大索引值），而非零元素数量
 * 有独立硬上限 16000（SPARSEVEC_MAX_NNZ）。本工具：
 * - 序列化时输出显式维度 `{i:v,...}/1000000`，与列声明一致
 * - 归一化索引：若 provider 返回 0-based 索引（min index === 0）则 +1 转为 1-based
 *   （pgvector 要求索引从 1 开始）；1-based 数据原样保留
 * - 截断到 16000 个非零元素（按值降序保留 top），避免超上限写入失败
 */
export const SPARSE_DIM = 1_000_000;
const SPARSE_MAX_NNZ = 16000;

/** SparseVector（{index,value}[]）→ pgvector sparsevec 文本 */
export function serializeSparse(v: SparseVector): string {
  // 1. 归一化索引基线（0-based → 1-based）
  const minIndex = v.reduce(
    (min, item) => Math.min(min, item.index),
    Number.POSITIVE_INFINITY,
  );
  const offset = minIndex === 0 ? 1 : 0;

  // 2. 按值降序排序并截断到非零上限，同时去重索引
  const seen = new Set<number>();
  const entries: string[] = [];
  for (const item of [...v].sort((a, b) => b.value - a.value)) {
    const idx = item.index + offset;
    if (idx < 1 || seen.has(idx)) continue;
    seen.add(idx);
    entries.push(`${idx}:${item.value}`);
    if (entries.length >= SPARSE_MAX_NNZ) break;
  }

  if (entries.length === 0) return `{}/${SPARSE_DIM}`;
  return `{${entries.join(',')}}/${SPARSE_DIM}`;
}

/** 从 Supabase RPC 返回的 sparsevec 文本字符串解析出 SparseVector（兼容 {i:v}/dim 或 {i:v}） */
export function parseSparse(input: string): SparseVector {
  try {
    const content = input.trim();
    const braceStart = content.indexOf('{');
    const braceEnd = content.indexOf('}');
    if (braceStart < 0 || braceEnd < 0) return [];
    const inner = content.slice(braceStart + 1, braceEnd);
    if (!inner) return [];
    return inner
      .split(',')
      .filter((pair) => pair.includes(':'))
      .map((pair) => {
        const [index, value] = pair.split(':');
        // pgvector 索引 1-based → 转回 0-based（内部表示）
        return { index: parseInt(index, 10) - 1, value: parseFloat(value) };
      });
  } catch {
    return [];
  }
}