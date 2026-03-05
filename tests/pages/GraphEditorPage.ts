import { Locator, Page } from "@playwright/test";
import { createNodeViaAPI } from "../utils/testHelpers";

export class GraphEditorPage {
  readonly page: Page;
  private graphId: string | null = null;

  // 工具栏元素
  readonly graphTitle: Locator;
  readonly backButton: Locator;
  readonly addNodeButton: Locator;
  readonly editDropdown: Locator;
  readonly undoButton: Locator;
  readonly redoButton: Locator;

  // 画布元素
  readonly canvas: Locator;
  readonly nodeSelector: Locator;
  readonly edgeSelector: Locator;
  readonly emptyState: Locator;

  // 侧边栏元素
  readonly sidebar: Locator;
  readonly sidebarTitle: Locator;
  readonly nodeTitleInput: Locator;
  readonly nodeContentInput: Locator;
  readonly nodeLevelSelect: Locator;
  readonly parentNodeInput: Locator;
  readonly saveNodeButton: Locator;
  readonly cancelButton: Locator;
  readonly closeSidebarButton: Locator;

  // 节点详情侧边栏
  readonly nodeDetailSidebar: Locator;
  readonly editNodeButton: Locator;
  readonly deleteNodeButton: Locator;

  // 大纲侧边栏
  readonly outlineSidebar: Locator;
  readonly outlineItems: Locator;

  // 缩放控制
  readonly zoomInButton: Locator;
  readonly zoomOutButton: Locator;
  readonly resetViewButton: Locator;
  readonly fitViewButton: Locator;
  readonly zoomLevelDisplay: Locator;

  // 导出按钮
  readonly exportDropdown: Locator;

  constructor(page: Page) {
    this.page = page;

    // 工具栏
    this.graphTitle = page.locator("h1").first();
    this.backButton = page.locator('button[title="返回"]').first();
    this.addNodeButton = page.locator('button:has-text("添加节点")').first();
    this.editDropdown = page.locator('button:has-text("编辑")').first();
    this.undoButton = page.locator('button[title="撤销"]').first();
    this.redoButton = page.locator('button[title="重做"]').first();

    // 画布
    this.canvas = page.locator('.react-flow, [class*="canvas"], svg').first();
    this.nodeSelector = page
      .locator("div, g, span, p")
      .filter({ hasText: /.+/ });
    this.edgeSelector = page.locator('path[class*="edge"], [data-edge-id]');
    this.emptyState = page.locator("text=/暂无节点|空图谱|开始创建/i");

    // 侧边栏 - 编辑/创建
    this.sidebar = page
      .locator('[class*="sidebar"], aside, .absolute.right-0')
      .filter({ has: page.locator("h3") });
    this.sidebarTitle = page.locator(
      'h3:has-text("创建新节点"), h3:has-text("编辑节点")',
    );
    this.nodeTitleInput = page
      .locator('input[placeholder*="标题"], input[type="text"]')
      .first();
    this.nodeContentInput = page.locator(
      'textarea[placeholder*="Markdown"], textarea[placeholder*="内容"]',
    );
    this.nodeLevelSelect = page
      .locator("select")
      .filter({ has: page.locator('option[value="root"]') });
    this.parentNodeInput = page.locator('input[placeholder*="搜索选择父节点"]');
    this.saveNodeButton = page
      .locator('button:has-text("保存"), button:has-text("保存节点")')
      .first();
    this.cancelButton = page
      .locator('button:has-text("取消"), button:has-text("返回")')
      .last();
    this.closeSidebarButton = page
      .locator("button")
      .filter({ has: page.locator("svg") })
      .first();

    // 节点详情
    this.nodeDetailSidebar = page
      .locator('[class*="sidebar"]')
      .filter({ has: page.locator("text=/编辑|删除/") });
    this.editNodeButton = page.locator('button:has-text("编辑")').first();
    this.deleteNodeButton = page.locator('button:has-text("删除")').first();

    // 大纲
    this.outlineSidebar = page
      .locator('[class*="sidebar"]')
      .filter({ has: page.locator("text=/大纲|节点列表/") });
    this.outlineItems = page.locator(
      '[class*="outline-item"], [class*="node-item"]',
    );

    // 缩放控制
    this.zoomInButton = page.locator('button[title="放大"]');
    this.zoomOutButton = page.locator('button[title="缩小"]');
    this.resetViewButton = page.locator('button[title="重置视角"]');
    this.fitViewButton = page.locator('button[title="适应屏幕"]');
    this.zoomLevelDisplay = page.locator("text=/缩放.*%/");

    // 导出
    this.exportDropdown = page.locator('button:has-text("设置")');
  }

