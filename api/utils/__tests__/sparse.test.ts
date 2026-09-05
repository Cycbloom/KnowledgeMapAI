import { describe, it, expect } from 'vitest';
import { serializeSparse, parseSparse, SPARSE_DIM } from '../sparse';

describe('serializeSparse', () => {
  it('索引原样写入，不做基线偏移', () => {
    const text = serializeSparse([
      { index: 1, value: 0.5 },
      { index: 13, value: 0.3 },
      { index: 149, value: 0.1 },
    ]);
    expect(text).toBe(`{1:0.5,13:0.3,149:0.1}/${SPARSE_DIM}`);
  });

  it('index < 1 一致丢弃（pgvector 索引从 1 开始）', () => {
    const text = serializeSparse([
      { index: 0, value: 0.5 },
      { index: 3, value: 0.2 },
    ]);
    expect(text).toBe(`{3:0.2}/${SPARSE_DIM}`);
  });

  it('index > SPARSE_DIM 一致丢弃（超出维度声明会导致 pgvector 写入报错）', () => {
    const text = serializeSparse([
      { index: SPARSE_DIM + 5, value: 0.9 },
      { index: SPARSE_DIM, value: 0.2 },
    ]);
    expect(text).toBe(`{${SPARSE_DIM}:0.2}/${SPARSE_DIM}`);
  });

  it('重复索引只保留首个（值降序排序后即最高值）', () => {
    const text = serializeSparse([
      { index: 7, value: 0.1 },
      { index: 7, value: 0.8 },
    ]);
    expect(text).toBe(`{7:0.8}/${SPARSE_DIM}`);
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
    // index 0 因 < 1 被丢弃，剩余按值降序保留前 16000 个（index 1..16000）
    expect(text.startsWith('{1:0.5,2:0.3333333333333333,3:0.25,')).toBe(true);
    const count = (text.match(/:/g) || []).length;
    expect(count).toBe(16000);
  });
});

describe('parseSparse', () => {
  it('解析带维度的 sparsevec 文本', () => {
    const parsed = parseSparse(`{1:0.5,13:0.3}/1000000`);
    expect(parsed).toEqual([
      { index: 1, value: 0.5 },
      { index: 13, value: 0.3 },
    ]);
  });

  it('解析不带维度的 sparsevec 文本', () => {
    const parsed = parseSparse(`{2:0.8}`);
    expect(parsed).toEqual([{ index: 2, value: 0.8 }]);
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
      { index: 1, value: 0.5 },
      { index: 13, value: 0.3 },
    ];
    const roundTripped = parseSparse(serializeSparse(original));
    expect(roundTripped).toEqual(original);
  });
});
