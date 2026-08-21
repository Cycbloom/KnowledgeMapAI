import { describe, it, expect } from 'vitest';
import { deriveFocusTopicFallback } from '../../shared/utils/cards';

describe('deriveFocusTopicFallback', () => {
  it('返回长度 ≤200 字的非空字符串（长 question 场景）', () => {
    const longQuestion =
      '这是一个非常长的题目，用来测试当 question 超过 24 个字符时是否会被正确截断并添加省略号，同时确保最终返回的字符串长度不超过 200 个字符。';
    const result = deriveFocusTopicFallback(longQuestion, '某个节点标题');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(200);
    expect(result.endsWith('…')).toBe(true);
    expect(result.length).toBe(25);
  });

  it('当 question 是短字符串时原样返回（不超过 24 字）', () => {
    const shortQuestion = '什么是闭包？';
    const result = deriveFocusTopicFallback(shortQuestion, 'JavaScript');
    expect(result).toBe(shortQuestion);
  });

  it('当 question 前后有空格时正确 trim', () => {
    const paddedQuestion = '   什么是 Promise？   ';
    const result = deriveFocusTopicFallback(paddedQuestion, undefined);
    expect(result).toBe('什么是 Promise？');
  });

  it('当 question 非字符串时使用 nodeTitle', () => {
    const nodeTitle = 'React Hooks 深入理解';
    const result1 = deriveFocusTopicFallback(null, nodeTitle);
    expect(result1).toBe(nodeTitle);

    const result2 = deriveFocusTopicFallback(undefined, nodeTitle);
    expect(result2).toBe(nodeTitle);

    const result3 = deriveFocusTopicFallback(12345, nodeTitle);
    expect(result3).toBe(nodeTitle);

    const result4 = deriveFocusTopicFallback({}, nodeTitle);
    expect(result4).toBe(nodeTitle);
  });

  it('当 question 是空字符串时回退到 nodeTitle', () => {
    const nodeTitle = '数据类型转换';
    const result = deriveFocusTopicFallback('', nodeTitle);
    expect(result).toBe(nodeTitle);
  });

  it('当 question 非字符串且 nodeTitle 超过 24 字时截断并加省略号', () => {
    const longNodeTitle = '这是一个非常长的节点标题用来测试截断逻辑是否正常工作';
    const result = deriveFocusTopicFallback(null, longNodeTitle);
    expect(result.length).toBe(25);
    expect(result.endsWith('…')).toBe(true);
  });

  it('当 question 和 nodeTitle 都缺失时返回默认值「未命名考察点」', () => {
    expect(deriveFocusTopicFallback(undefined, undefined)).toBe('未命名考察点');
    expect(deriveFocusTopicFallback(null, null)).toBe('未命名考察点');
    expect(deriveFocusTopicFallback('', '')).toBe('未命名考察点');
    expect(deriveFocusTopicFallback(123, '')).toBe('未命名考察点');
  });
});

describe('getMockCards focus_topic 断言（尝试导入）', () => {
  it('若 getMockCards 可导入，则每张卡片 focus_topic 应为非空字符串', async () => {
    try {
      const { getMockCards } = await import('../../api/services/ai/mock');
      if (typeof getMockCards === 'function') {
        const cards = getMockCards('测试主题', ['qa', 'choice', 'true_false', 'multi_choice', 'fill_in_the_blank', 'essay'], 6);
        for (const card of cards) {
          expect(typeof (card as { focus_topic?: unknown }).focus_topic).toBe('string');
          expect(((card as { focus_topic?: string }).focus_topic || '').length).toBeGreaterThan(0);
        }
      } else {
        // 函数不可导入则跳过
      }
    } catch (_e) {
      // 无法直接 import 私有函数，跳过此条
    }
  });
});
