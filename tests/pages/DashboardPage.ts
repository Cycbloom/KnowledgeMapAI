import { Page, Locator } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly title: Locator;
  readonly searchInput: Locator;
  readonly newGraphButton: Locator;
  readonly aiGenerateButton: Locator;
  readonly graphCards: Locator;
  readonly themeButton: Locator;
  readonly emptyState: Locator;
  readonly templateSelector: Locator;
  readonly skipTemplateButton: Locator;
  readonly createGraphModal: Locator;
  readonly graphTitleInput: Locator;
  readonly graphDescriptionInput: Locator;
  readonly confirmCreateButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.title = page.locator('h1:has-text("我的知识图谱")');
    this.searchInput = page.locator('input[placeholder*="搜索"]');
    this.newGraphButton = page.locator('button:has-text("新建图谱")').first();
    this.aiGenerateButton = page.locator('button:has-text("AI 生成")');
    this.graphCards = page.locator('[class*="group relative rounded-2xl"]');
    this.themeButton = page.locator('button[title*="切换"]');
    this.emptyState = page.locator('text=开始您的知识之旅');
    this.templateSelector = page.locator('text=选择模板');
    this.skipTemplateButton = page.locator('button:has-text("跳过，创建空白图谱")');
    this.createGraphModal = page.locator('.fixed.inset-0.z-50');
    this.graphTitleInput = page.locator('input[placeholder*="例如"]');
    this.graphDescriptionInput = page.locator('textarea[placeholder*="描述"]');
    this.confirmCreateButton = page.locator('button:has-text("立即创建")');
    this.cancelButton = page.locator('button:has-text("取消")');
  }

  async goto() {
    await this.page.goto('/');
  }

  async searchGraphs(query: string) {
    await this.searchInput.fill(query);
  }

  async openCreateGraphModal() {
    await this.newGraphButton.click();
    await this.templateSelector.waitFor({ state: 'visible' });
    await this.skipTemplateButton.click();
  }

  async createGraph(title: string, description?: string) {
    await this.openCreateGraphModal();
    await this.graphTitleInput.fill(title);
    if (description) {
      await this.graphDescriptionInput.fill(description);
    }
    await this.confirmCreateButton.click();
  }

  async toggleTheme() {
    await this.themeButton.click();
  }

  async isDarkMode() {
    return await this.page.locator('.dark').count() > 0;
  }

  async getGraphCount() {
    return await this.graphCards.count();
  }

  async closeModal() {
    await this.cancelButton.click();
  }
}