  async goto(graphId: string) {
    this.graphId = graphId;
    await this.page.goto(`/graph/${graphId}`);
    await this.page.waitForLoadState("networkidle");
    // 等待画布加载
    await this.canvas
      .waitFor({ state: "visible", timeout: 15000 })
      .catch(() => {});
  }

  async openEditDropdown() {
    // 检查是否是移动端（通过检查底部导航栏）
    const isMobile = (await this.page.locator(".fixed.bottom-0").count()) > 0;

    if (isMobile) {
      // 移动端：直接点击底部导航栏的"添加"按钮
      await this.page.locator('button:has-text("添加")').click();
    } else {
      // 桌面端：点击"编辑"下拉菜单
      await this.editDropdown.click();
      // 等待下拉菜单出现
      await this.page.waitForTimeout(200);
    }
  }

  async clickAddNode() {
    // 检查是否是移动端
    const isMobile = (await this.page.locator(".fixed.bottom-0").count()) > 0;

    if (isMobile) {
      // 移动端：直接点击底部导航栏的"添加"按钮
      await this.page.locator('button:has-text("添加")').click();
    } else {
      // 桌面端：先打开编辑下拉菜单
      await this.openEditDropdown();
      // 点击添加节点选项
      await this.page.locator('button:has-text("添加节点")').click();
    }
  }

  async getNodeCount() {
    await this.page.waitForTimeout(1000);
    // 只计算画布上的节点，不包括侧边栏中的元素
    // 使用更精确的选择器来定位画布中的节点
    const canvasNodes = this.page.locator(".react-flow__node");
    const count = await canvasNodes.count();
    console.log(`Node count: ${count}`);
    return count;
  }

  async getEdgeCount() {
    return await this.edgeSelector.count();
  }

  async clickNode(nodeTitle: string) {
    // 点击节点文本
    const nodeText = this.page.locator(`text="${nodeTitle}"`).first();
    await nodeText.click();
  }

  async clickNodeByIndex(index: number) {
    const nodes = this.nodeSelector;
    const count = await nodes.count();
    if (index < count) {
      await nodes.nth(index).click();
    }
  }

  async fillNodeForm(title: string, content?: string, level?: string) {
    await this.nodeTitleInput.waitFor({ state: "visible", timeout: 5000 });
    await this.nodeTitleInput.fill(title);
    if (content) {
      await this.nodeContentInput.fill(content);
    }
    if (level) {
      await this.nodeLevelSelect.selectOption(level);
    }
    await this.page.waitForTimeout(500);
  }

  async saveNode() {
    console.log("Attempting to save node...");
    const isVisible = await this.saveNodeButton.isVisible();
    console.log(`Save button visible: ${isVisible}`);
    await this.saveNodeButton.click();
    console.log("Save button clicked");
    // 等待保存完成
    await this.page.waitForTimeout(1000);
  }

  async createNodeViaAPI(title: string, content?: string, level?: string) {
    if (!this.graphId) {
      throw new Error("Graph ID not set. Call goto() first.");
    }
    console.log(`Creating node: ${title} in graph: ${this.graphId}`);
    await createNodeViaAPI(this.page, this.graphId, title, content, level);
    console.log("Node created via API, waiting for page to update...");
    await this.page.waitForTimeout(5000);
  }

  async cancelNodeEdit() {
    // 取消编辑可能是点击关闭按钮或返回按钮
    // 尝试点击关闭按钮（X 图标）
    const closeButton = this.page
      .locator("button")
      .filter({ has: this.page.locator("svg") })
      .first();
    if ((await closeButton.count()) > 0) {
      await closeButton.click();
    } else {
      // 如果没有关闭按钮，尝试点击取消按钮
      await this.cancelButton.click();
    }
    await this.page.waitForTimeout(500);
  }

  async closeSidebar() {
    const closeButton = this.page
      .locator("button")
      .filter({ has: this.page.locator("svg") })
      .first();
    await closeButton.click();
  }

