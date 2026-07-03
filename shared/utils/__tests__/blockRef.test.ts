import { describe, it, expect } from 'vitest';
import {
  generateBlockId,
  extractBlockId,
  extractAllBlockIds,
  extractBlockRefs,
  extractBlockRefIds,
  extractBlockEmbedIds,
  ensureBlockId,
  removeBlockId,
  findBlockContent,
  BLOCK_ID_PATTERN,
  BLOCK_ID_TRAILING_REGEX,
  BLOCK_REF_REGEX,
  BLOCK_EMBED_REGEX,
} from '../blockRef';

describe('blockRef', () => {
  describe('generateBlockId', () => {
    it('返回 10 位 [a-z0-9] 字符串', () => {
      const id = generateBlockId();
      expect(id).toHaveLength(10);
      expect(id).toMatch(/^[a-z0-9]{10}$/);
    });

    it('多次调用不重复', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        ids.add(generateBlockId());
      }
      expect(ids.size).toBe(1000);
    });
  });

  describe('常量导出', () => {
    it('BLOCK_ID_PATTERN 为 [a-z0-9]{10}', () => {
      expect(BLOCK_ID_PATTERN).toBe('[a-z0-9]{10}');
    });

    it('BLOCK_ID_TRAILING_REGEX 命中块尾 ^id', () => {
      expect(BLOCK_ID_TRAILING_REGEX.test('hello^abc123def0')).toBe(true);
      expect(BLOCK_ID_TRAILING_REGEX.test('hello')).toBe(false);
    });

    it('BLOCK_REF_REGEX 命中 ((id))', () => {
      BLOCK_REF_REGEX.lastIndex = 0;
      expect(BLOCK_REF_REGEX.test('see ((abc123def0)) here')).toBe(true);
    });

    it('BLOCK_EMBED_REGEX 命中 !((id))', () => {
      BLOCK_EMBED_REGEX.lastIndex = 0;
      expect(BLOCK_EMBED_REGEX.test('embed !((abc123def0)) done')).toBe(true);
    });
  });

  describe('extractBlockId', () => {
    it('命中块尾 ^abc123def0 返回 id', () => {
      expect(extractBlockId('hello world^abc123def0')).toBe('abc123def0');
    });

    it('命中带空格的块尾 ^id', () => {
      expect(extractBlockId('hello world ^abc123def0')).toBe('abc123def0');
    });

    it('无 id 返回 null', () => {
      expect(extractBlockId('hello world')).toBeNull();
    });

    it('空字符串返回 null', () => {
      expect(extractBlockId('')).toBeNull();
    });

    it('id 不足 10 位不命中', () => {
      expect(extractBlockId('hello^abc123')).toBeNull();
    });
  });

  describe('extractAllBlockIds', () => {
    it('多块解析（含无 id 的块跳过）', () => {
      const content = [
        '第一块^aaa111bbbb',
        '',
        '第二块无 id',
        '',
        '第三块^ccc333dddd',
      ].join('\n');
      const ids = extractAllBlockIds(content);
      expect(ids).toEqual(['aaa111bbbb', 'ccc333dddd']);
    });

    it('代码块内的 ^id 不被解析', () => {
      const content = [
        '正常块^aaa111bbbb',
        '',
        '```python',
        'code^bbb222cccc',
        '```',
        '',
        '另一块^ddd444eeee',
      ].join('\n');
      const ids = extractAllBlockIds(content);
      // 代码块内的 ^bbb222cccc 应被跳过
      expect(ids).toEqual(['aaa111bbbb', 'ddd444eeee']);
    });

    it('行内代码内的 ^id 不被解析', () => {
      const content = '正常块^aaa111bbbb\n\n这是 `code^xxx` 行内代码';
      const ids = extractAllBlockIds(content);
      expect(ids).toEqual(['aaa111bbbb']);
    });

    it('空内容返回空数组', () => {
      expect(extractAllBlockIds('')).toEqual([]);
    });
  });

  describe('extractBlockRefs', () => {
    it('同时解析 ref 与 embed', () => {
      const content = '引用 ((aaa111bbbb)) 与嵌入 !((ccc333dddd))';
      const refs = extractBlockRefs(content);
      expect(refs).toEqual([
        { blockId: 'aaa111bbbb', type: 'ref' },
        { blockId: 'ccc333dddd', type: 'embed' },
      ]);
    });

    it('embed 优先（避免 !((id)) 被 ref 误匹配）', () => {
      // !((eee555ffff)) 应只产生一条 embed，不应额外产生 ref
      const content = '嵌入 !((eee555ffff))';
      const refs = extractBlockRefs(content);
      expect(refs).toHaveLength(1);
      expect(refs[0]).toEqual({ blockId: 'eee555ffff', type: 'embed' });
    });

    it('ref 与 embed 混合时 embed 不重复为 ref', () => {
      const content = [
        '先 ref ((aaa111bbbb))',
        '再 embed !((ccc333dddd))',
        '再 ref ((eee555ffff))',
      ].join('\n');
      const refs = extractBlockRefs(content);
      const embeds = refs.filter((r) => r.type === 'embed');
      const refOnly = refs.filter((r) => r.type === 'ref');
      expect(embeds).toEqual([{ blockId: 'ccc333dddd', type: 'embed' }]);
      // 两个 ref，不含 embed 的 id
      expect(refOnly.map((r) => r.blockId).sort()).toEqual(['aaa111bbbb', 'eee555ffff']);
    });

    it('代码块内的 ((id)) 不被解析', () => {
      const content = [
        '```js',
        'const x = ((aaa111bbbb));',
        'const y = !((ccc333dddd));',
        '```',
        '',
        '正常 ((eee555ffff))',
      ].join('\n');
      const refs = extractBlockRefs(content);
      expect(refs).toEqual([{ blockId: 'eee555ffff', type: 'ref' }]);
    });

    it('行内代码内的 ((id)) 不被解析', () => {
      const content = '正常 ((aaa111bbbb)) 与 `code ((xxx))` 行内';
      const refs = extractBlockRefs(content);
      expect(refs).toEqual([{ blockId: 'aaa111bbbb', type: 'ref' }]);
    });

    it('按文档出现顺序返回', () => {
      const content = '先 ((aaa111bbbb)) 中 !((ccc333dddd)) 后 ((eee555ffff))';
      const refs = extractBlockRefs(content);
      expect(refs.map((r) => r.blockId)).toEqual(['aaa111bbbb', 'ccc333dddd', 'eee555ffff']);
      expect(refs.map((r) => r.type)).toEqual(['ref', 'embed', 'ref']);
    });

    it('空内容返回空数组', () => {
      expect(extractBlockRefs('')).toEqual([]);
    });
  });

  describe('extractBlockRefIds', () => {
    it('仅返回 ref 的 id（去重）', () => {
      const content = 'a ((aaa111bbbb)) b !((ccc333dddd)) c ((aaa111bbbb))';
      const ids = extractBlockRefIds(content);
      expect(ids).toEqual(['aaa111bbbb']);
    });
  });

  describe('extractBlockEmbedIds', () => {
    it('仅返回 embed 的 id（去重）', () => {
      const content = 'a ((aaa111bbbb)) b !((ccc333dddd)) c !((ccc333dddd))';
      const ids = extractBlockEmbedIds(content);
      expect(ids).toEqual(['ccc333dddd']);
    });
  });

  describe('ensureBlockId', () => {
    it('无 id 时追加 ^id', () => {
      const result = ensureBlockId('hello world');
      expect(result.content).toMatch(/^hello world\^[a-z0-9]{10}$/);
      expect(result.blockId).toMatch(/^[a-z0-9]{10}$/);
      // 追加后的内容应能被 extractBlockId 提取
      expect(extractBlockId(result.content)).toBe(result.blockId);
    });

    it('已有 id 时返回原内容', () => {
      const result = ensureBlockId('hello world^aaa111bbbb');
      expect(result.content).toBe('hello world^aaa111bbbb');
      expect(result.blockId).toBe('aaa111bbbb');
    });
  });

  describe('removeBlockId', () => {
    it('剥离块尾 ^id（无空格）', () => {
      expect(removeBlockId('hello world^abc123def0')).toBe('hello world');
    });

    it('剥离块尾 ^id（含前置空格）', () => {
      expect(removeBlockId('hello world ^abc123def0')).toBe('hello world');
    });

    it('无 id 时返回原内容（去除尾部空白）', () => {
      expect(removeBlockId('hello world')).toBe('hello world');
    });

    it('空字符串返回空字符串', () => {
      expect(removeBlockId('')).toBe('');
    });
  });

  describe('findBlockContent', () => {
    it('命中返回块文本（含 ^id）', () => {
      const content = ['第一块^aaa111bbbb', '', '第二块^ccc333dddd'].join('\n');
      const block = findBlockContent(content, 'ccc333dddd');
      expect(block).toBe('第二块^ccc333dddd');
    });

    it('未命中返回 null', () => {
      const content = '第一块^aaa111bbbb\n\n第二块^ccc333dddd';
      expect(findBlockContent(content, 'zzz999zzzz9')).toBeNull();
    });

    it('跨多块正确查找', () => {
      const content = [
        '块一^aaa111bbbb',
        '',
        '块二^bbb222cccc',
        '',
        '块三^ccc333dddd',
      ].join('\n');
      expect(findBlockContent(content, 'bbb222cccc')).toBe('块二^bbb222cccc');
      expect(findBlockContent(content, 'ccc333dddd')).toBe('块三^ccc333dddd');
      expect(findBlockContent(content, 'aaa111bbbb')).toBe('块一^aaa111bbbb');
    });

    it('空内容返回 null', () => {
      expect(findBlockContent('', 'aaa111bbbb')).toBeNull();
    });

    it('空 blockId 返回 null', () => {
      expect(findBlockContent('content', '')).toBeNull();
    });
  });
});
