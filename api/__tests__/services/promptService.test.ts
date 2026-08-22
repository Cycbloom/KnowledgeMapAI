import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PromptTemplate } from "../../services/ai/promptConstants";

// Mock cacheService 以绕过缓存（始终调用 fetchFn），避免测试间缓存状态泄露。
vi.mock("../../services/common/cacheService", () => ({
  cacheService: {
    getOrSet: vi.fn(
      async (_key: string, fetchFn: () => Promise<unknown>) => fetchFn(),
    ),
    get: vi.fn(async () => undefined),
    set: vi.fn(async () => true),
    del: vi.fn(async () => 1),
    delByTags: vi.fn(async () => 1),
    invalidateGraphCache: vi.fn(async () => undefined),
  },
  CacheKeys: {
    PROMPT_TEMPLATE: (code: string, userId = "system", graphId = "none") =>
      `prompt_template_${code}_${userId}_${graphId}`,
  },
}));

// Mock factory 以避免 provider 初始化副作用（仅在 optimizeWithAI 中使用，此处不测试）
vi.mock("../../services/ai/factory", () => ({
  getAIProviderForTask: vi.fn(),
}));

// Mock supabase admin（仅 optimizeWithAI 使用，此处不测试）
vi.mock("../../supabase", () => ({
  getSupabaseAdmin: vi.fn(),
}));

import { promptService } from "../../services/ai/promptService";
import { createMockSupabase } from "../../../tests/helpers/mockFactories";