  async deleteSelectedNode() {
    // 检查是否是移动端
    const isMobile = (await this.page.locator(".fixed.bottom-0").count()) > 0;

    if (isMobile) {
      // 移动端：点击"更多"按钮，然后选择删除
      await this.page.locator('button:has-text("更多")').click();
      await this.page.waitForTimeout(300);
      // 移动端删除按钮文本可能不同，尝试多个选择器
      const deleteButton = this.page
        .locator('button:has-text("删除节点"), button:has-text("删除")')
        .first();
      if ((await deleteButton.count()) > 0) {
        await deleteButton.click();
      }
    } else {
      // 桌面端：打开编辑下拉菜单
      await this.openEditDropdown();
      await this.page.waitForTimeout(200);
      // 点击删除选中节点
      await this.page.locator('button:has-text("删除选中节点")').click();
    }
  }

  async selectParentNode(parentTitle: string) {
    // 等待父节点输入框可见
    await this.parentNodeInput.waitFor({ state: "visible", timeout: 5000 });
    // 点击输入框打开下拉菜单
    await this.parentNodeInput.click();
    await this.page.waitForTimeout(500);

    // 输入父节点标题进行搜索
    await this.parentNodeInput.fill(parentTitle);
    await this.page.waitForTimeout(2000);

    // 等待下拉菜单出现，增加超时时间
    try {
      await this.page.waitForSelector('button:has-text("无父节点")', {
        timeout: 10000,
      });
    } catch (e) {
      // 如果没有找到"无父节点"按钮，可能是因为有匹配的节点
      console.log('No "no parent" button found, continuing...');
    }

    // 点击匹配的父节点选项
    const parentButton = this.page
      .locator(`button:has-text("${parentTitle}")`)
      .first();
    await parentButton.waitFor({ state: "visible", timeout: 10000 });
    await parentButton.click();
    await this.page.waitForTimeout(500);
  }

  async isDarkMode() {
    const html = this.page.locator("html");
    return await html
      .getAttribute("class")
      .then((cls) => cls?.includes("dark") || false);
  }

  async toggleTheme() {
    const themeButton = this.page
      .locator('button[title*="主题"], button[title*="theme"]')
      .first();
    await themeButton.click();
  }

  async waitForCanvasReady() {
    try {
      await this.canvas.waitFor({ state: "visible", timeout: 15000 });
    } catch (e) {}
  }

