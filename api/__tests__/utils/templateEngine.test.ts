import { describe, it, expect } from "vitest";
import { TemplateEngine } from "../../utils/templateEngine";

describe("TemplateEngine", () => {
  describe("变量替换", () => {
    it("替换 {{variable}}", () => {
      expect(TemplateEngine.render("Hello {{name}}!", { name: "World" })).toBe(
        "Hello World!",
      );
    });

    it("缺失变量替换为空字符串", () => {
      expect(TemplateEngine.render("Hello {{missing}}!", {})).toBe("Hello !");
    });

    it("数组变量默认用逗号拼接", () => {
      expect(TemplateEngine.render("{{items}}", { items: ["a", "b"] })).toBe(
        "a, b",
      );
    });
  });

  describe("{{join}} helper", () => {
    it("按指定分隔符拼接数组", () => {
      expect(
        TemplateEngine.render("核心概念：{{join core_concepts ', '}}", {
          core_concepts: ["A", "B", "C"],
        }),
      ).toBe("核心概念：A, B, C");
    });

    it("非数组返回空字符串", () => {
      expect(
        TemplateEngine.render("{{join val ', '}}", { val: "not-array" }),
      ).toBe("");
    });
  });

  describe("{{#if}} 条件块", () => {
    it("truthy 渲染块内容", () => {
      expect(
        TemplateEngine.render("Start{{#if show}} [yes]{{/if}} End", {
          show: true,
        }),
      ).toBe("Start [yes] End");
    });

    it("falsy 跳过块内容", () => {
      expect(
        TemplateEngine.render("Start{{#if show}} [yes]{{/if}} End", {
          show: false,
        }),
      ).toBe("Start End");
    });

    it("支持 {{else}}", () => {
      expect(
        TemplateEngine.render("{{#if vip}}VIP{{else}}Normal{{/if}}", {
          vip: false,
        }),
      ).toBe("Normal");
    });

    it("支持嵌套 if", () => {
      const tpl =
        "{{#if a}}{{#if b}}AB{{else}}A{{/if}}{{else}}none{{/if}}";
      expect(TemplateEngine.render(tpl, { a: true, b: true })).toBe("AB");
      expect(TemplateEngine.render(tpl, { a: true, b: false })).toBe("A");
      expect(TemplateEngine.render(tpl, { a: false })).toBe("none");
    });
  });

  describe("{{#each}} 迭代块", () => {
    it("遍历对象数组，块内引用当前项属性", () => {
      const tpl =
        "{{#each graphs}}\n### {{title}} ({{node_count}})\n{{/each}}";
      const result = TemplateEngine.render(tpl, {
        graphs: [
          { title: "G1", node_count: 3 },
          { title: "G2", node_count: 5 },
        ],
      });
      expect(result).toBe("\n### G1 (3)\n\n### G2 (5)\n");
    });

    it("块内 {{join}} 处理当前项数组字段", () => {
      const tpl = "{{#each graphs}}{{join core_concepts ', '}}{{/each}}";
      const result = TemplateEngine.render(tpl, {
        graphs: [
          { core_concepts: ["A", "B"] },
          { core_concepts: ["C"] },
        ],
      });
      expect(result).toBe("A, BC");
    });

    it("标量数组可用 {{this}}", () => {
      expect(
        TemplateEngine.render("{{#each tags}}[{{this}}]{{/each}}", {
          tags: ["x", "y"],
        }),
      ).toBe("[x][y]");
    });

    it("空数组输出空", () => {
      expect(
        TemplateEngine.render("{{#each items}}[{{this}}]{{/each}}", {
          items: [],
        }),
      ).toBe("");
    });

    it("each 块内仍可访问外层变量", () => {
      const tpl = "{{#each graphs}}{{title}}:{{max}}{{/each}}";
      expect(
        TemplateEngine.render(tpl, {
          graphs: [{ title: "A" }, { title: "B" }],
          max: 9,
        }),
      ).toBe("A:9B:9");
    });

    it("each 与 if 嵌套", () => {
      const tpl = "{{#each graphs}}{{#if core}}core{{else}}leaf{{/if}}{{/each}}";
      expect(
        TemplateEngine.render(tpl, {
          graphs: [{ core: true }, { core: false }],
        }),
      ).toBe("coreleaf");
    });
  });

  describe("未闭合块", () => {
    it("未闭合 {{#if}} 原样保留", () => {
      expect(TemplateEngine.render("a {{#if x}} b", {})).toBe("a {{#if x}} b");
    });

    it("未闭合 {{#each}} 原样保留", () => {
      expect(TemplateEngine.render("a {{#each x}} b", { x: [] })).toBe(
        "a {{#each x}} b",
      );
    });
  });
});
