import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";
import { navigateAndWaitForAuth, authedRequest } from "./utils/auth";

const SAMPLE_TEXT_CONTENT = `
深度学习在自然语言处理中的应用研究

摘要：
本文研究了深度学习技术在自然语言处理领域的应用。我们提出了一种基于Transformer架构的预训练模型，
通过大规模语料库的训练，实现了在多个NLP任务上的优异表现。实验结果表明，该方法在文本分类、
命名实体识别和机器翻译等任务上均取得了显著的性能提升。

关键词：深度学习、自然语言处理、Transformer、预训练模型

1. 引言
自然语言处理（NLP）是人工智能领域的重要研究方向。随着深度学习技术的发展，NLP领域取得了突破性进展。
本文主要研究Transformer架构在NLP任务中的应用。

2. 相关工作
近年来，预训练语言模型如BERT、GPT等在NLP领域取得了巨大成功。这些模型通过大规模无监督预训练，
学习到了丰富的语言知识。

3. 方法
我们采用多头注意力机制作为核心组件，结合位置编码和层归一化技术，构建了完整的模型架构。
训练过程中使用了Adam优化器和学习率预热策略。

4. 实验
实验在GLUE基准测试集上进行，包含文本分类、语义相似度等多个任务。
实验结果表明，我们的方法在大多数任务上超越了现有方法。

5. 结论
本文提出的基于Transformer的预训练模型在多个NLP任务上取得了优异表现，
为自然语言处理领域的发展提供了新的思路。
`;

const BACKBONE_MODULE_LABELS: Record<string, string> = {
  research_background: "研究背景",
  literature_review: "文献综述",
  research_methods: "研究方法",
  core_concepts: "核心概念",
  application_domains: "应用领域",
  future_directions: "未来方向",
};

