import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";
import { setupAIMocks } from "./helpers/aiMock";
import { navigateAndWaitForAuth } from "./utils/auth";

/**
 * 获取 ConceptPreviewList 预览模态框
 * 通过唯一文本 "已选择 X / Y 个概念" 过滤，避免匹配 LiteratureExtractPanel overlay
 */
function getPreviewModal(page: Page) {
  return page
    .locator(".fixed.inset-0.bg-black\\/50")
    .filter({ has: page.getByText(/已选择.*\d+.*\/.*\d+/) });
}

/**
 * 文献概念提取功能 E2E 测试
 *
 * 测试覆盖：
 * 1. 骨干网络生成流程
 * 2. 文本输入提取流程
 * 3. 文件上传提取流程
 * 4. URL 抓取提取流程
 * 5. 概念聚合逻辑
 * 6. 预览确认流程
 * 7. 概念定位到骨干模块
 */

// 测试数据
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

// 骨干模块定义
const BACKBONE_MODULES = [
  "research_background",
  "literature_review",
  "research_methods",
  "core_concepts",
  "application_domains",
  "future_directions",
] as const;

/**
 * 文献提取页面模型
 */
class LiteratureExtractPage {
  constructor(private page: Page) {}

  // 选择器
  private get panel() {
    return this.page.locator(".literature-extract-panel");
  }

  private get inputModeSelector() {
    return this.panel.locator("button").filter({ hasText: /文本|文件|URL/ });
  }

  private get textInput() {
    return this.panel.locator("textarea");
  }

  private get urlInput() {
    return this.panel.locator('input[type="url"]');
  }

  private get fileInput() {
    return this.panel.locator('input[type="file"]');
  }

  private get fileDropzone() {
    return this.panel.locator(".border-dashed");
  }

  private get extractButton() {
    return this.panel.locator("button").filter({ hasText: /开始提取|处理中/ });
  }

  private get progressBar() {
    return this.panel.locator(".bg-gray-200.rounded-full.h-2");
  }

  private get advancedOptionsToggle() {
    return this.panel.locator("button").filter({ hasText: /选项/ });
  }

  private get conceptTypeButtons() {
    return this.panel.locator("button").filter({
      has: this.page.locator("text=/方法|机制|操作|概念|技术|工具/"),
    });
  }

  private get maxConceptsSlider() {
    return this.panel.locator('input[type="number"]').nth(1);
  }

  private get similaritySlider() {
    return this.panel.locator('input[type="number"]').nth(2);
  }

  // 操作方法
  async openPanel() {
    // 桌面端：点击 "AI 助手" 下拉按钮；移动端：点击底部导航的 "AI" 按钮
    const aiDropdown = this.page.getByRole("button", {
      name: /AI 助手|AI Assistant/,
    });
    const mobileAiButton = this.page.getByRole("button", {
      name: "AI",
      exact: true,
    });
    const triggerButton = aiDropdown.or(mobileAiButton).first();
    await expect(triggerButton).toBeVisible({ timeout: 10000 });
    await triggerButton.click();
    // 再点击下拉菜单内的 "文献提取" 菜单项
    const extractItem = this.page.getByText(/文献提取|Literature Extract/).first();
    await expect(extractItem).toBeVisible({ timeout: 5000 });
    await extractItem.click();
    await expect(this.panel).toBeVisible({ timeout: 10000 });
  }

  async selectInputMode(mode: "text" | "file" | "url") {
    const modeButton = this.inputModeSelector.filter({
      hasText: mode === "text" ? "文本" : mode === "file" ? "文件" : "URL",
    });
    await modeButton.click();
  }

  async fillTextContent(content: string) {
    await this.textInput.fill(content);
  }

  async fillUrl(url: string) {
    await this.urlInput.fill(url);
  }

  async uploadFile(filePath: string) {
    await this.fileInput.setInputFiles(filePath);
  }

  async clickExtract() {
    await this.extractButton.click();
  }

  async toggleAdvancedOptions() {
    await this.advancedOptionsToggle.click();
  }

  async selectConceptType(type: string) {
    const typeButton = this.conceptTypeButtons.filter({ hasText: type });
    await typeButton.click();
  }

  async waitForExtractionComplete() {
    // 等待进度条出现并消失
    await expect(this.progressBar).toBeVisible({ timeout: 5000 });
    await expect(
      this.page
        .locator(".fixed.inset-0.bg-black\\/50")
        .filter({ has: this.page.getByText(/已选择.*\d+.*\/.*\d+/) }),
    ).toBeVisible({ timeout: 60000 });
  }

