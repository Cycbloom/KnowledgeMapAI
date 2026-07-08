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

  describe('边界情况：无引用与多引用', () => {
    it('字符串无任何块引用时 extractBlockRefs 返回空数组', () => {
      expect(extractBlockRefs('这是一段普通文本，没有引用')).toEqual([]);
    });

    it('字符串无任何块尾 id 时 extractAllBlockIds 返回空数组', () => {
      const content = '第一块\n\n第二块\n\n第三块';
      expect(extractAllBlockIds(content)).toEqual([]);
    });

    it('单字符串内多个 ref 按出现顺序返回', () => {
      const content = '一 ((aaa111bbbb)) 二 ((ccc333dddd)) 三 ((eee555ffff))';
      const refs = extractBlockRefs(content);
      expect(refs.map((r) => r.blockId)).toEqual([
        'aaa111bbbb',
        'ccc333dddd',
        'eee555ffff',
      ]);
      expect(refs.every((r) => r.type === 'ref')).toBe(true);
    });

    it('连续无分隔的块引用均被解析', () => {
      const content = '((aaa111bbbb))((ccc333dddd))';
      const refs = extractBlockRefs(content);
      expect(refs.map((r) => r.blockId)).toEqual(['aaa111bbbb', 'ccc333dddd']);
    });

    it('仅包含 embed 时 extractBlockRefIds 返回空', () => {
      const content = '嵌入 !((ccc333dddd))';
      expect(extractBlockRefIds(content)).toEqual([]);
    });

    it('仅包含 ref 时 extractBlockEmbedIds 返回空', () => {
      const content = '引用 ((aaa111bbbb))';
      expect(extractBlockEmbedIds(content)).toEqual([]);
    });
  });

  describe('边界情况：畸形输入', () => {
    it('不完整的 (( 不被解析为 ref', () => {
      expect(extractBlockRefs('不完整 ((aaa111bbbb')).toEqual([]);
    });

    it('不完整的 )) 不被解析为 ref', () => {
      expect(extractBlockRefs('不完整 aaa111bbbb))')).toEqual([]);
    });

    it('多余的右括号 )) ) 仍能匹配前段 ((id))', () => {
      // 正则匹配 ((id))，多余的 ) 留作普通字符
      const refs = extractBlockRefs('text ((aaa111bbbb))) end');
      expect(refs).toHaveLength(1);
      expect(refs[0].blockId).toBe('aaa111bbbb');
    });

    it('id 含空格不被解析（不符合 [a-z0-9]{10}）', () => {
      expect(extractBlockRefs('text ((aaa 111bbbb)) end')).toEqual([]);
    });

    it('id 含大写字母不被解析（不符合 [a-z0-9]）', () => {
      expect(extractBlockRefs('text ((AAA111bbbb)) end')).toEqual([]);
    });

    it('id 不足 10 位不被解析', () => {
      expect(extractBlockRefs('text ((aaa111bbb)) end')).toEqual([]);
    });

    it('id 超过 10 位不被解析', () => {
      // 正则要求 10 位后紧跟 ))，超长不匹配
      expect(extractBlockRefs('text ((aaa111bbbbcc)) end')).toEqual([]);
    });

    it('单个括号对 (id) 不被解析为 ref', () => {
      expect(extractBlockRefs('text (aaa111bbbb) end')).toEqual([]);
    });

    it('三层括号 (((id))) 仅匹配内层 ((id))', () => {
      const refs = extractBlockRefs('text (((aaa111bbbb))) end');
      expect(refs).toHaveLength(1);
      expect(refs[0].blockId).toBe('aaa111bbbb');
      expect(refs[0].type).toBe('ref');
    });
  });

  describe('边界情况：特殊字符与 Unicode', () => {
    it('中文环境下的块引用被解析', () => {
      const content = '中文内容 ((aaa111bbbb)) 结束';
      const refs = extractBlockRefs(content);
      expect(refs).toEqual([{ blockId: 'aaa111bbbb', type: 'ref' }]);
    });

    it('emoji 环境下的块引用被解析', () => {
      const content = '🎉 ((aaa111bbbb)) 🚀';
      const refs = extractBlockRefs(content);
      expect(refs).toEqual([{ blockId: 'aaa111bbbb', type: 'ref' }]);
    });

    it('markdown 语法包裹的块引用被解析', () => {
      const content = '**加粗 ((aaa111bbbb)) 加粗**';
      const refs = extractBlockRefs(content);
      expect(refs).toEqual([{ blockId: 'aaa111bbbb', type: 'ref' }]);
    });

    it('斜体包裹的块引用被解析', () => {
      const content = '*斜体 ((aaa111bbbb)) 斜体*';
      const refs = extractBlockRefs(content);
      expect(refs).toEqual([{ blockId: 'aaa111bbbb', type: 'ref' }]);
    });

    it('中文块尾 ^id 被解析', () => {
      expect(extractBlockId('中文内容^aaa111bbbb')).toBe('aaa111bbbb');
    });

    it('emoji 后的块尾 ^id 被解析', () => {
      expect(extractBlockId('🎉🚀^aaa111bbbb')).toBe('aaa111bbbb');
    });
  });

  describe('边界情况：位置与重复', () => {
    it('块引用位于字符串开头', () => {
      const refs = extractBlockRefs('((aaa111bbbb)) 后续文本');
      expect(refs).toEqual([{ blockId: 'aaa111bbbb', type: 'ref' }]);
    });

    it('块引用位于字符串末尾', () => {
      const refs = extractBlockRefs('前置文本 ((aaa111bbbb))');
      expect(refs).toEqual([{ blockId: 'aaa111bbbb', type: 'ref' }]);
    });

    it('块引用位于字符串中间', () => {
      const refs = extractBlockRefs('前置 ((aaa111bbbb)) 后置');
      expect(refs).toEqual([{ blockId: 'aaa111bbbb', type: 'ref' }]);
    });

    it('同一 ref 多次出现按首次顺序去重', () => {
      const content = 'a ((aaa111bbbb)) b ((ccc333dddd)) c ((aaa111bbbb))';
      const ids = extractBlockRefIds(content);
      expect(ids).toEqual(['aaa111bbbb', 'ccc333dddd']);
    });

    it('同一 embed 多次出现按首次顺序去重', () => {
      const content = 'a !((aaa111bbbb)) b !((ccc333dddd)) c !((aaa111bbbb))';
      const ids = extractBlockEmbedIds(content);
      expect(ids).toEqual(['aaa111bbbb', 'ccc333dddd']);
    });

    it('ref 与 embed 同 id 分别保留', () => {
      // extractBlockRefs 不去重，ref 与 embed 同 id 都保留
      const content = 'ref ((aaa111bbbb)) embed !((aaa111bbbb))';
      const refs = extractBlockRefs(content);
      expect(refs).toHaveLength(2);
      expect(refs[0]).toEqual({ blockId: 'aaa111bbbb', type: 'ref' });
      expect(refs[1]).toEqual({ blockId: 'aaa111bbbb', type: 'embed' });
    });
  });

  describe('边界情况：块尾 id 位置与重复', () => {
    it('extractBlockId 仅匹配块尾（id 在中间不匹配）', () => {
      expect(extractBlockId('hello^aaa111bbbb world')).toBeNull();
    });

    it('extractBlockId 仅匹配块尾（id 在开头不匹配）', () => {
      expect(extractBlockId('^aaa111bbbb hello')).toBeNull();
    });

    it('仅含 ^id 的字符串可被提取', () => {
      expect(extractBlockId('^aaa111bbbb')).toBe('aaa111bbbb');
    });

    it('removeBlockId 不影响中间的 ^id', () => {
      // 仅剥离尾部 ^id，中间的 ^text 保留
      expect(removeBlockId('hello^mid text^aaa111bbbb')).toBe('hello^mid text');
    });

    it('removeBlockId 处理仅含 ^id 的字符串', () => {
      expect(removeBlockId('^aaa111bbbb')).toBe('');
    });

    it('ensureBlockId 处理空字符串', () => {
      const result = ensureBlockId('');
      // 空字符串 + ^id，content 形如 ^xxxxxxxxxx
      expect(result.content).toMatch(/^\^[a-z0-9]{10}$/);
      expect(result.content.startsWith('^')).toBe(true);
      expect(result.blockId).toMatch(/^[a-z0-9]{10}$/);
    });

    it('ensureBlockId 不重复追加（已有 id）', () => {
      const result = ensureBlockId('hello^aaa111bbbb');
      expect(result.content).toBe('hello^aaa111bbbb');
      expect(result.blockId).toBe('aaa111bbbb');
    });

    it('extractAllBlockIds 同一块内多个 ^id 仅取块尾', () => {
      // 块尾正则只匹配末尾，中间的 ^id 不被 extractBlockId 提取
      const content = 'hello^mid text^aaa111bbbb';
      const ids = extractAllBlockIds(content);
      expect(ids).toEqual(['aaa111bbbb']);
    });
  });

  describe('边界情况：findBlockContent 边界', () => {
    it('块 id 出现在多个块中时返回首个匹配', () => {
      const content = '块一^aaa111bbbb\n\n块二^aaa111bbbb';
      expect(findBlockContent(content, 'aaa111bbbb')).toBe('块一^aaa111bbbb');
    });

    it('仅含空白的 blockId 返回 null', () => {
      expect(findBlockContent('content', '   ')).toBeNull();
    });

    it('内容仅为分隔空行时返回 null', () => {
      expect(findBlockContent('\n\n\n', 'aaa111bbbb')).toBeNull();
    });
  });
});
