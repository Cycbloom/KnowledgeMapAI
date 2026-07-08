import { Page, Locator, expect } from "@playwright/test";

export class GraphPage {
  readonly page: Page;
  readonly newGraphButton: Locator;
  readonly graphTitleInput: Locator;
  readonly createGraphButton: Locator;
  readonly graphLink: Locator;
  readonly nodeTitleInput: Locator;
  readonly saveNodeButton: Locator;
  readonly shareButton: Locator;
  readonly backboneNodeIcon: Locator;
  readonly compatibilityChecker: Locator;
  readonly autoFixButton: Locator;
  readonly ignoreButton: Locator;
  readonly nodeEditSidebar: Locator;

  constructor(page: Page) {
    this.page = page;
    this.newGraphButton = page
      .locator('button:has-text("新建"), button:has-text("创建")')
      .first();
    this.graphTitleInput = page
      .locator('input[placeholder*="标题"], input[name="title"]')
      .first();
    this.createGraphButton = page
      .locator('button:has-text("创建"), button[type="submit"]')
      .first();
    this.graphLink = page.locator('a[href^="/graph/"]').first();
    this.nodeTitleInput = page
      .locator('input[placeholder*="节点标题"]')
      .first();
    this.saveNodeButton = page.locator('button:has-text("保存")').first();
    this.shareButton = page.locator('button:has-text("分享")');
    this.backboneNodeIcon = page.locator('[data-testid="backbone-node-icon"]');
    this.compatibilityChecker = page.locator("text=骨干节点兼容性检查");
    this.autoFixButton = page.locator('button:has-text("自动修复")');
    this.ignoreButton = page.locator('button:has-text("忽略")');
    this.nodeEditSidebar = page.locator('[data-testid="node-edit-sidebar"]');
  }

  async navigateToHome() {
    await this.page.goto("/");
    await this.page.waitForLoadState("networkidle");
  }

  async createGraph(title: string, templateType?: string) {
    await this.newGraphButton.click();
    await this.graphTitleInput.fill(title);

    if (templateType) {
      const templateSelector = this.page.locator(
        `button:has-text("${templateType}"), [data-template="${templateType}"]`,
      );
      await expect(templateSelector).toBeVisible({ timeout: 3000 });
      await templateSelector.click();
    }

    await this.createGraphButton.click();
    await this.page.waitForURL(/\/graph\/.*/, { timeout: 15000 });
  }

  async openFirstGraph() {
    await this.page.waitForLoadState("networkidle");
    await expect(this.graphLink).toBeVisible({ timeout: 5000 });
    await this.graphLink.click();
    await this.page.waitForLoadState("networkidle");
  }

  async selectNode(nodeTitle: string) {
    const node = this.page.locator(`text="${nodeTitle}"`).first();
    await node.click();
    await this.page.waitForTimeout(500);
  }

  async openNodeEdit(nodeTitle: string) {
    await this.selectNode(nodeTitle);
    const editButton = this.page.locator('button:has-text("编辑")').first();
    await expect(editButton).toBeVisible({ timeout: 3000 });
    await editButton.click();
  }

  async isBackboneNodeTitleReadOnly(): Promise<boolean> {
    const titleInput = this.page
      .locator('input[placeholder*="节点标题"], input[value]')
      .first();
    const isReadOnly = await titleInput.getAttribute("readonly");
    return isReadOnly !== null;
  }

  async getBackboneNodeIcon(nodeTitle: string): Promise<Locator> {
    const node = this.page.locator(`text="${nodeTitle}"`).first();
    const parent = node.locator("xpath=..");
    return parent.locator(
      '[data-testid="backbone-node-icon"], svg[class*="backbone"]',
    );
  }

  async hasCompatibilityChecker(): Promise<boolean> {
    await expect(this.compatibilityChecker).toBeVisible({ timeout: 5000 });
    return true;
  }

  async autoFixCompatibility() {
    await this.hasCompatibilityChecker();
    await this.autoFixButton.click();
    await this.page.waitForTimeout(2000);
  }

  async ignoreCompatibility() {
    await this.hasCompatibilityChecker();
    await this.ignoreButton.click();
  }

  async getToastMessage(): Promise<string | null> {
    const toast = this.page
      .locator('[role="alert"], .toast, [data-testid="message"]')
      .first();
    const visible = await toast.isVisible({ timeout: 3000 });
    if (!visible) {
      return null;
    }
    return await toast.textContent();
  }
}