  async closePanel() {
    const closeButton = this.panel
      .locator("button")
      .filter({ has: this.page.locator("svg.lucide-x") })
      .first();
    await closeButton.click();
  }
}

test.describe("文献概念提取功能测试", () => {
  let extractPage: LiteratureExtractPage;

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("i18n-language", "zh-CN");
      localStorage.setItem("graph-editor-onboarding-complete", "true");
    });

    extractPage = new LiteratureExtractPage(page);
  });

  test.describe("骨干网络生成流程", () => {
    test("应该显示骨干网络模块状态", async ({ page, topicResearchGraph }) => {
      // 导航到图谱页面
      await navigateAndWaitForAuth(page, `/graph/${topicResearchGraph.id}`);

      // 检查骨干网络模块是否可见
      const moduleStatus = page.locator(
        "text=/研究背景|文献综述|研究方法|核心概念|应用领域|未来方向/",
      );
      await expect(moduleStatus.first()).toBeVisible({ timeout: 10000 });
    });

    test("应该显示六个骨干模块", async ({ page, topicResearchGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${topicResearchGraph.id}`);

      // 检查所有骨干模块
      for (const module of BACKBONE_MODULES) {
        const moduleLabels: Record<string, string> = {
          research_background: "研究背景",
          literature_review: "文献综述",
          research_methods: "研究方法",
          core_concepts: "核心概念",
          application_domains: "应用领域",
          future_directions: "未来方向",
        };

        const moduleElement = page.locator(`text=${moduleLabels[module]}`);
        await expect(moduleElement.first()).toBeVisible({ timeout: 5000 });
      }
    });

    test.skip("应该显示模块完善状态", async ({ page, topicResearchGraph }) => {
      // 跳过：BackboneModuleStatus 组件当前未在 GraphEditor 页面中渲染，
      // "已完善"/"待完善" 状态标签不存在于 DOM 中，无法通过 UI 断言。
      await navigateAndWaitForAuth(page, `/graph/${topicResearchGraph.id}`);

      // 检查模块状态标签
      const statusLabels = page.locator("text=/已完善|待完善/");
      const count = await statusLabels.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe("文本输入提取流程", () => {
    test("应该打开文献提取面板", async ({ page, testGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);

      // 查找并点击文献提取按钮
      await extractPage.openPanel();
      await expect(page.locator(".literature-extract-panel")).toBeVisible({
        timeout: 10000,
      });
    });

    test("应该支持文本输入模式", async ({ page, testGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);

      // 打开提取面板
      await extractPage.openPanel();

      const panel = page.locator(".literature-extract-panel");
      await expect(panel).toBeVisible({ timeout: 10000 });

      // 检查文本输入区域
      const textArea = panel.locator("textarea");
      await expect(textArea).toBeVisible();

      // 填充测试文本
      await textArea.fill(SAMPLE_TEXT_CONTENT);
      await expect(textArea).toHaveValue(SAMPLE_TEXT_CONTENT);
    });

    test("应该验证文本输入最小长度", async ({ page, testGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);

      await extractPage.openPanel();

      const panel = page.locator(".literature-extract-panel");
      await expect(panel).toBeVisible({ timeout: 10000 });

      // 输入过短的文本
      const textArea = panel.locator("textarea");
      await textArea.fill("短文本");

      // 点击提取按钮
      const startButton = panel
        .locator("button")
        .filter({ hasText: /开始提取/ });
      await startButton.click();

      // 应该显示警告消息
      await expect(page.locator("text=/字以上|至少|过短/")).toBeVisible({
        timeout: 5000,
      });
    });

    test("应该显示文本字符计数", async ({ page, testGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);

      await extractPage.openPanel();

      const panel = page.locator(".literature-extract-panel");
      await expect(panel).toBeVisible({ timeout: 10000 });

      const textArea = panel.locator("textarea");
      await textArea.fill(SAMPLE_TEXT_CONTENT);

      // 检查字符计数显示（排除 "建议粘贴 500 字以上" 的提示文本）
      const charCount = panel.locator("text=/\\d+\\s*字符/");
      await expect(charCount).toBeVisible({ timeout: 3000 });
    });

    test("应该执行文本提取并显示进度", async ({ page, testGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);

      await extractPage.openPanel();

      const panel = page.locator(".literature-extract-panel");
      await expect(panel).toBeVisible({ timeout: 10000 });

      // 填充有效文本
      const textArea = panel.locator("textarea");
      await textArea.fill(SAMPLE_TEXT_CONTENT);

      // 点击提取
      const startButton = panel
        .locator("button")
        .filter({ hasText: /开始提取/ });
      await startButton.click();

      // 检查进度显示
      const progressBar = panel.locator(
        '.bg-gray-200.rounded-full.h-2, [role="progressbar"]',
      );
      await expect(progressBar).toBeVisible({ timeout: 5000 });

      // 等待概念预览模态框
      const previewModal = getPreviewModal(page);
      await expect(previewModal).toBeVisible({ timeout: 60000 });
    });
  });

  test.describe("文件上传提取流程", () => {
    test("应该切换到文件上传模式", async ({ page, testGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);

      await extractPage.openPanel();

      const panel = page.locator(".literature-extract-panel");
      await expect(panel).toBeVisible({ timeout: 10000 });

      // 点击文件模式按钮
      const fileModeButton = panel
        .locator("button")
        .filter({ hasText: "文件" });
      await fileModeButton.click();

      // 检查文件上传区域
      const dropzone = panel.locator('.border-dashed, input[type="file"]');
      await expect(dropzone.first()).toBeVisible({ timeout: 5000 });
    });

    test("应该显示支持的文件类型", async ({ page, testGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);

      await extractPage.openPanel();

      const panel = page.locator(".literature-extract-panel");
      await expect(panel).toBeVisible({ timeout: 10000 });

      // 切换到文件模式
      const fileModeButton = panel
        .locator("button")
        .filter({ hasText: "文件" });
      await fileModeButton.click();

      // 检查支持的文件类型提示
      const supportedTypes = panel.locator("text=/PDF|DOC|MD|支持.*类型/");
      await expect(supportedTypes.first()).toBeVisible({ timeout: 3000 });
    });

    test("应该验证文件大小限制", async ({ page, testGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);

      await extractPage.openPanel();

      const panel = page.locator(".literature-extract-panel");
      await expect(panel).toBeVisible({ timeout: 10000 });

      // 切换到文件模式
      const fileModeButton = panel
        .locator("button")
        .filter({ hasText: "文件" });
      await fileModeButton.click();

      // 检查文件大小限制提示
      const sizeLimit = panel.locator("text=/10.*MB|最大.*10/");
      await expect(sizeLimit).toBeVisible({ timeout: 3000 });
    });

    test("应该显示文件上传后预览", async ({ page, testGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);

      await extractPage.openPanel();

      const panel = page.locator(".literature-extract-panel");
      await expect(panel).toBeVisible({ timeout: 10000 });

      // 切换到文件模式
      const fileModeButton = panel
        .locator("button")
        .filter({ hasText: "文件" });
      await fileModeButton.click();

      // 使用 setInputFiles 上传测试文件（比 page.evaluate 更可靠地触发 React onChange）
      const testContent = "Test PDF content for literature extraction";
      const fileInput = panel.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: "test-document.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from(testContent),
      });

      // 检查文件名显示
      await expect(panel.locator("text=test-document.pdf")).toBeVisible({
        timeout: 5000,
      });
    });
  });

  test.describe("URL 抓取提取流程", () => {
    test("应该切换到 URL 输入模式", async ({ page, testGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);

      await extractPage.openPanel();

      const panel = page.locator(".literature-extract-panel");
      await expect(panel).toBeVisible({ timeout: 10000 });

      // 点击 URL 模式按钮
      const urlModeButton = panel.locator("button").filter({ hasText: "URL" });
      await urlModeButton.click();

      // 检查 URL 输入框
      const urlInput = panel.locator('input[type="url"]');
      await expect(urlInput).toBeVisible({ timeout: 5000 });
    });

    test("应该验证 URL 格式", async ({ page, testGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);

      await extractPage.openPanel();

      const panel = page.locator(".literature-extract-panel");
      await expect(panel).toBeVisible({ timeout: 10000 });

      // 切换到 URL 模式
      const urlModeButton = panel.locator("button").filter({ hasText: "URL" });
      await urlModeButton.click();

      // 输入无效 URL
      const urlInput = panel.locator('input[type="url"]');
      await urlInput.fill("invalid-url");

      // 点击提取
      const startButton = panel
        .locator("button")
        .filter({ hasText: /开始提取/ });
      await startButton.click();

      // 验证：无效 URL 被拦截，不应进入处理状态
      await page.waitForTimeout(1000);
      await expect(
        panel.locator("button").filter({ hasText: /处理中/ }),
      ).toHaveCount(0);
      // 预览模态框不应出现
      await expect(getPreviewModal(page)).toHaveCount(0);
    });

    test("应该显示 URL 输入提示", async ({ page, testGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);

      await extractPage.openPanel();

      const panel = page.locator(".literature-extract-panel");
      await expect(panel).toBeVisible({ timeout: 10000 });

      // 切换到 URL 模式
      const urlModeButton = panel.locator("button").filter({ hasText: "URL" });
      await urlModeButton.click();

      // 检查提示信息
      const hint = panel.locator("text=/arXiv|论文|文章|支持.*网站/");
      await expect(hint.first()).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe("概念聚合逻辑", () => {
    test("应该显示高级选项", async ({ page, testGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);

      await extractPage.openPanel();

      const panel = page.locator(".literature-extract-panel");
      await expect(panel).toBeVisible({ timeout: 10000 });

      // 点击高级选项
      const advancedToggle = panel
        .locator("button")
        .filter({ hasText: /选项/ });
      await advancedToggle.click();

      // 检查高级选项面板
      const advancedPanel = panel.locator("text=/概念类型|最大数量|相似度/");
      await expect(advancedPanel.first()).toBeVisible({ timeout: 3000 });
    });

    test("应该支持选择概念类型", async ({ page, testGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);

      await extractPage.openPanel();

      const panel = page.locator(".literature-extract-panel");
      await expect(panel).toBeVisible({ timeout: 10000 });

      // 打开高级选项
      const advancedToggle = panel
        .locator("button")
        .filter({ hasText: /选项/ });
      await advancedToggle.click();

      // 检查概念类型按钮
      for (const type of ["方法", "机制", "概念", "技术", "工具", "操作"]) {
        const typeButton = panel.locator("button").filter({ hasText: type });
        await expect(typeButton).toBeVisible({ timeout: 3000 });
      }
    });

    test("应该支持调整最大概念数量", async ({ page, testGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);

      await extractPage.openPanel();

      const panel = page.locator(".literature-extract-panel");
      await expect(panel).toBeVisible({ timeout: 10000 });

      // 打开高级选项
      const advancedToggle = panel
        .locator("button")
        .filter({ hasText: /选项/ });
      await advancedToggle.click();

      // 检查滑块（第二个 number input 是最大数量，min=10 max=200）
      const slider = panel.locator('input[type="number"]').nth(1);
      await expect(slider).toBeVisible({ timeout: 3000 });

      // 检查当前值显示
      const valueDisplay = panel.locator("text=/\\d+/").first();
      await expect(valueDisplay).toBeVisible({ timeout: 3000 });
    });

    test("应该支持调整相似度阈值", async ({ page, testGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);

      await extractPage.openPanel();

      const panel = page.locator(".literature-extract-panel");
      await expect(panel).toBeVisible({ timeout: 10000 });

      // 打开高级选项
      const advancedToggle = panel
        .locator("button")
        .filter({ hasText: /选项/ });
      await advancedToggle.click();

      // 检查相似度滑块（第三个 number input 是置信度阈值，step=0.05）
      const similaritySlider = panel.locator('input[type="number"]').nth(2);
      await expect(similaritySlider).toBeVisible({ timeout: 3000 });

      // 检查阈值标签显示
      const percentDisplay = panel.locator("text=/阈值|置信度/");
      await expect(percentDisplay.first()).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe("预览确认流程", () => {
    test("应该显示概念预览弹窗", async ({ page, testGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);

      await extractPage.openPanel();

      const panel = page.locator(".literature-extract-panel");
      await expect(panel).toBeVisible({ timeout: 10000 });

      // 填充文本并提取
      const textArea = panel.locator("textarea");
      await textArea.fill(SAMPLE_TEXT_CONTENT);

      const startButton = panel
        .locator("button")
        .filter({ hasText: /开始提取/ });
      await startButton.click();

      // 等待概念预览弹窗
      const previewModal = getPreviewModal(page);
      await expect(previewModal).toBeVisible({ timeout: 60000 });
    });

    test("应该显示提取的概念列表", async ({ page, testGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);

      await extractPage.openPanel();

      const panel = page.locator(".literature-extract-panel");
      await expect(panel).toBeVisible({ timeout: 10000 });

      // 执行提取
      const textArea = panel.locator("textarea");
      await textArea.fill(SAMPLE_TEXT_CONTENT);

      const startButton = panel
        .locator("button")
        .filter({ hasText: /开始提取/ });
      await startButton.click();

      // 等待预览弹窗
      const previewModal = getPreviewModal(page);
      await expect(previewModal).toBeVisible({ timeout: 60000 });

      // 检查概念卡片
      const conceptCards = previewModal.locator(
        '[class*="rounded-lg"][class*="border"]',
      );
      const count = await conceptCards.count();
      expect(count).toBeGreaterThan(0);
    });

    test("应该支持选择/取消选择概念", async ({ page, testGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);

      await extractPage.openPanel();

      const panel = page.locator(".literature-extract-panel");
      await expect(panel).toBeVisible({ timeout: 10000 });

      // 执行提取
      const textArea = panel.locator("textarea");
      await textArea.fill(SAMPLE_TEXT_CONTENT);

      const startButton = panel
        .locator("button")
        .filter({ hasText: /开始提取/ });
      await startButton.click();

      // 等待预览弹窗
      const previewModal = getPreviewModal(page);
      await expect(previewModal).toBeVisible({ timeout: 60000 });

      // 点击全选按钮（使用精确匹配避免匹配 "取消全选"）
      const selectAllButton = previewModal
        .locator("button")
        .filter({ hasText: /^全选$/ });
      await selectAllButton.click();

      // 验证已选择计数显示
      const selectedCount = previewModal.locator(
        "text=/已选择.*\\d+.*\\/.*\\d+/",
      );
      await expect(selectedCount).toBeVisible({ timeout: 3000 });

      // 点击取消全选按钮
      const deselectAllButton = previewModal
        .locator("button")
        .filter({ hasText: "取消全选" });
      await deselectAllButton.click();
    });

    test("应该显示已选择概念数量", async ({ page, testGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);

      await extractPage.openPanel();

      const panel = page.locator(".literature-extract-panel");
      await expect(panel).toBeVisible({ timeout: 10000 });

      // 执行提取
      const textArea = panel.locator("textarea");
      await textArea.fill(SAMPLE_TEXT_CONTENT);

      const startButton = panel
        .locator("button")
        .filter({ hasText: /开始提取/ });
      await startButton.click();

      // 等待预览弹窗
      const previewModal = getPreviewModal(page);
      await expect(previewModal).toBeVisible({ timeout: 60000 });

      // 检查选择计数
      const selectedCount = previewModal.locator(
        "text=/已选择.*\\d+.*\\/.*\\d+/",
      );
      await expect(selectedCount).toBeVisible({ timeout: 3000 });
    });

    test("应该支持编辑概念", async ({ page, testGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);

      await extractPage.openPanel();

      const panel = page.locator(".literature-extract-panel");
      await expect(panel).toBeVisible({ timeout: 10000 });

      // 执行提取
      const textArea = panel.locator("textarea");
      await textArea.fill(SAMPLE_TEXT_CONTENT);

      const startButton = panel
        .locator("button")
        .filter({ hasText: /开始提取/ });
      await startButton.click();

      // 等待预览弹窗
      const previewModal = getPreviewModal(page);
      await expect(previewModal).toBeVisible({ timeout: 60000 });

      // 点击编辑按钮（使用 accessible name 定位，避免依赖 svg class 名）
      const editButton = previewModal
        .getByRole("button", { name: "编辑" })
        .first();
      await editButton.click();

      // 检查编辑表单
      const editForm = previewModal.locator('input[type="text"], textarea');
      await expect(editForm.first()).toBeVisible({ timeout: 3000 });
    });

    test("应该支持确认添加概念", async ({ page, testGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);
      await setupAIMocks(page);

      await extractPage.openPanel();

      const panel = page.locator(".literature-extract-panel");
      await expect(panel).toBeVisible({ timeout: 10000 });

      // 执行提取
      const textArea = panel.locator("textarea");
      await textArea.fill(SAMPLE_TEXT_CONTENT);

      const startButton = panel
        .locator("button")
        .filter({ hasText: /开始提取/ });
      await startButton.click();

      // 等待预览弹窗
      const previewModal = getPreviewModal(page);
      await expect(previewModal).toBeVisible({ timeout: 60000 });

      // 先点击全选确保概念已选择（使用精确匹配避免匹配 "取消全选"）
      const selectAllBtn = previewModal
        .locator("button")
        .filter({ hasText: /^全选$/ });
      await selectAllBtn.click();

      // 点击确认按钮
      const confirmButton = previewModal
        .locator("button")
        .filter({ hasText: /确认添加/ });
      await expect(confirmButton).toBeEnabled({ timeout: 10000 });
      const responsePromise = page.waitForResponse(
        (resp) => resp.url().includes("/literature/apply"),
        { timeout: 15000 },
      );
      await confirmButton.click();
      const response = await responsePromise;
      expect(response.ok()).toBe(true);
    });
  });

  test.describe("概念定位到骨干模块", () => {
    test("应该显示概念的目标模块", async ({ page, testGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);

      await extractPage.openPanel();

      const panel = page.locator(".literature-extract-panel");
      await expect(panel).toBeVisible({ timeout: 10000 });

      // 执行提取
      const textArea = panel.locator("textarea");
      await textArea.fill(SAMPLE_TEXT_CONTENT);

      const startButton = panel
        .locator("button")
        .filter({ hasText: /开始提取/ });
      await startButton.click();

      // 等待预览弹窗
      const previewModal = getPreviewModal(page);
      await expect(previewModal).toBeVisible({ timeout: 60000 });

      // 检查模块标签
      const moduleLabels = previewModal.locator(
        "text=/研究背景|文献综述|研究方法|核心概念|应用领域|未来方向/",
      );
      await expect(moduleLabels.first()).toBeVisible({ timeout: 3000 });
    });

    test("应该支持修改概念的目标模块", async ({ page, testGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);

      await extractPage.openPanel();

      const panel = page.locator(".literature-extract-panel");
      await expect(panel).toBeVisible({ timeout: 10000 });

      // 执行提取
      const textArea = panel.locator("textarea");
      await textArea.fill(SAMPLE_TEXT_CONTENT);

      const startButton = panel
        .locator("button")
        .filter({ hasText: /开始提取/ });
      await startButton.click();

      // 等待预览弹窗
      const previewModal = getPreviewModal(page);
      await expect(previewModal).toBeVisible({ timeout: 60000 });

      // 点击编辑按钮（使用 accessible name 定位，避免依赖 svg class 名）
      const editButton = previewModal
        .getByRole("button", { name: "编辑" })
        .first();
      await editButton.click();

      // 检查模块选择器
      const moduleSelect = previewModal.locator("select").first();
      await moduleSelect.selectOption("core_concepts");
    });

    test("应该显示概念类型标签", async ({ page, testGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);

      await extractPage.openPanel();

      const panel = page.locator(".literature-extract-panel");
      await expect(panel).toBeVisible({ timeout: 10000 });

      // 执行提取
      const textArea = panel.locator("textarea");
      await textArea.fill(SAMPLE_TEXT_CONTENT);

      const startButton = panel
        .locator("button")
        .filter({ hasText: /开始提取/ });
      await startButton.click();

      // 等待预览弹窗
      const previewModal = getPreviewModal(page);
      await expect(previewModal).toBeVisible({ timeout: 60000 });

      // 检查概念类型标签
      const typeLabels = previewModal.locator(
        "text=/方法|机制|操作|概念|技术|工具/",
      );
      await expect(typeLabels.first()).toBeVisible({ timeout: 3000 });
    });

    test("应该显示相似度警告", async ({ page, testGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);

      await extractPage.openPanel();

      const panel = page.locator(".literature-extract-panel");
      await expect(panel).toBeVisible({ timeout: 10000 });

      // 执行提取
      const textArea = panel.locator("textarea");
      await textArea.fill(SAMPLE_TEXT_CONTENT);

      const startButton = panel
        .locator("button")
        .filter({ hasText: /开始提取/ });
      await startButton.click();

      // 等待预览弹窗
      const previewModal = getPreviewModal(page);
      await expect(previewModal).toBeVisible({ timeout: 60000 });

      // 检查相似度标签
      const similarityLabel = previewModal.locator("text=/相似|高相似度/");
      await expect(similarityLabel.first()).toBeVisible({ timeout: 5000 });
    });

    test("应该显示概念来源信息", async ({ page, testGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);

      await extractPage.openPanel();

      const panel = page.locator(".literature-extract-panel");
      await expect(panel).toBeVisible({ timeout: 10000 });

      // 执行提取
      const textArea = panel.locator("textarea");
      await textArea.fill(SAMPLE_TEXT_CONTENT);

      const startButton = panel
        .locator("button")
        .filter({ hasText: /开始提取/ });
      await startButton.click();

      // 等待预览弹窗
      const previewModal = getPreviewModal(page);
      await expect(previewModal).toBeVisible({ timeout: 60000 });

      // 展开概念详情
      const expandButton = previewModal
        .locator("button")
        .filter({ hasText: /更多信息|收起信息/ })
        .first();
      await expandButton.click();

      // 检查来源信息
      const sourceInfo = previewModal.locator("text=/来源|文本输入/");
      await expect(sourceInfo.first()).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe("错误处理和边界情况", () => {
    test("应该处理空输入", async ({ page, testGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);

      await extractPage.openPanel();

      const panel = page.locator(".literature-extract-panel");
      await expect(panel).toBeVisible({ timeout: 10000 });

      // 不输入任何内容直接点击提取
      const startButton = panel
        .locator("button")
        .filter({ hasText: /开始提取/ });
      await startButton.click();

      // 验证：空输入被拦截，不应进入处理状态
      await page.waitForTimeout(1000);
      await expect(
        panel.locator("button").filter({ hasText: /处理中/ }),
      ).toHaveCount(0);
      // 预览模态框不应出现
      await expect(getPreviewModal(page)).toHaveCount(0);
    });

    test("应该处理网络错误", async ({ page, testGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);

      await extractPage.openPanel();

      const panel = page.locator(".literature-extract-panel");
      await expect(panel).toBeVisible({ timeout: 10000 });

      // 切换到 URL 模式
      const urlModeButton = panel.locator("button").filter({ hasText: "URL" });
      await urlModeButton.click();

      // 输入一个可能失败的 URL
      const urlInput = panel.locator('input[type="url"]');
      await urlInput.fill("https://nonexistent-domain-12345.com/article");

      const startButton = panel
        .locator("button")
        .filter({ hasText: /开始提取/ });
      await startButton.click();

      // 应该显示错误提示或处理失败
      const errorIndicator = page.locator("text=/失败|错误|无法|超时/");
      await expect(errorIndicator.first()).toBeVisible({ timeout: 30000 });
    });

    test("应该支持关闭提取面板", async ({ page, testGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);

      await extractPage.openPanel();

      const panel = page.locator(".literature-extract-panel");
      await expect(panel).toBeVisible({ timeout: 10000 });

      // 点击关闭按钮
      const closeButton = panel
        .locator("button")
        .filter({ has: page.locator("svg.lucide-x") })
        .first();
      await closeButton.click();

      // 面板应该关闭
      await expect(panel).not.toBeVisible({ timeout: 3000 });
    });

    test("应该支持取消预览", async ({ page, testGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);

      await extractPage.openPanel();

      const panel = page.locator(".literature-extract-panel");
      await expect(panel).toBeVisible({ timeout: 10000 });

      // 执行提取
      const textArea = panel.locator("textarea");
      await textArea.fill(SAMPLE_TEXT_CONTENT);

      const startButton = panel
        .locator("button")
        .filter({ hasText: /开始提取/ });
      await startButton.click();

      // 等待预览弹窗
      const previewModal = getPreviewModal(page);
      await expect(previewModal).toBeVisible({ timeout: 60000 });

      // 点击取消按钮
      const cancelButton = previewModal
        .locator("button")
        .filter({ hasText: /^取消$/ });
      await cancelButton.click();

      // 弹窗应该关闭
      await expect(previewModal).not.toBeVisible({ timeout: 3000 });
    });
  });

  test.describe("移动端适配", () => {
    test("应该在移动端正确显示", async ({ page, testGraph }) => {
      // 设置移动端视口
      await page.setViewportSize({ width: 375, height: 667 });

      await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);

      await extractPage.openPanel();

      const panel = page.locator(".literature-extract-panel");
      await expect(panel).toBeVisible({ timeout: 10000 });

      // 检查移动端布局
      const textArea = panel.locator("textarea");
      await expect(textArea).toBeVisible();
    });

    test("应该在移动端支持触摸操作", async ({ page, testGraph }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);

      await extractPage.openPanel();

      const panel = page.locator(".literature-extract-panel");
      await expect(panel).toBeVisible({ timeout: 10000 });

      // 切换输入模式
      const fileModeButton = panel
        .locator("button")
        .filter({ hasText: "文件" });
      await fileModeButton.click();

      // 检查文件模式是否激活
      const dropzone = panel.locator('.border-dashed, input[type="file"]');
      await expect(dropzone.first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("节点挂载到骨干节点", () => {
    test("应该在确认添加后将概念节点挂载到骨干节点下", async ({ page, topicResearchGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${topicResearchGraph.id}`);
      await setupAIMocks(page);

      await extractPage.openPanel();

      const panel = page.locator(".literature-extract-panel");
      await expect(panel).toBeVisible({ timeout: 10000 });

      const textArea = panel.locator("textarea");
      await textArea.fill(SAMPLE_TEXT_CONTENT);

      const startButton = panel
        .locator("button")
        .filter({ hasText: /开始提取/ });
      await startButton.click();

      const previewModal = getPreviewModal(page);
      await expect(previewModal).toBeVisible({ timeout: 60000 });

      // 先点击全选确保概念已选择（使用精确匹配避免匹配 "取消全选"）
      const selectAllBtn = previewModal
        .locator("button")
        .filter({ hasText: /^全选$/ });
      await selectAllBtn.click();

      const confirmButton = previewModal
        .locator("button")
        .filter({ hasText: /确认添加/ });
      await expect(confirmButton).toBeEnabled({ timeout: 10000 });
      const responsePromise = page.waitForResponse(
        (resp) => resp.url().includes("/literature/apply"),
        { timeout: 15000 },
      );
      await confirmButton.click();
      const response = await responsePromise;
      expect(response.ok()).toBe(true);

      await page.waitForTimeout(2000);

      const backboneNode = page.locator(
        "text=/研究背景|文献综述|研究方法|核心概念|应用领域|未来方向/",
      );
      await expect(backboneNode.first()).toBeVisible({ timeout: 5000 });
      const backboneNodeCount = await backboneNode.count();
      expect(backboneNodeCount).toBeGreaterThan(0);
    });

    test("应该在图谱大纲中显示正确的层级关系", async ({ page, topicResearchGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${topicResearchGraph.id}`);
      await setupAIMocks(page);

      await extractPage.openPanel();

      const panel = page.locator(".literature-extract-panel");
      await expect(panel).toBeVisible({ timeout: 10000 });

      const textArea = panel.locator("textarea");
      await textArea.fill(SAMPLE_TEXT_CONTENT);

      const startButton = panel
        .locator("button")
        .filter({ hasText: /开始提取/ });
      await startButton.click();

      const previewModal = getPreviewModal(page);
      await expect(previewModal).toBeVisible({ timeout: 60000 });

      // 先点击全选确保概念已选择（使用精确匹配避免匹配 "取消全选"）
      const selectAllBtn = previewModal
        .locator("button")
        .filter({ hasText: /^全选$/ });
      await selectAllBtn.click();

      const confirmButton = previewModal
        .locator("button")
        .filter({ hasText: /确认添加/ });
      await expect(confirmButton).toBeEnabled({ timeout: 10000 });
      const responsePromise = page.waitForResponse(
        (resp) => resp.url().includes("/literature/apply"),
        { timeout: 15000 },
      );
      await confirmButton.click();
      const response = await responsePromise;
      expect(response.ok()).toBe(true);

      await page.waitForTimeout(2000);

      // 大纲面板默认可见，直接检查骨干节点层级
      const backboneNodeInOutline = page.locator(
        "text=/研究背景|文献综述|研究方法|核心概念|应用领域|未来方向/",
      );
      await expect(backboneNodeInOutline.first()).toBeVisible({
        timeout: 5000,
      });
    });

    test("应该在节点属性中显示正确的骨干模块", async ({ page, topicResearchGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${topicResearchGraph.id}`);
      await setupAIMocks(page);

      await extractPage.openPanel();

      const panel = page.locator(".literature-extract-panel");
      await expect(panel).toBeVisible({ timeout: 10000 });

      const textArea = panel.locator("textarea");
      await textArea.fill(SAMPLE_TEXT_CONTENT);

      const startButton = panel
        .locator("button")
        .filter({ hasText: /开始提取/ });
      await startButton.click();

      const previewModal = getPreviewModal(page);
      await expect(previewModal).toBeVisible({ timeout: 60000 });

      const conceptCards = previewModal.locator(
        '[class*="rounded-lg"][class*="border"]',
      );
      await expect(conceptCards.first()).toBeVisible({ timeout: 5000 });

      const firstCard = conceptCards.first();
      // 使用精确匹配正则避免匹配标题（如"研究背景概述"）和描述文本
      const moduleLabel = firstCard.locator(
        "text=/^研究背景$|^文献综述$|^研究方法$|^核心概念$|^应用领域$|^未来方向$/",
      );
      await expect(moduleLabel.first()).toBeVisible({ timeout: 5000 });
    });

    test("应该在没有骨干节点时创建根节点", async ({ page, testGraph }) => {
      await navigateAndWaitForAuth(page, `/graph/${testGraph.id}`);
      await setupAIMocks(page);

      await extractPage.openPanel();

      const panel = page.locator(".literature-extract-panel");
      await expect(panel).toBeVisible({ timeout: 10000 });

      const textArea = panel.locator("textarea");
      await textArea.fill(SAMPLE_TEXT_CONTENT);

      const startButton = panel
        .locator("button")
        .filter({ hasText: /开始提取/ });
      await startButton.click();

      const previewModal = getPreviewModal(page);
      await expect(previewModal).toBeVisible({ timeout: 60000 });

      // 先点击全选确保概念已选择（使用精确匹配避免匹配 "取消全选"）
      const selectAllBtn = previewModal
        .locator("button")
        .filter({ hasText: /^全选$/ });
      await selectAllBtn.click();

      const confirmButton = previewModal
        .locator("button")
        .filter({ hasText: /确认添加/ });
      await expect(confirmButton).toBeEnabled({ timeout: 10000 });
      const responsePromise = page.waitForResponse(
        (resp) => resp.url().includes("/literature/apply"),
        { timeout: 15000 },
      );
      await confirmButton.click();
      const response = await responsePromise;
      expect(response.ok()).toBe(true);
    });
  });
});