// Helper: 构建测试用 PromptTemplate
const createTemplate = (
  overrides: Partial<PromptTemplate> = {},
): PromptTemplate => ({
  id: `tpl-${Math.random().toString(36).slice(2)}`,
  code: "test_code",
  scope: "system",
  template_content: "Hello {{name}}",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

// getRenderedPrompt 末尾追加的语言指令
const ZH_INSTRUCTION = "Please respond in Chinese.";
const EN_INSTRUCTION = "Please respond in English.";

describe("PromptService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================
  // getRenderedPrompt() - 变量替换
  // ============================================================
  describe("getRenderedPrompt() - 变量替换", () => {
    it("替换单个 {{variable}} 为提供的值", async () => {
      const tpl = createTemplate({ template_content: "Hello {{name}}!" });
      const supabase = createMockSupabase({ data: [tpl] });

      const result = await promptService.getRenderedPrompt(
        supabase,
        "test_code",
        { name: "World" },
      );

      expect(result).toContain("Hello World!");
    });

    it("替换多个变量", async () => {
      const tpl = createTemplate({
        template_content: "{{greeting}}, {{name}}! You are {{role}}.",
      });
      const supabase = createMockSupabase({ data: [tpl] });

      const result = await promptService.getRenderedPrompt(
        supabase,
        "test_code",
        { greeting: "Hi", name: "Alice", role: "admin" },
      );

      expect(result).toContain("Hi, Alice! You are admin.");
    });

    it("处理条件块 {{#if variable}}...{{/if}} (truthy)", async () => {
      const tpl = createTemplate({
        template_content: "Start{{#if show}} [visible]{{/if}} End",
      });
      const supabase = createMockSupabase({ data: [tpl] });

      const result = await promptService.getRenderedPrompt(
        supabase,
        "test_code",
        { show: true },
      );

      expect(result).toContain("Start [visible] End");
    });

    it("处理条件块 {{#if variable}}...{{/if}} (falsy - 跳过)", async () => {
      const tpl = createTemplate({
        template_content: "Start{{#if show}} [visible]{{/if}} End",
      });
      const supabase = createMockSupabase({ data: [tpl] });

      const result = await promptService.getRenderedPrompt(
        supabase,
        "test_code",
        { show: false },
      );

      expect(result).toContain("Start End");
      expect(result).not.toContain("[visible]");
    });

    it("处理条件块 {{#if variable}}...{{else}}...{{/if}}", async () => {
      const tpl = createTemplate({
        template_content: "{{#if vip}}VIP{{else}}Normal{{/if}}",
      });
      const supabase = createMockSupabase({ data: [tpl] });

      const truthy = await promptService.getRenderedPrompt(
        supabase,
        "test_code",
        { vip: true },
      );
      expect(truthy).toContain("VIP");
      expect(truthy).not.toContain("Normal");

      const falsy = await promptService.getRenderedPrompt(
        supabase,
        "test_code",
        { vip: false },
      );
      expect(falsy).toContain("Normal");
      expect(falsy).not.toContain("VIP");
    });

    it("模板中存在变量但 context 未提供 → 替换为空字符串", async () => {
      const tpl = createTemplate({
        template_content: "Hello {{name}}, welcome to {{place}}!",
      });
      const supabase = createMockSupabase({ data: [tpl] });

      const result = await promptService.getRenderedPrompt(
        supabase,
        "test_code",
        { name: "Alice" }, // place 缺失
      );

      // TemplateEngine 对缺失/undefined/null 变量替换为空字符串
      expect(result).toContain("Hello Alice, welcome to !");
      expect(result).not.toContain("{{place}}");
    });
  });

  // ============================================================
  // getRenderedPrompt() - 三层优先级 (System < User < Graph)
  // ============================================================
  describe("getRenderedPrompt() - 三层优先级 (System < User < Graph)", () => {
    it("仅 System 模板存在 → 返回 System 模板", async () => {
      const systemTpl = createTemplate({
        scope: "system",
        template_content: "System content",
      });
      const supabase = createMockSupabase({ data: [systemTpl] });

      const result = await promptService.getRenderedPrompt(
        supabase,
        "test_code",
        {},
      );

      expect(result).toContain("System content");
    });

    it("System + User 模板存在 → 返回 User 模板 (覆盖 System)", async () => {
      const systemTpl = createTemplate({
        scope: "system",
        template_content: "System content",
      });
      const userTpl = createTemplate({
        scope: "user",
        user_id: "user-123",
        template_content: "User content",
      });
      const supabase = createMockSupabase({
        data: [systemTpl, userTpl],
      });

      const result = await promptService.getRenderedPrompt(
        supabase,
        "test_code",
        {},
        "user-123",
      );

      expect(result).toContain("User content");
      expect(result).not.toContain("System content");
    });

    it("System + User + Graph 模板存在 → 返回 Graph 模板 (覆盖两者)", async () => {
      const systemTpl = createTemplate({
        scope: "system",
        template_content: "System content",
      });
      const userTpl = createTemplate({
        scope: "user",
        user_id: "user-123",
        template_content: "User content",
      });
      const graphTpl = createTemplate({
        scope: "graph",
        graph_id: "graph-456",
        template_content: "Graph content",
      });
      const supabase = createMockSupabase({
        data: [systemTpl, userTpl, graphTpl],
      });

      const result = await promptService.getRenderedPrompt(
        supabase,
        "test_code",
        {},
        "user-123",
        "graph-456",
      );

      expect(result).toContain("Graph content");
      expect(result).not.toContain("User content");
      expect(result).not.toContain("System content");
    });

    it("无任何模板且无默认 prompt → 返回空内容 (仅含语言指令)", async () => {
      const supabase = createMockSupabase({ data: [] });

      const result = await promptService.getRenderedPrompt(
        supabase,
        "nonexistent_code_xyz",
        {},
      );

      // 无模板 + 无默认 prompt → content 为空字符串，仅追加语言指令
      expect(result).toBe(`\n\n${ZH_INSTRUCTION}`);
    });

    it("无模板但有默认 prompt → 返回渲染后的默认 prompt", async () => {
      const supabase = createMockSupabase({ data: [] });

      // knowledge_gap_analysis 存在于 DEFAULT_PROMPTS
      const result = await promptService.getRenderedPrompt(
        supabase,
        "knowledge_gap_analysis",
        {},
      );

      expect(result).toContain("知识图谱分析专家");
    });
  });

  // ============================================================
  // 优先级与变量渲染组合
  // ============================================================
  describe("getRenderedPrompt() - 优先级与变量渲染组合", () => {
    it("获胜层级 (User) 的模板变量被正确渲染", async () => {
      const systemTpl = createTemplate({
        scope: "system",
        template_content: "System: {{topic}}",
      });
      const userTpl = createTemplate({
        scope: "user",
        user_id: "user-123",
        template_content: "User: {{topic}}",
      });
      const supabase = createMockSupabase({ data: [systemTpl, userTpl] });

      const result = await promptService.getRenderedPrompt(
        supabase,
        "test_code",
        { topic: "AI" },
        "user-123",
      );

      expect(result).toContain("User: AI");
      expect(result).not.toContain("System: AI");
      expect(result).not.toContain("{{topic}}");
    });

    it("获胜层级 (Graph) 的模板变量被正确渲染", async () => {
      const systemTpl = createTemplate({
        scope: "system",
        template_content: "System: {{topic}}",
      });
      const graphTpl = createTemplate({
        scope: "graph",
        graph_id: "graph-456",
        template_content: "Graph: {{topic}}",
      });
      const supabase = createMockSupabase({ data: [systemTpl, graphTpl] });

      const result = await promptService.getRenderedPrompt(
        supabase,
        "test_code",
        { topic: "Knowledge Graph" },
        "user-123",
        "graph-456",
      );

      expect(result).toContain("Graph: Knowledge Graph");
      expect(result).not.toContain("System:");
    });
  });

  // ============================================================
  // 边界情况
  // ============================================================
  describe("getRenderedPrompt() - 边界情况", () => {
    it("空模板 → 返回空内容 (仅含语言指令)", async () => {
      const tpl = createTemplate({ template_content: "" });
      const supabase = createMockSupabase({ data: [tpl] });

      const result = await promptService.getRenderedPrompt(
        supabase,
        "test_code",
        {},
      );

      expect(result).toBe(`\n\n${ZH_INSTRUCTION}`);
    });

    it("模板无变量 → 原样返回", async () => {
      const tpl = createTemplate({
        template_content: "This is a static template with no variables.",
      });
      const supabase = createMockSupabase({ data: [tpl] });

      const result = await promptService.getRenderedPrompt(
        supabase,
        "test_code",
        {},
      );

      expect(result).toContain(
        "This is a static template with no variables.",
      );
    });

    it("变量值含特殊字符 → 安全处理 (原样保留)", async () => {
      const tpl = createTemplate({
        template_content: "Content: {{value}}",
      });
      const supabase = createMockSupabase({ data: [tpl] });
      const specialValue = `<script>alert('xss')</script> & "quotes" \\n`;

      const result = await promptService.getRenderedPrompt(
        supabase,
        "test_code",
        { value: specialValue },
      );

      // TemplateEngine 使用 String(value)，不做转义，原样输出
      expect(result).toContain(specialValue);
    });

    it("超长模板 → 不截断", async () => {
      const longContent = "A".repeat(10000);
      const tpl = createTemplate({
        template_content: `Prefix ${longContent} Suffix`,
      });
      const supabase = createMockSupabase({ data: [tpl] });

      const result = await promptService.getRenderedPrompt(
        supabase,
        "test_code",
        {},
      );

      expect(result).toContain(`Prefix ${longContent} Suffix`);
      expect(result.length).toBeGreaterThanOrEqual(10000);
    });

    it("{{outputLanguage}} 占位符 → 替换为 English (en-US)", async () => {
      // learning_material 在 OUTPUT_SCHEMAS 中，schema 含 {{outputLanguage}}
      const supabase = createMockSupabase({ data: [] });

      const result = await promptService.getRenderedPrompt(
        supabase,
        "learning_material",
        { topic: "AI", context: "context" },
        undefined,
        undefined,
        "en-US",
      );

      expect(result).toContain("English");
      expect(result).not.toContain("{{outputLanguage}}");
    });

    it("{{outputLanguage}} 占位符 → 替换为 Chinese (默认语言)", async () => {
      const supabase = createMockSupabase({ data: [] });

      const result = await promptService.getRenderedPrompt(
        supabase,
        "learning_material",
        { topic: "AI", context: "context" },
      );

      expect(result).toContain("Chinese");
      expect(result).not.toContain("{{outputLanguage}}");
    });

    it("{{categoryOptions}} 占位符 → 替换为本地化分类列表 (中文)", async () => {
      const supabase = createMockSupabase({ data: [] });

      const result = await promptService.getRenderedPrompt(
        supabase,
        "learning_material",
        { topic: "AI", context: "context" },
      );

      expect(result).toContain("定义");
      expect(result).toContain("概念");
      expect(result).not.toContain("{{categoryOptions}}");
    });

    it("language=en-US → 追加 English 语言指令", async () => {
      const tpl = createTemplate({ template_content: "Hello" });
      const supabase = createMockSupabase({ data: [tpl] });

      const result = await promptService.getRenderedPrompt(
        supabase,
        "test_code",
        {},
        undefined,
        undefined,
        "en-US",
      );

      expect(result).toContain(EN_INSTRUCTION);
    });

    it("language=zh-CN → 追加 Chinese 语言指令", async () => {
      const tpl = createTemplate({ template_content: "你好" });
      const supabase = createMockSupabase({ data: [tpl] });

      const result = await promptService.getRenderedPrompt(
        supabase,
        "test_code",
        {},
        undefined,
        undefined,
        "zh-CN",
      );

      expect(result).toContain(ZH_INSTRUCTION);
    });

    it("模板正文中的 {{outputLanguage}} → 渲染为 English (en-US)", async () => {
      // 回归：模板正文占位符必须由 TemplateEngine 渲染，而非被替换为空字符串
      const tpl = createTemplate({
        template_content: "Please write the learning material and keywords in {{outputLanguage}}.",
      });
      const supabase = createMockSupabase({ data: [tpl] });

      const result = await promptService.getRenderedPrompt(
        supabase,
        "test_code",
        {},
        undefined,
        undefined,
        "en-US",
      );

      expect(result).toContain(
        "Please write the learning material and keywords in English.",
      );
      expect(result).not.toContain("in .");
    });

    it("模板正文中的 {{outputLanguage}} → 渲染为 Chinese (zh-CN)", async () => {
      const tpl = createTemplate({
        template_content: "Please write the learning material and keywords in {{outputLanguage}}.",
      });
      const supabase = createMockSupabase({ data: [tpl] });

      const result = await promptService.getRenderedPrompt(
        supabase,
        "test_code",
        {},
        undefined,
        undefined,
        "zh-CN",
      );

      expect(result).toContain(
        "Please write the learning material and keywords in Chinese.",
      );
      expect(result).not.toContain("in .");
    });
  });

  // ============================================================
  // getTemplate() 直接测试优先级排序
  // ============================================================
  describe("getTemplate()", () => {
    it("返回权重最高的模板 (Graph > User > System)", async () => {
      const systemTpl = createTemplate({
        id: "sys-1",
        scope: "system",
        template_content: "System",
      });
      const userTpl = createTemplate({
        id: "usr-1",
        scope: "user",
        user_id: "user-1",
        template_content: "User",
      });
      const graphTpl = createTemplate({
        id: "grp-1",
        scope: "graph",
        graph_id: "graph-1",
        template_content: "Graph",
      });
      const supabase = createMockSupabase({
        data: [systemTpl, userTpl, graphTpl],
      });

      const result = await promptService.getTemplate(
        supabase,
        "test_code",
        "user-1",
        "graph-1",
      );

      expect(result).not.toBeNull();
      expect(result?.id).toBe("grp-1");
      expect(result?.scope).toBe("graph");
    });

    it("仅 System 模板 → 返回 System 模板", async () => {
      const systemTpl = createTemplate({
        id: "sys-only",
        scope: "system",
        template_content: "Only system",
      });
      const supabase = createMockSupabase({ data: [systemTpl] });

      const result = await promptService.getTemplate(
        supabase,
        "test_code",
      );

      expect(result).not.toBeNull();
      expect(result?.id).toBe("sys-only");
      expect(result?.scope).toBe("system");
    });

    it("User 模板覆盖 System 模板", async () => {
      const systemTpl = createTemplate({
        id: "sys-2",
        scope: "system",
        template_content: "System",
      });
      const userTpl = createTemplate({
        id: "usr-2",
        scope: "user",
        user_id: "user-2",
        template_content: "User",
      });
      const supabase = createMockSupabase({
        data: [systemTpl, userTpl],
      });

      const result = await promptService.getTemplate(
        supabase,
        "test_code",
        "user-2",
      );

      expect(result).not.toBeNull();
      expect(result?.id).toBe("usr-2");
      expect(result?.scope).toBe("user");
    });

    it("无匹配模板 → 返回 null", async () => {
      const supabase = createMockSupabase({ data: [] });

      const result = await promptService.getTemplate(
        supabase,
        "nonexistent_code",
      );

      expect(result).toBeNull();
    });
  });
});
