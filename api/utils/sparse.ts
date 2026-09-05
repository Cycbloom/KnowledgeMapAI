import type { SparseVector } from '../../shared/types/ai';

/**
 * 稀疏向量工具：用于 pgvector sparsevec 列的读写。
 *
 * pgvector 的 sparsevec(N) 中 N 是**总维度数**（即最大索引值），索引从 1 开始，
 * 非零元素数有独立硬上限 16000（SPARSEVEC_MAX_NNZ）。本工具：
 * - 序列化时输出显式维度 `{i:v,...}/1000000`，与列声明一致
 * - provider 索引**原样写入，不做基线偏移**：内积匹配只依赖索引相等，
 *   只要查询与文档两侧约定一致即正确。此前按"min index === 0 则整体 +1"逐条
 *   猜测 provider 基线，0-based provider 的向量若恰好不含 token 0 会被误判为
 *   1-based，导致同表内不同行索引基准不一致、内积匹配错位，故移除该启发式。
 * - 丢弃 index < 1（pgvector 要求索引从 1 开始）与 index > SPARSE_DIM
 *   （超出维度声明会导致写入报错），对全库所有向量一致
 * - 截断到 16000 个非零元素（按值降序保留 top），避免超上限写入失败
 */
export const SPARSE_DIM = 1_000_000;
const SPARSE_MAX_NNZ = 16000;

/** SparseVector（{index,value}[]）→ pgvector sparsevec 文本 */
export function serializeSparse(v: SparseVector): string {
  // 1. 按值降序排序并截断到非零上限，同时去重索引、过滤越界
  const seen = new Set<number>();
  const entries: string[] = [];
  for (const item of [...v].sort((a, b) => b.value - a.value)) {
    if (item.index < 1 || item.index > SPARSE_DIM || seen.has(item.index)) continue;
    seen.add(item.index);
    entries.push(`${item.index}:${item.value}`);
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
        // 序列化时索引原样写入，解析保持原样（parse 是 serialize 的逆运算）
        return { index: parseInt(index, 10), value: parseFloat(value) };
      });
  } catch {
    return [];
  }
}
