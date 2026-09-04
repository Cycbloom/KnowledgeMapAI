import { describe, it, expect } from 'vitest';
import { serializeSparse, parseSparse, SPARSE_DIM } from '../sparse';

describe('serializeSparse', () => {
  it('将 1-based 索引序列化为 pgvector sparsevec 文本', () => {
    const text = serializeSparse([
      { index: 0, value: 0.5 },
      { index: 12, value: 0.3 },
      { index: 148, value: 0.1 },
    ]);
    // 1-based 数据（min index = 1）应原样保留
    expect(text).toBe(`{1:0.5,13:0.3,149:0.1}/${SPARSE_DIM}`);
  });

  it('将 0-based 索引自动 +1 转为 1-based', () => {
    const text = serializeSparse([
      { index: 0, value: 0.5 },
      { index: 3, value: 0.2 },
    ]);
    // 0-based 数据（min index = 0）应整体 +1
    expect(text).toBe(`{1:0.5,4:0.2}/${SPARSE_DIM}`);
  });

  it('空稀疏向量输出零向量文本', () => {
    expect(serializeSparse([])).toBe(`{}/${SPARSE_DIM}`);
  });

  it('超过非零元素上限 16000 时按值降序截断', () => {
    const big: { index: number; value: number }[] = [];
    for (let i = 0; i < 20000; i++) {
      big.push({ index: i, value: 1 / (i + 1) });
    }
    const text = serializeSparse(big);
    // 仅保留值最大的 16000 个（index 0..15999），且全部为正（1-based → index+1）
    expect(text.startsWith('{1:1,2:0.5,3:0.3333333333333333,4:0.25,')).toBe(true);
    const count = (text.match(/:/g) || []).length;
    expect(count).toBe(16000);
  });
});

describe('parseSparse', () => {
  it('解析带维度的 sparsevec 文本', () => {
    const parsed = parseSparse(`{1:0.5,13:0.3}/1000000`);
    expect(parsed).toEqual([
      { index: 0, value: 0.5 },
      { index: 12, value: 0.3 },
    ]);
  });

  it('解析不带维度的 sparsevec 文本', () => {
    const parsed = parseSparse(`{2:0.8}`);
    expect(parsed).toEqual([{ index: 1, value: 0.8 }]);
  });

  it('非法输入返回空数组', () => {
    expect(parseSparse('')).toEqual([]);
    expect(parseSparse('abc')).toEqual([]);
    expect(parseSparse('{/1000000}')).toEqual([]);
  });
});

describe('serialize/parse 往返', () => {
  it('往返保持索引与值', () => {
    const original = [
      { index: 0, value: 0.5 },
      { index: 12, value: 0.3 },
    ];
    const roundTripped = parseSparse(serializeSparse(original));
    expect(roundTripped).toEqual(original);
  });
});
