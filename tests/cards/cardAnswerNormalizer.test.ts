import { describe, it, expect } from 'vitest';
import { normalizeGeneratedCardAnswers } from '../../api/services/ai/utils';
import type { NormalizableGeneratedCard } from '../../api/services/ai/utils/cardAnswerNormalizer';

const CHOICE_OPTIONS = ['传输控制协议（TCP）', '用户数据报协议（UDP）', '网际控制报文协议（ICMP）', '地址解析协议（ARP）'];

const buildChoiceCard = (answer: unknown, options: unknown = CHOICE_OPTIONS): NormalizableGeneratedCard => ({
  type: 'choice',
  question: '以下哪项是面向连接的传输层协议？',
  answer,
  options,
});

describe('normalizeGeneratedCardAnswers · choice', () => {
  it('字母标签 "A" 映射为第一个选项原文', () => {
    const [card] = normalizeGeneratedCardAnswers([buildChoiceCard('A')]);
    expect(card.answer).toBe(CHOICE_OPTIONS[0]);
  });

  it('小写字母标签 "c" 映射为第三个选项原文', () => {
    const [card] = normalizeGeneratedCardAnswers([buildChoiceCard('c')]);
    expect(card.answer).toBe(CHOICE_OPTIONS[2]);
  });

  it('"B. xxx" 前缀形式且 xxx 与选项文本一致时归一化为选项原文', () => {
    const [card] = normalizeGeneratedCardAnswers([
      buildChoiceCard('B. 用户数据报协议（UDP）'),
    ]);
    expect(card.answer).toBe(CHOICE_OPTIONS[1]);
  });

  it('"C、xxx" 前缀形式且 xxx 是选项的改写时按标签定位', () => {
    const [card] = normalizeGeneratedCardAnswers([buildChoiceCard('C、ICMP 协议')]);
    expect(card.answer).toBe(CHOICE_OPTIONS[2]);
  });

  it('答案已是某选项原文（仅大小写/空白差异）时归一化为选项原文', () => {
    const [card] = normalizeGeneratedCardAnswers([
      buildChoiceCard(' 用户数据报协议（udp ） '),
    ]);
    expect(card.answer).toBe(CHOICE_OPTIONS[1]);
  });

  it('数字索引 "3" 映射为第三个选项原文', () => {
    const [card] = normalizeGeneratedCardAnswers([buildChoiceCard('3')]);
    expect(card.answer).toBe(CHOICE_OPTIONS[2]);
  });

  it('数字类型 answer 2 映射为第二个选项原文', () => {
    const [card] = normalizeGeneratedCardAnswers([buildChoiceCard(2)]);
    expect(card.answer).toBe(CHOICE_OPTIONS[1]);
  });

  it('"选项D" 形式映射为第四个选项原文', () => {
    const [card] = normalizeGeneratedCardAnswers([buildChoiceCard('选项D')]);
    expect(card.answer).toBe(CHOICE_OPTIONS[3]);
  });

  it('无法映射的自由文本保持原样（fail-safe）', () => {
    const [card] = normalizeGeneratedCardAnswers([
      buildChoiceCard('这是一种完全无关的表述'),
    ]);
    expect(card.answer).toBe('这是一种完全无关的表述');
  });

  it('标签越界（如 "E" 超出 4 个选项）且无前缀文本命中时保持原样', () => {
    const [card] = normalizeGeneratedCardAnswers([buildChoiceCard('E')]);
    expect(card.answer).toBe('E');
  });

  it('缺少 options 字段时不做任何改写', () => {
    const [card] = normalizeGeneratedCardAnswers([
      { type: 'choice', question: 'q', answer: 'A' },
    ]);
    expect(card.answer).toBe('A');
  });
});

describe('normalizeGeneratedCardAnswers · multi_choice', () => {
  const MULTI_OPTIONS = ['特点A', '特点B', '特点C', '特点D'];

  it('JSON 数组字符串中的字母标签映射为选项原文并输出 JSON 字符串', () => {
    const [card] = normalizeGeneratedCardAnswers([
      { type: 'multi_choice', question: 'q', answer: '["A","C"]', options: MULTI_OPTIONS },
    ]);
    expect(card.answer).toBe(JSON.stringify(['特点A', '特点C']));
  });

  it('真实数组类型的 answer 同样映射并序列化为 JSON 字符串', () => {
    const [card] = normalizeGeneratedCardAnswers([
      { type: 'multi_choice', question: 'q', answer: ['B', 'D'], options: MULTI_OPTIONS },
    ]);
    expect(card.answer).toBe(JSON.stringify(['特点B', '特点D']));
  });

  it('顿号分隔的标签列表 "A、C" 可解析并映射', () => {
    const [card] = normalizeGeneratedCardAnswers([
      { type: 'multi_choice', question: 'q', answer: 'A、C', options: MULTI_OPTIONS },
    ]);
    expect(card.answer).toBe(JSON.stringify(['特点A', '特点C']));
  });
});

describe('normalizeGeneratedCardAnswers · select_from_options', () => {
  it('字母标签映射为候选词原文', () => {
    const [card] = normalizeGeneratedCardAnswers([
      {
        type: 'select_from_options',
        question: '闭包是指 ___ 与其词法环境的组合。',
        answer: 'B',
        options: ['原型', '函数', '作用域', '事件'],
      },
    ]);
    expect(card.answer).toBe('函数');
  });
});

describe('normalizeGeneratedCardAnswers · 不受影响的题型与边界', () => {
  it('qa / true_false 题型不做改写', () => {
    const cards = normalizeGeneratedCardAnswers([
      { type: 'qa', question: 'q', answer: 'A 相关的长答案' },
      { type: 'true_false', question: 'q', answer: 'True' },
    ]);
    expect(cards[0].answer).toBe('A 相关的长答案');
    expect(cards[1].answer).toBe('True');
  });

  it('options 不是数组时保持原样', () => {
    const [card] = normalizeGeneratedCardAnswers([
      { type: 'choice', question: 'q', answer: 'A', options: '不是数组' },
    ]);
    expect(card.answer).toBe('A');
  });

  it('返回同一数组引用，便于链式赋值', () => {
    const input = [buildChoiceCard('A')];
    expect(normalizeGeneratedCardAnswers(input)).toBe(input);
  });
});
