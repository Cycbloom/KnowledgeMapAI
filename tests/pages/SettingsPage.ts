import { Locator, Page } from '@playwright/test';

export class SettingsPage {
  readonly page: Page;
  readonly title: Locator;
  readonly lightThemeButton: Locator;
  readonly darkThemeButton: Locator;
  readonly systemThemeButton: Locator;
  readonly saveButton: Locator;
  readonly backButton: Locator;
  readonly appearanceSection: Locator;
  readonly aiSection: Locator;
  readonly fsrsSection: Locator;

  // AI Configuration Locators
  readonly textTaskProviderSelect: Locator;
  readonly textTaskModelSelect: Locator;
  readonly embeddingProviderSelect: Locator;
  readonly embeddingModelSelect: Locator;
  readonly reasoningProviderSelect: Locator;
  readonly reasoningModelSelect: Locator;
  readonly addModelInput: Locator;
  readonly addModelButton: Locator;
  readonly modelProviderSelect: Locator;

  // FSRS Configuration Locators
  readonly retentionInput: Locator;
  readonly retentionSlider: Locator;
  readonly maxIntervalInput: Locator;
  readonly maxIntervalSlider: Locator;

  constructor(page: Page) {
    this.page = page;
    this.title = page.locator('h1:has-text("系统设置")');
    this.lightThemeButton = page.locator('button:has-text("浅色模式")');
    this.darkThemeButton = page.locator('button:has-text("深色模式")');
    this.systemThemeButton = page.locator('button:has-text("跟随系统")');
    this.saveButton = page.locator('button:has-text("保存所有更改"), button:has-text("保存中...")');
    this.backButton = page.locator('button:has([class*="ArrowLeft"])');
    this.appearanceSection = page.locator('h2:has-text("外观设置")').locator('..');
    this.aiSection = page.locator('h2:has-text("AI 状态与配置")').locator('..');
    this.fsrsSection = page.locator('h2:has-text("学习算法配置")').locator('..');

    // AI Configuration - Text Task (使用更精确的父容器定位)
    this.textTaskProviderSelect = page.locator('h3:has-text("文本生成任务")').locator('xpath=ancestor::div[contains(@class, "p-4")]').locator('select').first();
    this.textTaskModelSelect = page.locator('h3:has-text("文本生成任务")').locator('xpath=ancestor::div[contains(@class, "p-4")]').locator('select').nth(1);

    // AI Configuration - Embedding Task
    this.embeddingProviderSelect = page.locator('h3:has-text("向量化任务")').locator('xpath=ancestor::div[contains(@class, "p-4")]').locator('select').first();
    this.embeddingModelSelect = page.locator('h3:has-text("向量化任务")').locator('xpath=ancestor::div[contains(@class, "p-4")]').locator('select').nth(1);

    // AI Configuration - Reasoning Task
    this.reasoningProviderSelect = page.locator('h3:has-text("推理任务")').locator('xpath=ancestor::div[contains(@class, "p-4")]').locator('select').first();
    this.reasoningModelSelect = page.locator('h3:has-text("推理任务")').locator('xpath=ancestor::div[contains(@class, "p-4")]').locator('select').nth(1);

    // Model Management
    this.addModelInput = page.locator('input[placeholder*="输入模型名称"]');
    this.addModelButton = page.locator('button:has-text("添加")');
    this.modelProviderSelect = page.locator('h3:has-text("可用模型库管理")').locator('xpath=ancestor::div[contains(@class, "p-4")]').locator('select').first();

    // FSRS Configuration (使用更精确的定位 - 通过 min/max 属性区分)
    this.retentionInput = page.locator('input[type="number"][min="0.70"][max="0.99"]');
    this.retentionSlider = page.locator('input[type="range"][min="0.70"][max="0.99"]');
    this.maxIntervalInput = page.locator('input[type="number"][min="1"][max="36500"]');
    this.maxIntervalSlider = page.locator('input[type="range"][min="1"][max="36500"]');
  }

  async goto() {
    await this.page.goto('/settings');
    await this.page.waitForLoadState('networkidle');
    // 等待页面标题出现
    await this.title.waitFor({ state: 'visible', timeout: 10000 });
  }

  async selectLightTheme() {
    await this.lightThemeButton.click();
  }

  async selectDarkTheme() {
    await this.darkThemeButton.click();
  }

  async selectSystemTheme() {
    await this.systemThemeButton.click();
  }

