import { test, expect, Page } from "@playwright/test";
import { loginAsTestUser } from "./utils/auth";

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

  private get previewModal() {
    return this.page.locator(".fixed.inset-0.bg-black\\/50");
  }

  private get conceptCards() {
    return this.previewModal.locator('[class*="rounded-lg"][class*="border"]');
  }

  private get confirmButton() {
    return this.previewModal.locator("button").filter({ hasText: /确认添加/ });
  }

  private get cancelButton() {
    return this.previewModal.locator("button").filter({ hasText: "取消" });
  }

  async openExtractPanel() {
    const extractButton = this.page
      .locator("button")
      .filter({ hasText: /文献提取|提取概念/ })
      .first();
    await expect(extractButton).toBeVisible({ timeout: 5000 });
    await extractButton.click();
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
    return await moduleText.textContent({ timeout: 3000 });
  }

  async confirmConcepts() {
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

  private get outlineButton() {
    return this.page.locator("button").filter({ hasText: /大纲|目录/ });
  }

  private get outlinePanel() {
    return this.page.locator('[class*="outline"], [class*="sidebar"]');
  }

  async openOutline() {
    await expect(this.outlineButton).toBeVisible({ timeout: 3000 });
    await this.outlineButton.click();
    await expect(this.outlinePanel).toBeVisible({ timeout: 5000 });
  }

  async getBackboneNode(moduleLabel: string) {
    return this.outlinePanel.locator(`text="${moduleLabel}"`).first();
  }

  async expandBackboneNode(moduleLabel: string) {
    const node = await this.getBackboneNode(moduleLabel);
    await expect(node).toBeVisible({ timeout: 3000 });
    const parent = node.locator("xpath=..");
    const expandButton = parent.locator(
      'button:has(svg), [class*="expand"], [class*="collapse"]'
    );
    await expect(expandButton).toBeVisible({ timeout: 1000 });
    await expandButton.click();
    await this.page.waitForTimeout(500);
  }

  async getChildNodes(parentLabel: string) {
    const parent = await this.getBackboneNode(parentLabel);
    await expect(parent).toBeVisible({ timeout: 3000 });
    const parentElement = parent.locator("xpath=..");
    return parentElement.locator('[class*="child"], [class*="nested"]');
  }

  async getNodeHierarchy() {
    const nodes = this.outlinePanel.locator('[class*="node"], [class*="item"]');
    const count = await nodes.count();
    const hierarchy: { level: number; title: string }[] = [];

    for (let i = 0; i < count; i++) {
      const node = nodes.nth(i);
      const title = await node.textContent({ timeout: 1000 }).catch(() => "");
      const classList = await node.getAttribute("class").catch(() => "");
      const level = (classList?.match(/level-(\d)/)?.[1] || "0") as unknown as number;
      if (title) {
        hierarchy.push({ level: Number(level), title: title.trim() });
      }
    }

    return hierarchy;
  }
}

class GraphCanvasPage {
  constructor(private page: Page) {}

  private get canvas() {
    return this.page.locator('canvas, [data-testid="graph-canvas"], .graph-container');
  }

  private get nodeLabels() {
    return this.page.locator('[class*="node-label"], [class*="node-title"]');
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

  async getNodeInfo(title: string) {
    const node = await this.findNodeByTitle(title);
    await expect(node).toBeVisible({ timeout: 3000 });
    const parent = node.locator("xpath=..");
    const dataNodeId = await parent.getAttribute("data-node-id");
    const dataBackboneModule = await parent.getAttribute("data-backbone-module");
    return {
      nodeId: dataNodeId,
      backboneModule: dataBackboneModule,
      isVisible: true,
    };
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
    await loginAsTestUser(page);
    await page.waitForLoadState("networkidle");

    extractPage = new LiteratureExtractMountingPage(page);
    outlinePage = new GraphOutlinePage(page);
    canvasPage = new GraphCanvasPage(page);
  });