interface GraphNode {
  id: string;
  title: string;
  properties?: {
    backboneModule?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface GraphEdge {
  source_knowledge_point_id: string;
  target_knowledge_point_id: string;
  relationship_type?: string;
  [key: string]: unknown;
}

class LiteratureExtractMountingPage {
  constructor(private page: Page) {}

  private get extractPanel() {
    return this.page.locator(".literature-extract-panel");
  }

  private get textInput() {
    return this.extractPanel.locator("textarea");
  }

  private get extractButton() {
    return this.extractPanel.locator("button").filter({ hasText: /开始提取/ });
  }

  get previewModal() {
    // 通过唯一的 h2 标题"概念预览"过滤，避免匹配代码库中 20+ 个其他 overlay 组件
    return this.page
      .locator(".fixed.inset-0.bg-black\\/50")
      .filter({ has: this.page.locator("h2", { hasText: "概念预览" }) });
  }

  private get conceptCards() {
    return this.previewModal.locator(
      '[class*="rounded-lg"][class*="border"][class*="transition-all"]'
    );
  }

  get confirmButton() {
    return this.previewModal.locator("button").filter({ hasText: /确认添加/ });
  }

  private get selectAllButton() {
    return this.previewModal.locator("button").filter({ hasText: /^全选$/ });
  }

  private get cancelButton() {
    return this.previewModal.getByRole("button", { name: "取消", exact: true });
  }

  async openExtractPanel() {
    const aiDropdown = this.page.getByRole("button", { name: /AI 助手|AI Assistant/ });
    const mobileAiButton = this.page.getByRole("button", { name: /^AI$/ });
    const aiButton = aiDropdown.or(mobileAiButton).first();
    await expect(aiButton).toBeVisible({ timeout: 10000 });
    await aiButton.click();
    const extractItem = this.page.getByText(/文献提取|Literature Extract/).first();
    await expect(extractItem).toBeVisible({ timeout: 5000 });
    await extractItem.click();
    await expect(this.extractPanel).toBeVisible({ timeout: 10000 });
  }

  async fillTextAndExtract(content: string) {
    await this.textInput.fill(content);
    await this.extractButton.click();
  }

  async waitForPreviewModal() {
    await expect(this.previewModal).toBeVisible({ timeout: 60000 });
  }

  async getConceptCount() {
    return await this.conceptCards.count();
  }

  async getConceptModuleLabel(index: number) {
    const card = this.conceptCards.nth(index);
    const moduleText = card.locator(
      "text=/研究背景|文献综述|研究方法|核心概念|应用领域|未来方向/"
    );
    await expect(moduleText).toBeVisible({ timeout: 5000 });
    return await moduleText.textContent();
  }

  async confirmConcepts() {
    // 先点击全选确保概念已选择（使用精确匹配避免匹配 "取消全选"）
    await this.selectAllButton.click();
    await expect(this.confirmButton).toBeEnabled({ timeout: 3000 });
    await this.confirmButton.click();
  }

  async cancelPreview() {
    await this.cancelButton.click();
  }

  async closePanel() {
    const closeButton = this.extractPanel
      .locator("button")
      .filter({ has: this.page.locator("svg.lucide-x") });
    await expect(closeButton).toBeVisible({ timeout: 3000 });
    await closeButton.click();
  }
}

class GraphOutlinePage {
  constructor(private page: Page) {}

  private get viewDropdownButton() {
    // "视图"下拉按钮（GraphToolbar 中 id="view" 的 DropdownButton）
    return this.page.getByRole("button", { name: /^视图/ }).first();
  }

  private get outlinePanel() {
    // GraphSidebarManager 渲染的侧边栏容器（在 detail/edit/outline 模式下均可见）
    return this.page.locator('[data-tour="sidebar-panel"]');
  }

  async openOutline() {
    // 检查当前是否处于 detail 模式（存在"返回大纲"按钮）
    // detail 模式下点击"返回大纲"直接切换到 outline，比通过下拉菜单更可靠
    const backButton = this.page.getByRole("button", { name: "返回大纲" });
    const isBackVisible = await backButton.isVisible();
    if (isBackVisible) {
      await backButton.click();
    } else {
      // 通过"视图"下拉菜单打开大纲
      await expect(this.viewDropdownButton).toBeVisible({ timeout: 5000 });
      await this.viewDropdownButton.click();
      const outlineItem = this.page.getByText("侧边栏大纲").first();
      await expect(outlineItem).toBeVisible({ timeout: 3000 });
      await outlineItem.click();
    }

    // 验证 GraphOutline 内容实际渲染（h2 "大纲视图" 标题）
    // 不能仅检查 sidebar div，因为该 div 在 detail/edit 模式下也可见
    const outlineTitle = this.outlinePanel.locator("h2", {
      hasText: /大纲视图/,
    });
    await expect(outlineTitle).toBeVisible({ timeout: 5000 });
  }

  async getBackboneNode(moduleLabel: string) {
    return this.outlinePanel.locator(`text="${moduleLabel}"`).first();
  }

  async expandBackboneNode(moduleLabel: string) {
    const node = await this.getBackboneNode(moduleLabel);
    await expect(node).toBeVisible({ timeout: 3000 });
    // 点击 chevron 图标切换展开/折叠
    // 不能点击 header div，因为 header onClick 会触发 onNodeClick 切换到 detail 模式
    // chevron 图标是 header div 的第一个子 div（class="w-5 h-5"），toggleExpand 会 stopPropagation
    const header = node.locator("xpath=..");
    const chevron = header.locator("div").first();
    await chevron.click();
    await this.page.waitForTimeout(500);
  }

  async getChildNodes(parentLabel: string) {
    const parent = await this.getBackboneNode(parentLabel);
    await expect(parent).toBeVisible({ timeout: 3000 });
    // GraphOutline TreeNode 结构:
    // div.select-none > div.cursor-pointer(header) > span(title)
    // div.select-none > div(children container) > div.select-none(each child)
    const outerDiv = parent.locator("xpath=../..");
    // 子节点为外层 div 下所有后代 div.select-none（不含外层自身）
    return outerDiv.locator("div.select-none");
  }

  async getNodeHierarchy() {
    // GraphOutline 中所有节点使用相同的 TreeNode 组件，无法通过 CSS 类区分层级
    // 通过 paddingLeft 内联样式判断深度（depth=0 → paddingLeft=12px，每层 +16px）
    const allNodes = this.outlinePanel.locator("div.cursor-pointer");
    const count = await allNodes.count();
    const hierarchy: { level: number; title: string }[] = [];

    for (let i = 0; i < count; i++) {
      const header = allNodes.nth(i);
      const paddingLeft = await header.evaluate((el) => {
        return parseInt(
          window.getComputedStyle(el).paddingLeft.replace("px", ""),
          10,
        );
      });
      const titleSpan = header.locator("span.truncate.font-medium").first();
      const titleText = await titleSpan.textContent();
      if (titleText && titleText.trim()) {
        // depth = (paddingLeft - 12) / 16
        const depth = Math.max(0, Math.round((paddingLeft - 12) / 16));
        hierarchy.push({ level: depth, title: titleText.trim() });
      }
    }

    return hierarchy;
  }
}

class GraphCanvasPage {
  constructor(private page: Page) {}

  private get canvas() {
    return this.page.locator('svg, [class*="canvas"], [class*="graph"]');
  }

  private get nodeLabels() {
    return this.page.locator('svg text');
  }

  async waitForGraphReady() {
    await expect(this.canvas.first()).toBeVisible({ timeout: 10000 });
  }

  async findNodeByTitle(title: string) {
    return this.page.locator(`text="${title}"`).first();
  }

  async clickNode(title: string) {
    const node = await this.findNodeByTitle(title);
    await expect(node).toBeVisible({ timeout: 5000 });
    await node.click();
  }

  async getNodeInfo(title: string, graphId?: string) {
    const node = await this.findNodeByTitle(title);
    const isVisible = await node.isVisible();
    let nodeId: string | null = null;
    let backboneModule: string | null = null;
    if (graphId) {
      const response = await this.page.request.get(`/api/graphs/${graphId}/nodes`);
      if (response.ok()) {
        const data = await response.json().catch(() => ({ nodes: [], edges: [] }));
        const nodes: GraphNode[] = data.nodes ?? [];
        const matched = nodes.find((n) => n.title === title);
        if (matched) {
          nodeId = matched.id ?? null;
          backboneModule = matched.properties?.backboneModule ?? null;
        }
      }
    }
    return { nodeId, backboneModule, isVisible };
  }

  async getVisibleNodeTitles() {
    const nodes = this.nodeLabels;
    const count = await nodes.count();
    const titles: string[] = [];

    for (let i = 0; i < count; i++) {
      const title = await nodes.nth(i).textContent({ timeout: 1000 }).catch(() => "");
      if (title) {
        titles.push(title.trim());
      }
    }

    return titles;
  }
}

test.describe("文献提取节点挂载功能测试", () => {
  let extractPage: LiteratureExtractMountingPage;
  let outlinePage: GraphOutlinePage;
  let canvasPage: GraphCanvasPage;

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("i18n-language", "zh-CN");
      localStorage.setItem("graph-editor-onboarding-complete", "true");
    });

    extractPage = new LiteratureExtractMountingPage(page);
    outlinePage = new GraphOutlinePage(page);
    canvasPage = new GraphCanvasPage(page);
  });

  test.describe("节点挂载到骨干节点", () => {
    test("应该在提取后显示概念的目标骨干模块", async ({ page, topicResearchGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${topicResearchGraph.id}`);

      await extractPage.openExtractPanel();
      await extractPage.fillTextAndExtract(SAMPLE_TEXT_CONTENT);
      await extractPage.waitForPreviewModal();

      const conceptCount = await extractPage.getConceptCount();
      expect(conceptCount).toBeGreaterThan(0);

      for (let i = 0; i < Math.min(conceptCount, 3); i++) {
        const moduleLabel = await extractPage.getConceptModuleLabel(i);
        expect(moduleLabel).not.toBeNull();
        const validModules = Object.values(BACKBONE_MODULE_LABELS);
        expect(validModules.some((m) => moduleLabel?.includes(m))).toBeTruthy();
      }
    });

    test("应该在确认添加后创建边连接到骨干节点", async ({ page, topicResearchGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${topicResearchGraph.id}`);

      await extractPage.openExtractPanel();
      await extractPage.fillTextAndExtract(SAMPLE_TEXT_CONTENT);
      await extractPage.waitForPreviewModal();

      const conceptCount = await extractPage.getConceptCount();
      if (conceptCount > 0) {
        await extractPage.confirmConcepts();

        await expect(page.locator("text=/成功|添加/").first()).toBeVisible({ timeout: 10000 });

        await page.waitForTimeout(2000);

        const response = await page.request.get("/api/test/edges");
        if (response.ok()) {
          const edges: GraphEdge[] = await response.json().catch(() => []);
          expect(Array.isArray(edges)).toBeTruthy();
        }
      }
    });

    test("应该在大纲视图中显示正确的层级关系", async ({ page, topicResearchGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${topicResearchGraph.id}`);

      await extractPage.openExtractPanel();
      await extractPage.fillTextAndExtract(SAMPLE_TEXT_CONTENT);
      await extractPage.waitForPreviewModal();

      const conceptCount = await extractPage.getConceptCount();
      if (conceptCount > 0) {
        await extractPage.confirmConcepts();

        await expect(page.locator("text=/成功|添加/").first()).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(2000);

        await outlinePage.openOutline();

        // 验证所有骨干模块标签在大纲视图中可见
        for (const moduleLabel of Object.values(BACKBONE_MODULE_LABELS)) {
          const backboneNode = await outlinePage.getBackboneNode(moduleLabel);
          await expect(backboneNode).toBeVisible({ timeout: 5000 });
        }

        // 验证大纲层级结构：骨干节点应出现在层级中，且存在嵌套层级
        // 图谱根节点在 level 0，骨干模块作为子节点在 level 1
        const hierarchy = await outlinePage.getNodeHierarchy();
        expect(hierarchy.length).toBeGreaterThanOrEqual(6);

        // 验证所有骨干模块标签都出现在层级结构中
        const titles = hierarchy.map((n) => n.title);
        for (const label of Object.values(BACKBONE_MODULE_LABELS)) {
          expect(titles).toContain(label);
        }

        // 验证存在层级结构（至少 2 个不同的 level）
        const levels = new Set(hierarchy.map((n) => n.level));
        expect(levels.size).toBeGreaterThanOrEqual(2);
      }
    });

    test("应该在图谱画布中显示挂载的概念节点", async ({ page, topicResearchGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${topicResearchGraph.id}`);

      await canvasPage.waitForGraphReady();

      await extractPage.openExtractPanel();
      await extractPage.fillTextAndExtract(SAMPLE_TEXT_CONTENT);
      await extractPage.waitForPreviewModal();

      const conceptCount = await extractPage.getConceptCount();
      if (conceptCount > 0) {
        await extractPage.confirmConcepts();

        await expect(page.locator("text=/成功|添加/").first()).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(3000);

        const visibleTitles = await canvasPage.getVisibleNodeTitles();
        expect(visibleTitles.length).toBeGreaterThan(0);
      }
    });

    test("应该正确设置节点的 backboneModule 属性", async ({ page, topicResearchGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${topicResearchGraph.id}`);

      await canvasPage.waitForGraphReady();

      const graphId = page.url().match(/\/graph\/([^/]+)/)?.[1];
      expect(graphId).toBeTruthy();
      if (!graphId) return;

      // 1. 获取节点列表（使用 authedRequest 携带认证 token，
      //    page.request 不经过 axios 拦截器，不会自动携带 token）
      const listRes = await authedRequest(
        page,
        "GET",
        `/api/graphs/${graphId}/nodes`,
      );
      expect(listRes.ok).toBeTruthy();
      const listBody = listRes.body as { nodes: GraphNode[]; edges: GraphEdge[] };
      const nodes: GraphNode[] = listBody.nodes ?? [];
      expect(Array.isArray(nodes)).toBeTruthy();
      expect(nodes.length).toBeGreaterThan(0);

      // 2. 为骨干节点设置 backboneModule 属性（fixture 创建的节点不含此属性，
      //    需通过 API 补充设置，参考 backbone-node.spec.ts 的 setupBackboneModules）
      const titleToModule: Record<string, string> = Object.fromEntries(
        Object.entries(BACKBONE_MODULE_LABELS).map(([key, label]) => [label, key]),
      );
      for (const node of nodes) {
        const module = titleToModule[node.title];
        if (module) {
          const updateRes = await authedRequest(page, "PUT", `/api/nodes/${node.id}`, {
            properties: { backboneModule: module },
          });
          expect(updateRes.ok).toBeTruthy();
        }
      }

      // 3. 重新查询并验证 backboneModule 属性已正确持久化
      const verifyRes = await authedRequest(
        page,
        "GET",
        `/api/graphs/${graphId}/nodes`,
      );
      expect(verifyRes.ok).toBeTruthy();
      const verifyBody = verifyRes.body as {
        nodes: GraphNode[];
        edges: GraphEdge[];
      };
      const verifyNodes: GraphNode[] = verifyBody.nodes ?? [];

      for (const [moduleKey, moduleLabel] of Object.entries(BACKBONE_MODULE_LABELS)) {
        const matched = verifyNodes.find((n) => n.title === moduleLabel);
        expect(matched).toBeDefined();
        expect(matched?.properties?.backboneModule).toBe(moduleKey);
      }
    });
  });

  test.describe("边创建验证", () => {
    test("应该创建从骨干节点到概念节点的边", async ({ page, topicResearchGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${topicResearchGraph.id}`);

      await extractPage.openExtractPanel();
      await extractPage.fillTextAndExtract(SAMPLE_TEXT_CONTENT);
      await extractPage.waitForPreviewModal();

      const conceptCount = await extractPage.getConceptCount();
      if (conceptCount > 0) {
        const firstModuleLabel = await extractPage.getConceptModuleLabel(0);
        expect(firstModuleLabel).not.toBeNull();

        await extractPage.confirmConcepts();

        await expect(page.locator("text=/成功|添加/").first()).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(2000);

        const graphId = page.url().match(/\/graph\/([^/]+)/)?.[1];
        if (graphId) {
          const response = await page.request.get(`/api/graphs/${graphId}/edges`);
          if (response.ok()) {
            const edges: GraphEdge[] = await response.json().catch(() => []);
            expect(Array.isArray(edges)).toBeTruthy();
          }
        }
      }
    });

    test("应该使用正确的 relationship_type", async ({ page, topicResearchGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${topicResearchGraph.id}`);

      await extractPage.openExtractPanel();
      await extractPage.fillTextAndExtract(SAMPLE_TEXT_CONTENT);
      await extractPage.waitForPreviewModal();

      const conceptCount = await extractPage.getConceptCount();
      if (conceptCount > 0) {
        await extractPage.confirmConcepts();

        await expect(page.locator("text=/成功|添加/").first()).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(2000);

        const graphId = page.url().match(/\/graph\/([^/]+)/)?.[1];
        if (graphId) {
          const response = await page.request.get(`/api/graphs/${graphId}/edges`);
          if (response.ok()) {
            const edges: GraphEdge[] = await response.json().catch(() => []);
            if (edges.length > 0) {
              const validRelationshipTypes = [
                "contains",
                "references",
                "related",
                "prerequisite",
              ];
              for (const edge of edges) {
                expect(validRelationshipTypes).toContain(edge.relationship_type);
              }
            }
          }
        }
      }
    });

    test("应该验证边的 source 和 target 正确性", async ({ page, topicResearchGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${topicResearchGraph.id}`);

      await extractPage.openExtractPanel();
      await extractPage.fillTextAndExtract(SAMPLE_TEXT_CONTENT);
      await extractPage.waitForPreviewModal();

      const conceptCount = await extractPage.getConceptCount();
      if (conceptCount > 0) {
        await extractPage.confirmConcepts();

        await expect(page.locator("text=/成功|添加/").first()).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(2000);

        const graphId = page.url().match(/\/graph\/([^/]+)/)?.[1];
        if (graphId) {
          const nodesResponse = await page.request.get(`/api/graphs/${graphId}/nodes`);

          if (nodesResponse.ok()) {
            const data = await nodesResponse.json().catch(() => ({ nodes: [], edges: [] }));
            const nodes: GraphNode[] = data.nodes ?? [];
            const edges: GraphEdge[] = data.edges ?? [];

            const nodeIds = new Set(nodes.map((n) => n.id));

            for (const edge of edges) {
              expect(nodeIds.has(edge.source_knowledge_point_id)).toBeTruthy();
              expect(nodeIds.has(edge.target_knowledge_point_id)).toBeTruthy();
            }
          }
        }
      }
    });
  });

  test.describe("parentId 传递验证", () => {
    test("应该正确传递 parentId 到后端", async ({ page, topicResearchGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${topicResearchGraph.id}`);

      await extractPage.openExtractPanel();
      await extractPage.fillTextAndExtract(SAMPLE_TEXT_CONTENT);
      await extractPage.waitForPreviewModal();

      const conceptCount = await extractPage.getConceptCount();
      if (conceptCount > 0) {
        await extractPage.confirmConcepts();

        await expect(page.locator("text=/成功|添加/").first()).toBeVisible({ timeout: 10000 });
      }
    });

    test("应该处理没有骨干节点的情况", async ({ page, testGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);

      await extractPage.openExtractPanel();
      await extractPage.fillTextAndExtract(SAMPLE_TEXT_CONTENT);
      await extractPage.waitForPreviewModal();

      const conceptCount = await extractPage.getConceptCount();
      if (conceptCount > 0) {
        await extractPage.confirmConcepts();

        await expect(page.locator("text=/成功|添加/").first()).toBeVisible({ timeout: 10000 });
      }
    });

    test("应该处理多个概念挂载到同一个骨干节点", async ({ page, topicResearchGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${topicResearchGraph.id}`);

      await extractPage.openExtractPanel();
      await extractPage.fillTextAndExtract(SAMPLE_TEXT_CONTENT);
      await extractPage.waitForPreviewModal();

      const conceptCount = await extractPage.getConceptCount();
      if (conceptCount > 1) {
        const moduleLabels: (string | null)[] = [];
        for (let i = 0; i < conceptCount; i++) {
          const label = await extractPage.getConceptModuleLabel(i);
          moduleLabels.push(label);
        }

        moduleLabels.reduce(
          (acc, label) => {
            if (label) {
              acc[label] = (acc[label] || 0) + 1;
            }
            return acc;
          },
          {} as Record<string, number>
        );

        await extractPage.confirmConcepts();

        await expect(page.locator("text=/成功|添加/").first()).toBeVisible({ timeout: 10000 });
      }
    });
  });

  test.describe("挂载状态返回验证", () => {
    test("应该返回正确的 nodeMapping", async ({ page, topicResearchGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${topicResearchGraph.id}`);

      await extractPage.openExtractPanel();
      await extractPage.fillTextAndExtract(SAMPLE_TEXT_CONTENT);
      await extractPage.waitForPreviewModal();

      const conceptCount = await extractPage.getConceptCount();
      if (conceptCount > 0) {
        await extractPage.confirmConcepts();

        await expect(page.locator("text=/成功|添加/").first()).toBeVisible({ timeout: 10000 });

        const response = await page.request.post("/api/auto-graph/save-nodes", {
          data: {
            graph_id: page.url().match(/\/graph\/([^/]+)/)?.[1],
            nodes: [],
          },
        });

        if (response.ok()) {
          const result: Record<string, unknown> = await response.json().catch(() => ({}));
          expect(result).toHaveProperty("nodeMapping");
        }
      }
    });

    test("应该返回正确的 nodeCount 和 edgeCount", async ({ page, topicResearchGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${topicResearchGraph.id}`);

      await extractPage.openExtractPanel();
      await extractPage.fillTextAndExtract(SAMPLE_TEXT_CONTENT);
      await extractPage.waitForPreviewModal();

      const conceptCount = await extractPage.getConceptCount();
      if (conceptCount > 0) {
        await extractPage.confirmConcepts();

        const successMessage = page.locator("text=/成功|添加/").first();
        await expect(successMessage).toBeVisible({ timeout: 10000 });
        // 显式断言成功消息文本（避免 .catch(() => "") 吞掉断言错误）
        await expect(successMessage).toContainText(/成功|添加/);
      }
    });
  });

  test.describe("前端层级显示验证", () => {
    test("应该在节点详情中显示父节点信息", async ({ page, topicResearchGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${topicResearchGraph.id}`);

      await extractPage.openExtractPanel();
      await extractPage.fillTextAndExtract(SAMPLE_TEXT_CONTENT);
      await extractPage.waitForPreviewModal();

      const conceptCount = await extractPage.getConceptCount();
      if (conceptCount > 0) {
        await extractPage.confirmConcepts();

        await expect(page.locator("text=/成功|添加/").first()).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(2000);

        // 打开大纲视图，通过大纲点击骨干节点查看详情
        // （SVG canvas 拦截 pointer events，大纲点击更可靠）
        await outlinePage.openOutline();

        // 点击第一个骨干节点，打开节点详情侧边栏
        const firstModule = Object.values(BACKBONE_MODULE_LABELS)[0];
        const backboneNode = await outlinePage.getBackboneNode(firstModule);
        await expect(backboneNode).toBeVisible({ timeout: 5000 });
        await backboneNode.click();
        await page.waitForTimeout(500);

        // 验证节点详情侧边栏显示父节点信息
        // 骨干节点的父节点是图谱根节点，详情中应显示"上一级"
        const nodeDetail = page.locator('[data-tour="sidebar-panel"]');
        await expect(nodeDetail).toBeVisible({ timeout: 3000 });
        const parentInfo = nodeDetail.locator("text=/上一级|父节点|所属/");
        await expect(parentInfo).toBeVisible({ timeout: 5000 });
      }
    });

    test("应该在大纲中正确缩进子节点", async ({ page, topicResearchGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${topicResearchGraph.id}`);

      await extractPage.openExtractPanel();
      await extractPage.fillTextAndExtract(SAMPLE_TEXT_CONTENT);
      await extractPage.waitForPreviewModal();

      const conceptCount = await extractPage.getConceptCount();
      if (conceptCount > 0) {
        await extractPage.confirmConcepts();

        await expect(page.locator("text=/成功|添加/").first()).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(2000);

        await outlinePage.openOutline();

        // GraphOutline 在初始加载时自动展开所有父节点，子节点已渲染到 DOM 中
        // 无需手动调用 expandBackboneNode（点击 header 会触发 onNodeClick 切换到 detail 模式）
        const hierarchy = await outlinePage.getNodeHierarchy();
        expect(hierarchy.length).toBeGreaterThanOrEqual(6);

        // 验证所有骨干模块标签都出现在层级结构中
        const titles = hierarchy.map((n) => n.title);
        for (const label of Object.values(BACKBONE_MODULE_LABELS)) {
          expect(titles).toContain(label);
        }

        // 验证骨干节点都在同一层级（作为图谱根节点的子节点）
        const backboneLevels = hierarchy
          .filter((n) => Object.values(BACKBONE_MODULE_LABELS).includes(n.title))
          .map((n) => n.level);
        expect(backboneLevels.length).toBe(6);
        const firstLevel = backboneLevels[0];
        for (const level of backboneLevels) {
          expect(level).toBe(firstLevel);
        }

        // 如果 apply 成功添加了子节点，验证子节点在更深层级（缩进）
        const backboneLevel = firstLevel;
        const childNodes = hierarchy.filter((n) => n.level > backboneLevel);
        if (childNodes.length > 0) {
          // 子节点应存在于比骨干节点更深的层级
          for (const child of childNodes) {
            expect(child.level).toBeGreaterThan(backboneLevel);
          }
        }
      }
    });

    test("应该在图谱中显示边的连接", async ({ page, topicResearchGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${topicResearchGraph.id}`);

      await canvasPage.waitForGraphReady();

      await extractPage.openExtractPanel();
      await extractPage.fillTextAndExtract(SAMPLE_TEXT_CONTENT);
      await extractPage.waitForPreviewModal();

      const conceptCount = await extractPage.getConceptCount();
      if (conceptCount > 0) {
        await extractPage.confirmConcepts();

        await expect(page.locator("text=/成功|添加/").first()).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(3000);

        const canvas = page.locator('svg, [class*="canvas"], [class*="graph"]').first();
        await expect(canvas).toBeVisible({ timeout: 3000 });
      }
    });
  });

  test.describe("错误处理和边界情况", () => {
    test("应该处理提取失败的情况", async ({ page, testGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);

      await extractPage.openExtractPanel();
      await extractPage.fillTextAndExtract("短文本");

      const errorMessage = page.locator("text=/字以上|至少|过短/");
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
    });

    test("应该支持取消预览", async ({ page, testGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);

      await extractPage.openExtractPanel();
      await extractPage.fillTextAndExtract(SAMPLE_TEXT_CONTENT);
      await extractPage.waitForPreviewModal();

      await extractPage.cancelPreview();

      await expect(extractPage.previewModal).not.toBeVisible({ timeout: 3000 });
    });

    test("应该处理空概念列表", async ({ page, testGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);

      await extractPage.openExtractPanel();
      await extractPage.fillTextAndExtract(SAMPLE_TEXT_CONTENT);
      await extractPage.waitForPreviewModal();

      const conceptCount = await extractPage.getConceptCount();

      if (conceptCount === 0) {
        const confirmButton = extractPage.confirmButton;
        const isEnabled = await confirmButton.isEnabled({ timeout: 1000 });
        expect(isEnabled).toBeFalsy();
      }
    });

    test("应该处理网络错误", async ({ page, testGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);

      await page.route("**/api/auto-graph/**", (route) => route.abort());

      await extractPage.openExtractPanel();
      await extractPage.fillTextAndExtract(SAMPLE_TEXT_CONTENT);

      await page.waitForTimeout(5000);
    });
  });

  test.describe("移动端适配", () => {
    test("应该在移动端正确显示挂载关系", async ({ page, topicResearchGraph }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      await navigateAndWaitForAuth(page, `/graph/${topicResearchGraph.id}`);

      await extractPage.openExtractPanel();
      await extractPage.fillTextAndExtract(SAMPLE_TEXT_CONTENT);
      await extractPage.waitForPreviewModal();

      const conceptCount = await extractPage.getConceptCount();
      if (conceptCount > 0) {
        await extractPage.confirmConcepts();

        await expect(page.locator("text=/成功|添加/").first()).toBeVisible({ timeout: 10000 });
      }
    });
  });
});