  async getVisibleNodeTitles(): Promise<string[]> {
    const nodes = this.nodeSelector;
    const count = await nodes.count();
    const titles: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await nodes.nth(i).textContent();
      if (text) {
        titles.push(text.trim());
      }
    }
    return titles;
  }

  async openOutlineSidebar() {
    // 点击视图下拉菜单
    await this.page.locator('button:has-text("视图")').click();
    await this.page.waitForTimeout(200);
    // 点击侧边栏大纲
    await this.page.locator('button:has-text("侧边栏大纲")').click();
  }

  async createConnection(sourceNodeTitle: string, targetNodeTitle: string) {
    // 在大纲视图中选择两个节点创建连接
    // 这个功能可能需要根据实际实现调整
    await this.openOutlineSidebar();
    // 选择源节点
    await this.page.locator(`text="${sourceNodeTitle}"`).first().click();
    // 使用 Ctrl+点击选择目标节点（多选）
    await this.page.keyboard.down("Control");
    await this.page.locator(`text="${targetNodeTitle}"`).first().click();
    await this.page.keyboard.up("Control");
  }

  // ==================== 缩放和平移方法 ====================

  /**
   * 放大画布
   */
  async zoomIn() {
    await this.zoomInButton.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * 缩小画布
   */
  async zoomOut() {
    await this.zoomOutButton.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * 重置视图到初始状态
   */
  async resetView() {
    await this.resetViewButton.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * 适应屏幕，显示所有节点
   */
  async fitView() {
    await this.fitViewButton.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * 使用鼠标滚轮缩放
   */
  async zoomWithWheel(deltaY: number) {
    await this.canvas.hover();
    await this.page.mouse.wheel(0, deltaY);
    await this.page.waitForTimeout(200);
  }

  /**
   * 平移画布
   */
  async panCanvas(deltaX: number, deltaY: number) {
    const canvasBox = await this.canvas.boundingBox();
    if (!canvasBox) return;

    const startX = canvasBox.x + canvasBox.width / 2;
    const startY = canvasBox.y + canvasBox.height / 2;

    await this.page.mouse.move(startX, startY);
    await this.page.mouse.down();
    await this.page.mouse.move(startX + deltaX, startY + deltaY, { steps: 10 });
    await this.page.mouse.up();
    await this.page.waitForTimeout(200);
  }

  /**
   * 获取当前缩放级别
   */
  async getZoomLevel(): Promise<number> {
    const text = await this.zoomLevelDisplay.textContent();
    if (!text) return 1;
    const match = text.match(/(\d+)%/);
    return match ? parseInt(match[1]) / 100 : 1;
  }

  // ==================== 节点拖拽方法 ====================

  /**
   * 拖拽节点到新位置
   */
  async dragNode(nodeTitle: string, deltaX: number, deltaY: number) {
    const nodeLocator = this.page.locator(`text="${nodeTitle}"`).first();
    await nodeLocator.waitFor({ state: "visible", timeout: 5000 });

    const nodeBox = await nodeLocator.boundingBox();
    if (!nodeBox) throw new Error(`Node "${nodeTitle}" not found`);

    const startX = nodeBox.x + nodeBox.width / 2;
    const startY = nodeBox.y + nodeBox.height / 2;

    await this.page.mouse.move(startX, startY);
    await this.page.mouse.down();
    await this.page.mouse.move(startX + deltaX, startY + deltaY, { steps: 20 });
    await this.page.mouse.up();
    await this.page.waitForTimeout(500);
  }

  /**
   * 获取节点位置
   */
  async getNodePosition(
    nodeTitle: string,
  ): Promise<{ x: number; y: number } | null> {
    const nodeLocator = this.page.locator(`text="${nodeTitle}"`).first();
    const box = await nodeLocator.boundingBox();
    if (!box) return null;
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }

  // ==================== 导出导入方法 ====================

  /**
   * 打开设置菜单
   */
  async openSettingsMenu() {
    await this.page.locator('button:has-text("设置")').click();
    await this.page.waitForTimeout(300);
  }

  /**
   * 导出为 Markdown
   */
  async exportToMarkdown() {
    await this.openSettingsMenu();
    await this.page.locator('button:has-text("Markdown")').click();
    await this.page.waitForTimeout(500);
  }

  /**
   * 导出为 JSON
   */
  async exportToJSON() {
    await this.openSettingsMenu();
    await this.page.locator('button:has-text("JSON")').click();
    await this.page.waitForTimeout(500);
  }

  /**
   * 导出为 PDF
   */
  async exportToPDF() {
    await this.openSettingsMenu();
    await this.page.locator('button:has-text("PDF")').click();
    await this.page.waitForTimeout(500);
  }

  /**
   * 导出为图片
   */
  async exportToImage() {
    await this.openSettingsMenu();
    await this.page.locator('button:has-text("图片")').click();
    await this.page.waitForTimeout(500);
  }

  /**
   * 导出 Anki 卡片
   */
  async exportToAnki() {
    await this.openSettingsMenu();
    await this.page.locator('button:has-text("Anki")').click();
    await this.page.waitForTimeout(500);
  }

  // ==================== 性能测试辅助方法 ====================

  /**
   * 批量添加节点（用于性能测试）
   */
  async addMultipleNodes(count: number, prefix: string = "节点") {
    for (let i = 0; i < count; i++) {
      await this.clickAddNode();
      await this.page.waitForTimeout(100);
      await this.fillNodeForm(`${prefix} ${i + 1}`, `内容 ${i + 1}`);
      await this.saveNode();
      await this.page.waitForTimeout(200);
    }
  }

  /**
   * 等待画布渲染完成
   */
  async waitForRenderComplete(timeout: number = 5000) {
    await this.page.waitForTimeout(500);
    // 等待所有节点可见
    const nodeCount = await this.getNodeCount();
    if (nodeCount > 0) {
      await this.nodeSelector.first().waitFor({ state: "visible", timeout });
    }
  }

  /**
   * 测量渲染时间
   */
  async measureRenderTime(): Promise<number> {
    const startTime = Date.now();
    await this.waitForRenderComplete();
    return Date.now() - startTime;
  }

  /**
   * 检查画布是否响应（用于性能测试）
   */
  async isCanvasResponsive(): Promise<boolean> {
    try {
      await this.canvas.click({ timeout: 1000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取画布中心点
   */
  async getCanvasCenter(): Promise<{ x: number; y: number } | null> {
    const box = await this.canvas.boundingBox();
    if (!box) return null;
    return {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    };
  }
}