  async clickSave() {
    await this.saveButton.click();
  }

  async clickBack() {
    await this.backButton.click();
  }

  async isDarkMode() {
    return await this.page.locator('.dark').count() > 0;
  }

  async getCurrentTheme() {
    if (await this.lightThemeButton.getAttribute('class').then(c => c?.includes('bg-blue-50') || c?.includes('ring-1'))) {
      return 'light';
    }
    if (await this.darkThemeButton.getAttribute('class').then(c => c?.includes('bg-slate-800') || c?.includes('ring-1'))) {
      return 'dark';
    }
    if (await this.systemThemeButton.getAttribute('class').then(c => c?.includes('bg-purple-50') || c?.includes('ring-1'))) {
      return 'system';
    }
    return 'unknown';
  }

  async waitForSaveComplete() {
    // 等待保存按钮文本变回"保存所有更改"
    await this.page.locator('button:has-text("保存所有更改")').waitFor({ state: 'visible', timeout: 15000 });
  }

  // AI Configuration Methods
  async selectTextTaskProvider(provider: string) {
    await this.textTaskProviderSelect.selectOption(provider);
  }

  async selectTextTaskModel(model: string) {
    await this.textTaskModelSelect.selectOption(model);
  }

  async selectEmbeddingProvider(provider: string) {
    await this.embeddingProviderSelect.selectOption(provider);
  }

  async selectEmbeddingModel(model: string) {
    await this.embeddingModelSelect.selectOption(model);
  }

  async selectReasoningProvider(provider: string) {
    await this.reasoningProviderSelect.selectOption(provider);
  }

  async selectReasoningModel(model: string) {
    await this.reasoningModelSelect.selectOption(model);
  }

  async getTextTaskProvider(): Promise<string> {
    return await this.textTaskProviderSelect.inputValue();
  }

  async getTextTaskModel(): Promise<string> {
    return await this.textTaskModelSelect.inputValue();
  }

  async getEmbeddingProvider(): Promise<string> {
    return await this.embeddingProviderSelect.inputValue();
  }

  async getEmbeddingModel(): Promise<string> {
    return await this.embeddingModelSelect.inputValue();
  }

  async getReasoningProvider(): Promise<string> {
    return await this.reasoningProviderSelect.inputValue();
  }

  async getReasoningModel(): Promise<string> {
    return await this.reasoningModelSelect.inputValue();
  }

  // Model Management Methods
  async addNewModel(provider: string, modelName: string) {
    await this.modelProviderSelect.selectOption(provider);
    await this.addModelInput.fill(modelName);
    await this.addModelButton.click();
    // 等待模型添加完成
    await this.page.waitForTimeout(1000);
  }

  async deleteModel(provider: string, modelName: string) {
    // 找到提供商区域，然后找到模型行
    const providerCard = this.page.locator(`div.border:has(div:text-is("${provider}"))`);
    const modelRow = providerCard.locator(`div.flex.justify-between:has(span:has-text("${modelName}"))`);
    // 悬停显示删除按钮
    await modelRow.hover();
    // 点击删除按钮
    await modelRow.locator('button').click();
    await this.page.waitForTimeout(500);
  }

  async isModelInList(provider: string, modelName: string): Promise<boolean> {
    // 找到提供商区域
    const providerCard = this.page.locator(`div.border:has(div:text-is("${provider}"))`);
    const modelSpan = providerCard.locator(`span.truncate:has-text("${modelName}")`);
    return await modelSpan.count() > 0;
  }

  // FSRS Configuration Methods
  async setRetention(value: number) {
    await this.retentionInput.fill(value.toString());
  }

  async getRetention(): Promise<number> {
    const value = await this.retentionInput.inputValue();
    return parseFloat(value);
  }

  async setMaxInterval(value: number) {
    await this.maxIntervalInput.fill(value.toString());
  }

  async getMaxInterval(): Promise<number> {
    const value = await this.maxIntervalInput.inputValue();
    return parseInt(value);
  }

  // Persistence Methods
  async reloadAndWait() {
    await this.page.reload();
    await this.page.waitForLoadState('domcontentloaded');
    await this.title.waitFor({ state: 'visible', timeout: 10000 });
  }

  // Success Message
  async waitForSuccessMessage() {
    await this.page.locator('text=系统配置已保存').waitFor({ state: 'visible', timeout: 5000 });
  }
}
