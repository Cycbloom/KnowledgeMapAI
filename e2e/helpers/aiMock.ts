import type { Page } from "@playwright/test";

/**
 * E2E 测试 AI Mock Helper
 *
 * 通过 Playwright page.route() 拦截 AI 相关的后端 API，
 * 返回确定性 mock 响应，使 E2E 测试在无真实 AI key 的环境下
 * 也能验证完整的前端交互流程。
 *
 * 拦截的接口：
 * - POST /api/literature/extract — 概念提取
 * - POST /api/literature/apply   — 概念挂载应用到骨干节点
 */

/**
 * Mock 会话 ID，用于 extract 响应的 sessionId 字段。
 */
const MOCK_SESSION_ID = "mock-session-id";

/**
 * Mock 文献信息，同时用于 extract 响应的 literature 字段
 * 与每个概念的 source 字段。
 */
const MOCK_LITERATURE = {
  title: "测试文献",
  type: "article",
  processedAt: "2026-01-01T00:00:00.000Z",
} as const;

/**
 * Mock 概念列表（6 个，对应全部 6 个骨干模块）。
 *
 * 每个概念的 targetModule 覆盖一个 BackboneModule，
 * similarity 位于 0.8-0.95 区间，description 均 ≥ 20 个中文字符。
 */
const MOCK_CONCEPTS = [
  {
    title: "研究背景概述",
    description: "本节梳理该研究领域的发展历程与核心背景知识，涵盖关键里程碑事件。",
    type: "concept",
    source: MOCK_LITERATURE,
    targetModule: "research_background",
    similarity: 0.85,
    crossGraphMatch: null,
  },
  {
    title: "文献综述分析",
    description: "系统综述相关领域的现有文献成果，归纳主要研究脉络与理论分歧。",
    type: "theory",
    source: MOCK_LITERATURE,
    targetModule: "literature_review",
    similarity: 0.88,
    crossGraphMatch: null,
  },
  {
    title: "研究方法论",
    description: "详细阐述本研究采用的方法论框架与具体技术路线，保证研究可复现。",
    type: "method",
    source: MOCK_LITERATURE,
    targetModule: "research_methods",
    similarity: 0.92,
    crossGraphMatch: null,
  },
  {
    title: "核心概念定义",
    description: "明确界定领域的核心概念体系与理论框架，为后续分析奠定坚实基础。",
    type: "concept",
    source: MOCK_LITERATURE,
    targetModule: "core_concepts",
    similarity: 0.9,
    crossGraphMatch: null,
  },
  {
    title: "应用领域案例",
    description: "列举该理论方法在多个实际应用领域中的典型案例与落地效果分析。",
    type: "technology",
    source: MOCK_LITERATURE,
    targetModule: "application_domains",
    similarity: 0.87,
    crossGraphMatch: null,
  },
  {
    title: "未来发展方向",
    description: "展望该研究领域未来的发展趋势与潜在突破方向，指明后续研究路径。",
    type: "trend",
    source: MOCK_LITERATURE,
    targetModule: "future_directions",
    similarity: 0.83,
    crossGraphMatch: null,
  },
] as const;

/**
 * Mock 概念关系列表（3 个关系）。
 */
const MOCK_RELATIONS = [
  {
    source: "研究背景概述",
    target: "文献综述分析",
    type: "related_to",
    confidence: 0.9,
  },
  {
    source: "研究方法论",
    target: "核心概念定义",
    type: "depends_on",
    confidence: 0.85,
  },
  {
    source: "应用领域案例",
    target: "未来发展方向",
    type: "leads_to",
    confidence: 0.8,
  },
] as const;

/**
 * Mock apply 响应：概念标题到 mock 节点 ID 的映射。
 */
const MOCK_NODE_MAPPING = {
  研究背景概述: "mock-node-1",
  文献综述分析: "mock-node-2",
  研究方法论: "mock-node-3",
  核心概念定义: "mock-node-4",
  应用领域案例: "mock-node-5",
  未来发展方向: "mock-node-6",
} as const;

/**
 * Mock apply 响应：每个概念挂载到对应骨干节点的详情。
 */
const MOCK_MOUNTING_DETAILS = [
  {
    conceptTitle: "研究背景概述",
    targetModule: "research_background",
    mountedTo: "mock-backbone-1",
    status: "success",
  },
  {
    conceptTitle: "文献综述分析",
    targetModule: "literature_review",
    mountedTo: "mock-backbone-2",
    status: "success",
  },
  {
    conceptTitle: "研究方法论",
    targetModule: "research_methods",
    mountedTo: "mock-backbone-3",
    status: "success",
  },
  {
    conceptTitle: "核心概念定义",
    targetModule: "core_concepts",
    mountedTo: "mock-backbone-4",
    status: "success",
  },
  {
    conceptTitle: "应用领域案例",
    targetModule: "application_domains",
    mountedTo: "mock-backbone-5",
    status: "success",
  },
  {
    conceptTitle: "未来发展方向",
    targetModule: "future_directions",
    mountedTo: "mock-backbone-6",
    status: "success",
  },
] as const;

/**
 * Mock /api/literature/apply 成功响应体。
 */
const MOCK_APPLY_RESPONSE = {
  success: true,
  addedCount: 6,
  mergedCount: 0,
  nodeMapping: MOCK_NODE_MAPPING,
  mountingDetails: MOCK_MOUNTING_DETAILS,
} as const;

/**
 * 拦截 POST /api/literature/extract，返回预设的概念提取结果。
 *
 * 返回 6 个概念（覆盖全部 6 个骨干模块）、3 个关系及文献元信息，
 * 使前端能完整走通「提取 → 预览 → 确认添加」流程而无需真实 AI 服务。
 *
 * @param page - Playwright Page 实例
 */
export async function mockLiteratureExtract(page: Page): Promise<void> {
  await page.route("**/api/literature/extract", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sessionId: MOCK_SESSION_ID,
        concepts: MOCK_CONCEPTS,
        relations: MOCK_RELATIONS,
        literature: MOCK_LITERATURE,
      }),
    });
  });
}

/**
 * 拦截 POST /api/literature/apply，返回预设的概念挂载结果。
 *
 * 返回 success=true、addedCount=6、mergedCount=0，并附带每个概念
 * 到骨干节点的挂载详情（mountingDetails），使前端能验证挂载成功状态。
 *
 * @param page - Playwright Page 实例
 */
export async function mockLiteratureApply(page: Page): Promise<void> {
  await page.route("**/api/literature/apply", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_APPLY_RESPONSE),
    });
  });
}

/**
 * 便捷函数：并行注册 extract 与 apply 两个 AI 接口拦截器。
 *
 * 在测试 beforeEach 中调用 `await setupAIMocks(page)` 即可一次性
 * 拦截全部文献提取相关 AI 接口。
 *
 * @param page - Playwright Page 实例
 */
export async function setupAIMocks(page: Page): Promise<void> {
  await Promise.all([mockLiteratureExtract(page), mockLiteratureApply(page)]);
}
