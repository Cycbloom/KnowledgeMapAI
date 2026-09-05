import { describe, it, expect } from 'vitest';
import { parseContextResponse } from '../../../../api/services/ai/chunkContextService';

const INDICES = new Set([0, 1, 2]);

describe('parseContextResponse', () => {
  it('解析裸 JSON 数组，只保留请求过的 index', () => {
    const raw = JSON.stringify([
      { index: 0, context: '本段出自《机器学习入门》，讨论监督学习的定义' },
      { index: 1, context: '本段讨论损失函数的选择' },
      { index: 99, context: '越界 index 应被丢弃' },
    ]);
    const parsed = parseContextResponse(raw, INDICES);
    expect(parsed.size).toBe(2);
    expect(parsed.get(0)).toContain('监督学习');
    expect(parsed.get(1)).toContain('损失函数');
    expect(parsed.has(99)).toBe(false);
  });

  it('解析 markdown 代码块包裹的 JSON', () => {
    const raw = '```json\n[{"index": 1, "context": "讨论梯度下降"}]\n```';
    const parsed = parseContextResponse(raw, INDICES);
    expect(parsed.get(1)).toBe('讨论梯度下降');
  });

  it('解析前后夹杂说明文字的 JSON（截取最外层数组）', () => {
    const raw = '好的，以下是各分块的上下文：\n[{"index": 2, "context": "讨论过拟合"}]\n希望有帮助';
    const parsed = parseContextResponse(raw, INDICES);
    expect(parsed.get(2)).toBe('讨论过拟合');
  });

  it('兼容 { contexts: [...] } 包裹形态', () => {
    const raw = JSON.stringify({
      contexts: [{ index: 0, context: '讨论正则化' }],
    });
    const parsed = parseContextResponse(raw, INDICES);
    expect(parsed.get(0)).toBe('讨论正则化');
  });

  it('非法 JSON 返回空 Map', () => {
    expect(parseContextResponse('完全不是 JSON', INDICES).size).toBe(0);
    expect(parseContextResponse('', INDICES).size).toBe(0);
    expect(parseContextResponse('[{"index": "x", "context": 1}]', INDICES).size).toBe(0);
  });

  it('空 context 与字段缺失的条目被跳过', () => {
    const raw = JSON.stringify([
      { index: 0, context: '   ' },
      { index: 1 },
      { context: '无 index' },
      { index: 2, context: '有效条目' },
    ]);
    const parsed = parseContextResponse(raw, INDICES);
    expect(parsed.size).toBe(1);
    expect(parsed.get(2)).toBe('有效条目');
  });

  it('超长 context 截断到 300 字符', () => {
    const long = '长'.repeat(500);
    const parsed = parseContextResponse(JSON.stringify([{ index: 0, context: long }]), INDICES);
    expect(parsed.get(0)).toBe('长'.repeat(300));
  });
});
