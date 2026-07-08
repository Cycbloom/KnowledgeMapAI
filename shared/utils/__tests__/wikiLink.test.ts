import { describe, it, expect } from 'vitest';
import {
  WIKI_LINK_REGEX,
  extractWikiLinks,
  extractWikiLinkPositions,
  getWikiLinkContext,
  replaceWikiLink,
} from '../wikiLink';

describe('wikiLink', () => {
  describe('WIKI_LINK_REGEX', () => {
    it('命中 [[节点标题]]', () => {
      WIKI_LINK_REGEX.lastIndex = 0;
      expect(WIKI_LINK_REGEX.test('参见 [[图谱]] 即可')).toBe(true);
    });

    it('不匹配跨行内容', () => {
      WIKI_LINK_REGEX.lastIndex = 0;
      const content = '[[第一行\n第二行]]';
      expect(WIKI_LINK_REGEX.test(content)).toBe(false);
    });
  });

  describe('extractWikiLinks', () => {
    it('提取单个双链', () => {
      expect(extractWikiLinks('参见 [[图谱]] 即可')).toEqual(['图谱']);
    });

    it('提取多个双链按出现顺序返回', () => {
      const content = '一 [[节点A]] 二 [[节点B]] 三 [[节点C]]';
      expect(extractWikiLinks(content)).toEqual(['节点A', '节点B', '节点C']);
    });

    it('去重（大小写不敏感，保留首次出现的原始大小写）', () => {
      const content = '一 [[Graph]] 二 [[graph]] 三 [[GRAPH]]';
      const result = extractWikiLinks(content);
      expect(result).toHaveLength(1);
      // 保留首次出现的原始大小写
      expect(result[0]).toBe('Graph');
    });

    it('去重（完全相同）', () => {
      const content = '一 [[节点]] 二 [[节点]] 三 [[节点]]';
      expect(extractWikiLinks(content)).toEqual(['节点']);
    });

    it('trim 双链内部空白', () => {
      // 捕获组 1 为 [^\]\n]+，trim 后入列
      expect(extractWikiLinks('[[  节点  ]]')).toEqual(['节点']);
    });

    it('空字符串返回空数组', () => {
      expect(extractWikiLinks('')).toEqual([]);
    });

    it('无双链的文本返回空数组', () => {
      expect(extractWikiLinks('普通文本没有双链')).toEqual([]);
    });

    it('仅包含 [[ 的不完整双链不被解析', () => {
      expect(extractWikiLinks('不完整 [[节点')).toEqual([]);
    });

    it('仅包含 ]] 的不完整双链不被解析', () => {
      expect(extractWikiLinks('不完整 节点]]')).toEqual([]);
    });

    it('中文与 emoji 环境下的双链被解析', () => {
      expect(extractWikiLinks('🎉 [[中文节点]] 🚀')).toEqual(['中文节点']);
    });

    it('markdown 语法包裹的双链被解析', () => {
      expect(extractWikiLinks('**加粗 [[节点]] 加粗**')).toEqual(['节点']);
    });

    it('连续无分隔的双链均被解析', () => {
      expect(extractWikiLinks('[[A]][[B]][[C]]')).toEqual(['A', 'B', 'C']);
    });

    it('双链位于字符串开头/中间/末尾均被解析', () => {
      expect(extractWikiLinks('[[开头]]')).toEqual(['开头']);
      expect(extractWikiLinks('中间 [[节点]] 文本')).toEqual(['节点']);
      expect(extractWikiLinks('文本 [[末尾]]')).toEqual(['末尾']);
    });

    it('含特殊字符的标题被解析', () => {
      expect(extractWikiLinks('[[节点/子节点]]')).toEqual(['节点/子节点']);
      expect(extractWikiLinks('[[节点#锚点]]')).toEqual(['节点#锚点']);
      expect(extractWikiLinks('[[节点|别名]]')).toEqual(['节点|别名']);
    });
  });

  describe('extractWikiLinkPositions', () => {
    it('返回双链的位置信息', () => {
      const content = '前缀 [[节点]] 后缀';
      const positions = extractWikiLinkPositions(content);
      expect(positions).toHaveLength(1);
      expect(positions[0].title).toBe('节点');
      expect(positions[0].start).toBe(content.indexOf('[['));
      expect(positions[0].end).toBe(content.indexOf('[[') + '[[节点]]'.length);
    });

    it('多个双链返回多个位置（不去重）', () => {
      const content = '[[A]] [[B]] [[A]]';
      const positions = extractWikiLinkPositions(content);
      expect(positions).toHaveLength(3);
      expect(positions.map((p) => p.title)).toEqual(['A', 'B', 'A']);
    });

    it('空字符串返回空数组', () => {
      expect(extractWikiLinkPositions('')).toEqual([]);
    });

    it('无双链返回空数组', () => {
      expect(extractWikiLinkPositions('普通文本')).toEqual([]);
    });

    it('位置坐标可用于切片还原原文本', () => {
      const content = '前缀 [[节点]] 后缀';
      const positions = extractWikiLinkPositions(content);
      const restored = content.slice(positions[0].start, positions[0].end);
      expect(restored).toBe('[[节点]]');
    });
  });

  describe('getWikiLinkContext', () => {
        it('返回双链周围上下文（含双链本身）', () => {
      // 内容足够长，确保上下文窗口（contextChars=5）不覆盖全文
      const content = '这是一段很长的前缀文字用于测试上下文 [[节点]] 这是一段很长的后缀文字用于测试上下文';
      const positions = extractWikiLinkPositions(content);
      const ctx = getWikiLinkContext(
        content,
        positions[0].start,
        positions[0].end,
        5,
      );
      // 双链本身在上下文中
      expect(ctx).toContain('[[节点]]');
      // 前后有省略号（因为 content 比上下文窗口大）
      expect(ctx.startsWith('...')).toBe(true);
      expect(ctx.endsWith('...')).toBe(true);
    });

    it('双链位于开头时无前置省略号', () => {
      const content = '[[节点]] 后面跟很多文字';
      const positions = extractWikiLinkPositions(content);
      const ctx = getWikiLinkContext(
        content,
        positions[0].start,
        positions[0].end,
        5,
      );
      expect(ctx.startsWith('...')).toBe(false);
      // 末尾有省略号
      expect(ctx.endsWith('...')).toBe(true);
    });

    it('双链位于末尾时无后置省略号', () => {
      const content = '前面很多文字然后 [[节点]]';
      const positions = extractWikiLinkPositions(content);
      const ctx = getWikiLinkContext(
        content,
        positions[0].start,
        positions[0].end,
        5,
      );
      expect(ctx.startsWith('...')).toBe(true);
      expect(ctx.endsWith('...')).toBe(false);
    });

    it('上下文窗口覆盖全文时无省略号', () => {
      const content = '短文本 [[节点]] 结束';
      const positions = extractWikiLinkPositions(content);
      const ctx = getWikiLinkContext(
        content,
        positions[0].start,
        positions[0].end,
        100,
      );
      expect(ctx.startsWith('...')).toBe(false);
      expect(ctx.endsWith('...')).toBe(false);
      expect(ctx).toBe(content);
    });

    it('换行被替换为空格', () => {
      const content = '第一行\n第二行 [[节点]] 第三行\n第四行';
      const positions = extractWikiLinkPositions(content);
      const ctx = getWikiLinkContext(
        content,
        positions[0].start,
        positions[0].end,
        5,
      );
      expect(ctx).not.toContain('\n');
    });

    it('默认 contextChars 为 30', () => {
      const content = `${'a'.repeat(50)} [[节点]] ${'b'.repeat(50)}`;
      const positions = extractWikiLinkPositions(content);
      const ctx = getWikiLinkContext(
        content,
        positions[0].start,
        positions[0].end,
      );
      // 前后各 30 字符 + [[节点]] (6 字符) + 两个省略号 (6 字符)
      // 总长度 = 30 + 6 + 30 + 6 = 72
      expect(ctx).toHaveLength(72);
    });
  });

  describe('replaceWikiLink', () => {
    it('替换 [[oldName]] 为 [[newName]]', () => {
      expect(replaceWikiLink('参见 [[旧名]] 即可', '旧名', '新名')).toBe(
        '参见 [[新名]] 即可',
      );
    });

    it('替换所有出现的双链', () => {
      const content = '一 [[节点]] 二 [[节点]] 三 [[节点]]';
      expect(replaceWikiLink(content, '节点', '新节点')).toBe(
        '一 [[新节点]] 二 [[新节点]] 三 [[新节点]]',
      );
    });

    it('区分大小写（仅替换完全匹配）', () => {
      const content = '[[Graph]] 与 [[graph]]';
      // 仅替换 [[Graph]]，保留 [[graph]]
      expect(replaceWikiLink(content, 'Graph', 'G')).toBe('[[G]] 与 [[graph]]');
    });

    it('空内容返回原内容', () => {
      expect(replaceWikiLink('', 'old', 'new')).toBe('');
    });

    it('空 oldName 返回原内容', () => {
      expect(replaceWikiLink('[[old]]', '', 'new')).toBe('[[old]]');
    });

    it('oldName === newName 返回原内容', () => {
      expect(replaceWikiLink('[[节点]]', '节点', '节点')).toBe('[[节点]]');
    });

    it('含正则特殊字符的 oldName 被正确转义', () => {
      // oldName 含 ( ) [ ] . 等正则特殊字符
      expect(
        replaceWikiLink('参见 [[node(1).sub]] 即可', 'node(1).sub', 'new'),
      ).toBe('参见 [[new]] 即可');
    });

    it('无匹配时返回原内容', () => {
      expect(replaceWikiLink('没有双链的文本', 'old', 'new')).toBe(
        '没有双链的文本',
      );
    });

    it('部分匹配不被替换（仅替换完整 [[name]]）', () => {
      // [[节点A]] 不应被替换为 [[新节点A]]，因为 oldName 是 "节点"
      expect(replaceWikiLink('[[节点A]]', '节点', '新节点')).toBe('[[节点A]]');
    });
  });
});