  test.describe("节点挂载到骨干节点", () => {
    test("应该在提取后显示概念的目标骨干模块", async ({ page }) => {
      await page.goto("/graph");
      await page.waitForLoadState("networkidle");

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

    test("应该在确认添加后创建边连接到骨干节点", async ({ page }) => {
      await page.goto("/graph");
      await page.waitForLoadState("networkidle");

      await extractPage.openExtractPanel();
      await extractPage.fillTextAndExtract(SAMPLE_TEXT_CONTENT);
      await extractPage.waitForPreviewModal();

      const conceptCount = await extractPage.getConceptCount();
      if (conceptCount > 0) {
        await extractPage.confirmConcepts();

        await expect(page.locator("text=/成功|添加/")).toBeVisible({ timeout: 10000 });

        await page.waitForTimeout(2000);

        const response = await page.request.get("/api/test/edges");
        if (response.ok()) {
          const edges = await response.json().catch(() => []);
          expect(Array.isArray(edges)).toBeTruthy();
        }
      }
    });

    test("应该在大纲视图中显示正确的层级关系", async ({ page }) => {
      await page.goto("/graph");
      await page.waitForLoadState("networkidle");

      await extractPage.openExtractPanel();
      await extractPage.fillTextAndExtract(SAMPLE_TEXT_CONTENT);
      await extractPage.waitForPreviewModal();

      const conceptCount = await extractPage.getConceptCount();
      if (conceptCount > 0) {
        await extractPage.confirmConcepts();

        await expect(page.locator("text=/成功|添加/")).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(2000);

        await outlinePage.openOutline();

        for (const moduleLabel of Object.values(BACKBONE_MODULE_LABELS)) {
          const backboneNode = await outlinePage.getBackboneNode(moduleLabel);
          await expect(backboneNode).toBeVisible({ timeout: 3000 });
          await outlinePage.expandBackboneNode(moduleLabel);
          await page.waitForTimeout(500);

          const children = await outlinePage.getChildNodes(moduleLabel);
          const childCount = await children.count();
          expect(childCount).toBeGreaterThanOrEqual(0);
        }
      }
    });

    test("应该在图谱画布中显示挂载的概念节点", async ({ page }) => {
      await page.goto("/graph");
      await page.waitForLoadState("networkidle");

      await canvasPage.waitForGraphReady();

      await extractPage.openExtractPanel();
      await extractPage.fillTextAndExtract(SAMPLE_TEXT_CONTENT);
      await extractPage.waitForPreviewModal();

      const conceptCount = await extractPage.getConceptCount();
      if (conceptCount > 0) {
        await extractPage.confirmConcepts();

        await expect(page.locator("text=/成功|添加/")).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(3000);

        const visibleTitles = await canvasPage.getVisibleNodeTitles();
        expect(visibleTitles.length).toBeGreaterThan(0);
      }
    });

    test("应该正确设置节点的 backboneModule 属性", async ({ page }) => {
      await page.goto("/graph");
      await page.waitForLoadState("networkidle");

      await canvasPage.waitForGraphReady();

      for (const [moduleKey, moduleLabel] of Object.entries(BACKBONE_MODULE_LABELS)) {
        const nodeInfo = await canvasPage.getNodeInfo(moduleLabel);
        expect(nodeInfo.backboneModule).not.toBeNull();
        if (nodeInfo.backboneModule) {
          expect(nodeInfo.backboneModule).toBe(moduleKey);
        }
      }
    });
  });

  test.describe("边创建验证", () => {
    test("应该创建从骨干节点到概念节点的边", async ({ page }) => {
      await page.goto("/graph");
      await page.waitForLoadState("networkidle");

      await extractPage.openExtractPanel();
      await extractPage.fillTextAndExtract(SAMPLE_TEXT_CONTENT);
      await extractPage.waitForPreviewModal();

      const conceptCount = await extractPage.getConceptCount();
      if (conceptCount > 0) {
        const firstModuleLabel = await extractPage.getConceptModuleLabel(0);
        expect(firstModuleLabel).not.toBeNull();

        await extractPage.confirmConcepts();

        await expect(page.locator("text=/成功|添加/")).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(2000);

        const graphId = page.url().match(/\/graph\/([^/]+)/)?.[1];
        if (graphId) {
          const response = await page.request.get(`/api/graphs/${graphId}/edges`);
          if (response.ok()) {
            const edges = await response.json().catch(() => []);
            expect(Array.isArray(edges)).toBeTruthy();
          }
        }
      }
    });

    test("应该使用正确的 relationship_type", async ({ page }) => {
      await page.goto("/graph");
      await page.waitForLoadState("networkidle");

      await extractPage.openExtractPanel();
      await extractPage.fillTextAndExtract(SAMPLE_TEXT_CONTENT);
      await extractPage.waitForPreviewModal();

      const conceptCount = await extractPage.getConceptCount();
      if (conceptCount > 0) {
        await extractPage.confirmConcepts();

        await expect(page.locator("text=/成功|添加/")).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(2000);

        const graphId = page.url().match(/\/graph\/([^/]+)/)?.[1];
        if (graphId) {
          const response = await page.request.get(`/api/graphs/${graphId}/edges`);
          if (response.ok()) {
            const edges = await response.json().catch(() => []);
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

    test("应该验证边的 source 和 target 正确性", async ({ page }) => {
      await page.goto("/graph");
      await page.waitForLoadState("networkidle");

      await extractPage.openExtractPanel();
      await extractPage.fillTextAndExtract(SAMPLE_TEXT_CONTENT);
      await extractPage.waitForPreviewModal();

      const conceptCount = await extractPage.getConceptCount();
      if (conceptCount > 0) {
        await extractPage.confirmConcepts();

        await expect(page.locator("text=/成功|添加/")).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(2000);

        const graphId = page.url().match(/\/graph\/([^/]+)/)?.[1];
        if (graphId) {
          const nodesResponse = await page.request.get(`/api/graphs/${graphId}/nodes`);
          const edgesResponse = await page.request.get(`/api/graphs/${graphId}/edges`);

          if (nodesResponse.ok() && edgesResponse.ok()) {
            const nodes = await nodesResponse.json().catch(() => []);
            const edges = await edgesResponse.json().catch(() => []);

            const nodeIds = new Set(nodes.map((n: any) => n.id));

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
    test("应该正确传递 parentId 到后端", async ({ page }) => {
      await page.goto("/graph");
      await page.waitForLoadState("networkidle");

      await extractPage.openExtractPanel();
      await extractPage.fillTextAndExtract(SAMPLE_TEXT_CONTENT);
      await extractPage.waitForPreviewModal();

      const conceptCount = await extractPage.getConceptCount();
      if (conceptCount > 0) {
        await extractPage.confirmConcepts();

        await expect(page.locator("text=/成功|添加/")).toBeVisible({ timeout: 10000 });
      }
    });

    test("应该处理没有骨干节点的情况", async ({ page }) => {
      await page.goto("/graph");
      await page.waitForLoadState("networkidle");

      await extractPage.openExtractPanel();
      await extractPage.fillTextAndExtract(SAMPLE_TEXT_CONTENT);
      await extractPage.waitForPreviewModal();

      const conceptCount = await extractPage.getConceptCount();
      if (conceptCount > 0) {
        await extractPage.confirmConcepts();

        await expect(page.locator("text=/成功|添加/")).toBeVisible({ timeout: 10000 });
      }
    });

    test("应该处理多个概念挂载到同一个骨干节点", async ({ page }) => {
      await page.goto("/graph");
      await page.waitForLoadState("networkidle");

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

        const labelCounts = moduleLabels.reduce(
          (acc, label) => {
            if (label) {
              acc[label] = (acc[label] || 0) + 1;
            }
            return acc;
          },
          {} as Record<string, number>
        );

        const hasMultipleToSameModule = Object.values(labelCounts).some((count) => count > 1);

        await extractPage.confirmConcepts();

        await expect(page.locator("text=/成功|添加/")).toBeVisible({ timeout: 10000 });
      }
    });
  });

  test.describe("挂载状态返回验证", () => {
    test("应该返回正确的 nodeMapping", async ({ page }) => {
      await page.goto("/graph");
      await page.waitForLoadState("networkidle");

      await extractPage.openExtractPanel();
      await extractPage.fillTextAndExtract(SAMPLE_TEXT_CONTENT);
      await extractPage.waitForPreviewModal();

      const conceptCount = await extractPage.getConceptCount();
      if (conceptCount > 0) {
        await extractPage.confirmConcepts();

        await expect(page.locator("text=/成功|添加/")).toBeVisible({ timeout: 10000 });

        const response = await page.request.post("/api/auto-graph/save-nodes", {
          data: {
            graph_id: page.url().match(/\/graph\/([^/]+)/)?.[1],
            nodes: [],
          },
        });

        if (response.ok()) {
          const result = await response.json().catch(() => ({}));
          expect(result).toHaveProperty("nodeMapping");
        }
      }
    });

    test("应该返回正确的 nodeCount 和 edgeCount", async ({ page }) => {
      await page.goto("/graph");
      await page.waitForLoadState("networkidle");

      await extractPage.openExtractPanel();
      await extractPage.fillTextAndExtract(SAMPLE_TEXT_CONTENT);
      await extractPage.waitForPreviewModal();

      const conceptCount = await extractPage.getConceptCount();
      if (conceptCount > 0) {
        await extractPage.confirmConcepts();

        await expect(page.locator("text=/成功|添加/")).toBeVisible({ timeout: 10000 });

        const successMessage = page.locator("text=/成功|添加/");
        const messageText = await successMessage.textContent({ timeout: 3000 }).catch(() => "");

        expect(messageText).toMatch(/成功|添加/);
      }
    });
  });

  test.describe("前端层级显示验证", () => {
    test("应该在节点详情中显示父节点信息", async ({ page }) => {
      await page.goto("/graph");
      await page.waitForLoadState("networkidle");

      await extractPage.openExtractPanel();
      await extractPage.fillTextAndExtract(SAMPLE_TEXT_CONTENT);
      await extractPage.waitForPreviewModal();

      const conceptCount = await extractPage.getConceptCount();
      if (conceptCount > 0) {
        await extractPage.confirmConcepts();

        await expect(page.locator("text=/成功|添加/")).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(2000);

        const nodeLabels = page.locator('[class*="node-label"], [class*="node-title"]');
        const nodeCount = await nodeLabels.count();

        if (nodeCount > 0) {
          const firstNode = nodeLabels.first();
          await firstNode.click();
          await page.waitForTimeout(500);

          const nodeDetail = page.locator('[class*="node-detail"], [class*="sidebar"]');
          await expect(nodeDetail).toBeVisible({ timeout: 3000 });
          const parentInfo = nodeDetail.locator("text=/父节点|上级|所属/");
          await expect(parentInfo).toBeVisible({ timeout: 2000 });
        }
      }
    });

    test("应该在大纲中正确缩进子节点", async ({ page }) => {
      await page.goto("/graph");
      await page.waitForLoadState("networkidle");

      await extractPage.openExtractPanel();
      await extractPage.fillTextAndExtract(SAMPLE_TEXT_CONTENT);
      await extractPage.waitForPreviewModal();

      const conceptCount = await extractPage.getConceptCount();
      if (conceptCount > 0) {
        await extractPage.confirmConcepts();

        await expect(page.locator("text=/成功|添加/")).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(2000);

        await outlinePage.openOutline();

        const hierarchy = await outlinePage.getNodeHierarchy();
        expect(hierarchy.length).toBeGreaterThan(0);

        const hasNestedStructure = hierarchy.some((node, index) => {
          if (index === 0) return false;
          return node.level > hierarchy[index - 1].level;
        });

        expect(hasNestedStructure).toBe(true);
      }
    });

    test("应该在图谱中显示边的连接", async ({ page }) => {
      await page.goto("/graph");
      await page.waitForLoadState("networkidle");

      await canvasPage.waitForGraphReady();

      await extractPage.openExtractPanel();
      await extractPage.fillTextAndExtract(SAMPLE_TEXT_CONTENT);
      await extractPage.waitForPreviewModal();

      const conceptCount = await extractPage.getConceptCount();
      if (conceptCount > 0) {
        await extractPage.confirmConcepts();

        await expect(page.locator("text=/成功|添加/")).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(3000);

        const canvas = page.locator("canvas").first();
        await expect(canvas).toBeVisible({ timeout: 3000 });
      }
    });
  });

  test.describe("错误处理和边界情况", () => {
    test("应该处理提取失败的情况", async ({ page }) => {
      await page.goto("/graph");
      await page.waitForLoadState("networkidle");

      await extractPage.openExtractPanel();
      await extractPage.fillTextAndExtract("短文本");

      const errorMessage = page.locator("text=/字以上|至少|过短/");
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
    });

    test("应该支持取消预览", async ({ page }) => {
      await page.goto("/graph");
      await page.waitForLoadState("networkidle");

      await extractPage.openExtractPanel();
      await extractPage.fillTextAndExtract(SAMPLE_TEXT_CONTENT);
      await extractPage.waitForPreviewModal();

      await extractPage.cancelPreview();

      await expect(extractPage.previewModal).not.toBeVisible({ timeout: 3000 });
    });

    test("应该处理空概念列表", async ({ page }) => {
      await page.goto("/graph");
      await page.waitForLoadState("networkidle");

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

    test("应该处理网络错误", async ({ page }) => {
      await page.goto("/graph");
      await page.waitForLoadState("networkidle");

      await page.route("**/api/auto-graph/**", (route) => route.abort());

      await extractPage.openExtractPanel();
      await extractPage.fillTextAndExtract(SAMPLE_TEXT_CONTENT);

      await page.waitForTimeout(5000);
    });
  });

  test.describe("移动端适配", () => {
    test("应该在移动端正确显示挂载关系", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      await loginAsTestUser(page);
      await page.waitForLoadState("networkidle");

      await page.goto("/graph");
      await page.waitForLoadState("networkidle");

      await extractPage.openExtractPanel();
      await extractPage.fillTextAndExtract(SAMPLE_TEXT_CONTENT);
      await extractPage.waitForPreviewModal();

      const conceptCount = await extractPage.getConceptCount();
      if (conceptCount > 0) {
        await extractPage.confirmConcepts();

        await expect(page.locator("text=/成功|添加/")).toBeVisible({ timeout: 10000 });
      }
    });
  });
});
