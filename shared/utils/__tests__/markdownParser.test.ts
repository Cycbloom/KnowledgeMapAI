import { describe, it, expect } from 'vitest';
import { parseMarkdownToGraph } from '../markdownParser';

describe('markdownParser', () => {
  describe('parseMarkdownToGraph 基本解析', () => {
    it('空字符串返回空图谱', () => {
      const result = parseMarkdownToGraph('');
      expect(result.graph_title).toBe('Untitled Graph');
      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
    });

    it('仅空白字符串返回空图谱', () => {
      const result = parseMarkdownToGraph('   \n\n  ');
      expect(result.nodes).toHaveLength(0);
      expect(result.graph_title).toBe('Untitled Graph');
    });

    it('首个 H1 作为图谱标题', () => {
      const result = parseMarkdownToGraph('# 我的图谱\n\n内容');
      expect(result.graph_title).toBe('我的图谱');
    });

    it('无 H1 时标题为 Untitled Graph', () => {
      const result = parseMarkdownToGraph('## 二级标题\n\n内容');
      expect(result.graph_title).toBe('Untitled Graph');
    });
  });

  describe('节点层级与颜色', () => {
    it('H1 → root 级别，紫色', () => {
      const result = parseMarkdownToGraph('# 根节点');
      expect(result.nodes[0].level).toBe('root');
      expect(result.nodes[0].color).toBe('#8B5CF6');
    });

    it('H2 → core 级别，红色', () => {
      const result = parseMarkdownToGraph('## 核心节点');
      expect(result.nodes[0].level).toBe('core');
      expect(result.nodes[0].color).toBe('#EF4444');
    });

    it('H3 → sub 级别，橙色', () => {
      const result = parseMarkdownToGraph('### 子节点');
      expect(result.nodes[0].level).toBe('sub');
      expect(result.nodes[0].color).toBe('#F59E0B');
    });

    it('H4 → normal 级别，蓝色', () => {
      const result = parseMarkdownToGraph('#### 普通节点');
      expect(result.nodes[0].level).toBe('normal');
      expect(result.nodes[0].color).toBe('#3B82F6');
    });

    it('H5/H6 → leaf 级别，绿色', () => {
      const r5 = parseMarkdownToGraph('##### 叶子节点');
      expect(r5.nodes[0].level).toBe('leaf');
      expect(r5.nodes[0].color).toBe('#10B981');

      const r6 = parseMarkdownToGraph('###### 深层节点');
      expect(r6.nodes[0].level).toBe('leaf');
      expect(r6.nodes[0].color).toBe('#10B981');
    });
  });

  describe('节点 id 生成', () => {
    it('节点 id 形如 md-node-{n}', () => {
      const result = parseMarkdownToGraph('# 一\n## 二\n### 三');
      expect(result.nodes.map((n) => n.id)).toEqual([
        'md-node-1',
        'md-node-2',
        'md-node-3',
      ]);
    });
  });

  describe('父子边（contains）', () => {
    it('H1 → H2 生成 contains 边', () => {
      const result = parseMarkdownToGraph('# 父\n## 子');
      expect(result.edges).toHaveLength(1);
      expect(result.edges[0].source).toBe('md-node-1');
      expect(result.edges[0].target).toBe('md-node-2');
      expect(result.edges[0].relationship).toBe('contains');
    });

    it('多层嵌套生成链式 contains 边', () => {
      const result = parseMarkdownToGraph('# A\n## B\n### C');
      expect(result.edges).toHaveLength(2);
      // A→B, B→C
      expect(result.edges[0]).toEqual({
        source: 'md-node-1',
        target: 'md-node-2',
        relationship: 'contains',
      });
      expect(result.edges[1]).toEqual({
        source: 'md-node-2',
        target: 'md-node-3',
        relationship: 'contains',
      });
    });

    it('同级标题不生成 contains 边', () => {
      const result = parseMarkdownToGraph('# A\n# B\n# C');
      expect(result.edges).toHaveLength(0);
    });

    it('回到上级后新分支正确建立父子关系', () => {
      // A(h1) > B(h2) > C(h3), 然后 D(h2) 应以 A 为父
      const result = parseMarkdownToGraph('# A\n## B\n### C\n## D');
      // 期望边: A→B, B→C, A→D
      expect(result.edges).toHaveLength(3);
      const dEdge = result.edges.find((e) => e.target === 'md-node-4');
      expect(dEdge?.source).toBe('md-node-1');
      expect(dEdge?.relationship).toBe('contains');
    });
  });

  describe('双链边（relates_to）', () => {
    it('[[目标]] 指向非父子的已存在节点生成 relates_to 边', () => {
      // A(h1) > B(h2), A > C(h2)；B 中双链 [[C]] 应生成 B→C 的 relates_to
      // B 与 C 之间无 contains 边，故可生成 relates_to
      const md = '# A\n\n## B\n\n参见 [[C]]\n\n## C';
      const result = parseMarkdownToGraph(md);
      const relatesTo = result.edges.filter(
        (e) => e.relationship === 'relates_to',
      );
      expect(relatesTo).toHaveLength(1);
      expect(relatesTo[0].source).toBe('md-node-2'); // B
      expect(relatesTo[0].target).toBe('md-node-3'); // C
    });

    it('双链指向不存在的标题不生成边', () => {
      const md = '# 节点\n\n参见 [[不存在的节点]]';
      const result = parseMarkdownToGraph(md);
      expect(result.edges).toHaveLength(0);
    });

    it('双链自引用不生成边', () => {
      const md = '# 节点\n\n参见 [[节点]]';
      const result = parseMarkdownToGraph(md);
      const relatesTo = result.edges.filter(
        (e) => e.relationship === 'relates_to',
      );
      expect(relatesTo).toHaveLength(0);
    });

    it('双链指向父子节点不生成 relates_to（contains 已存在）', () => {
      // B 是 A 的子节点，B 双链 [[A]]：A→B 的 contains 已存在，去重逻辑阻止生成
      const md = '# A\n\n## B\n\n参见 [[A]]';
      const result = parseMarkdownToGraph(md);
      const relatesTo = result.edges.filter(
        (e) => e.relationship === 'relates_to',
      );
      expect(relatesTo).toHaveLength(0);
    });

    it('重复双链指向同一非父子节点仅生成一条 relates_to', () => {
      // B 与 C 之间无 contains，多次 [[C]] 仅生成一条 relates_to
      const md = '# A\n\n## B\n\n[[C]] [[C]] [[C]]\n\n## C';
      const result = parseMarkdownToGraph(md);
      const relatesTo = result.edges.filter(
        (e) => e.relationship === 'relates_to',
      );
      expect(relatesTo).toHaveLength(1);
    });
  });

  describe('内容累积', () => {
    it('标题下非空行累积为 content', () => {
      const md = '# 标题\n\n第一段\n\n第二段';
      const result = parseMarkdownToGraph(md);
      expect(result.nodes[0].content).toBe('第一段\n第二段');
    });

    it('空行不累积到 content', () => {
      const md = '# 标题\n\n\n\n内容';
      const result = parseMarkdownToGraph(md);
      expect(result.nodes[0].content).toBe('内容');
    });

    it('无标题时整段文本作为单个 root 节点', () => {
      const md = '这是没有标题的纯文本内容';
      const result = parseMarkdownToGraph(md);
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].level).toBe('root');
      expect(result.nodes[0].content).toBe(md);
      // 标题取前 20 字符
      expect(result.nodes[0].title).toBe(md);
      expect(result.graph_title).toBe(md);
    });

    it('无标题时标题截取前 20 字符', () => {
      const longText = '这是一段超过二十个字符的纯文本内容用于测试截取功能';
      const result = parseMarkdownToGraph(longText);
      expect(result.nodes[0].title).toHaveLength(20);
      expect(result.nodes[0].title).toBe(longText.substring(0, 20));
    });
  });

  describe('边界情况', () => {
    it('多个 H1 时仅首个作为图谱标题', () => {
      const md = '# 第一个 H1\n\n# 第二个 H1';
      const result = parseMarkdownToGraph(md);
      expect(result.graph_title).toBe('第一个 H1');
      expect(result.nodes).toHaveLength(2);
    });

    it('标题行后的内容累积到对应节点', () => {
      const md = '# A\nA 的内容\n## B\nB 的内容';
      const result = parseMarkdownToGraph(md);
      const a = result.nodes.find((n) => n.id === 'md-node-1');
      const b = result.nodes.find((n) => n.id === 'md-node-2');
      expect(a?.content).toBe('A 的内容');
      expect(b?.content).toBe('B 的内容');
    });

    it('x_position 与 y_position 为数字', () => {
      const result = parseMarkdownToGraph('# 节点');
      expect(typeof result.nodes[0].x_position).toBe('number');
      expect(typeof result.nodes[0].y_position).toBe('number');
    });
  });
});
