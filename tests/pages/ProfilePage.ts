import { Locator, Page, Download } from '@playwright/test';

export class ProfilePage {
  readonly page: Page;
  readonly title: Locator;
  readonly userName: Locator;
  readonly userEmail: Locator;
  readonly accountInfoSection: Locator;
  readonly logoutButton: Locator;
  readonly settingsButton: Locator;
  readonly promptSettingsButton: Locator;
  readonly exportBackupButton: Locator;
  readonly importBackupButton: Locator;

  // 数据备份相关
  readonly backupSection: Locator;
  readonly fileInput: Locator;
  readonly importModeReplace: Locator;
  readonly importModeMerge: Locator;
  readonly createSnapshotButton: Locator;
  readonly refreshSnapshotsButton: Locator;
  readonly snapshotsList: Locator;
  readonly snapshotItems: Locator;

  // 安全设置相关
  readonly securitySection: Locator;
  readonly changePasswordButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // 页面标题
    this.title = page.locator('h1:has-text("个人中心")');

    // 账号信息区域 - 基于实际页面结构
    this.accountInfoSection = page.locator('h2:has-text("账号信息")').locator('..');

    // 用户昵称和邮箱 - 定位到包含标签的容器，然后找到值
    this.userName = page.locator('div:has(> div:text("昵称")) > div.font-semibold');
    this.userEmail = page.locator('div:has(> div:text("邮箱")) > div.font-semibold');

    // 功能按钮
    this.logoutButton = page.locator('button:has-text("退出登录")').filter({ has: page.locator('svg') }).last();
    this.settingsButton = page.locator('button:has-text("前往设置")');
    this.promptSettingsButton = page.locator('button:has-text("管理提示词")');

    // 数据备份区域
    this.backupSection = page.locator('h2:has-text("数据备份")').locator('..');
    this.exportBackupButton = page.locator('button:has-text("导出备份")');
    this.importBackupButton = page.locator('button:has-text("导入备份")');
    this.fileInput = page.locator('input[type="file"][accept=".json"]');
    this.importModeReplace = page.locator('input[type="radio"][value="replace"]');
    this.importModeMerge = page.locator('input[type="radio"][value="merge"]');
    this.createSnapshotButton = page.locator('button:has-text("创建快照")');
    this.refreshSnapshotsButton = page.locator('button:has-text("创建快照")').locator('..').locator('button').nth(0);
    this.snapshotsList = page.locator('div:has(> span:text("快照列表"))').locator('..');
    this.snapshotItems = page.locator('[class*="flex items-center justify-between"]').filter({ has: page.locator('button[title="恢复此快照"]') });

    // 安全设置区域（如果存在）
    this.securitySection = page.locator('h2:has-text("安全设置")').locator('..');
    this.changePasswordButton = page.locator('button:has-text("修改密码")');
  }

  async goto() {
    await this.page.goto('/profile');
    // 使用 load 代替 networkidle 以避免超时问题
    await this.page.waitForLoadState('load');
    // 等待页面主要内容加载
    await this.title.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  }

  async getUserName() {
    return await this.userName.textContent();
  }

  async getUserEmail() {
    return await this.userEmail.textContent();
  }

  async clickLogout() {
    await this.logoutButton.click();
  }

  async clickSettings() {
    await this.settingsButton.click();
  }

  async clickPromptSettings() {
    await this.promptSettingsButton.click();
  }

  async clickExportBackup() {
    await this.exportBackupButton.click();
  }

  async clickImportBackup() {
    await this.importBackupButton.click();
  }

  // 数据备份相关方法
  async exportBackup(): Promise<Download> {
    const [download] = await Promise.all([
      this.page.waitForEvent('download'),
      this.exportBackupButton.click(),
    ]);
    return download;
  }

  async setImportMode(mode: 'replace' | 'merge') {
    const radio = mode === 'replace' ? this.importModeReplace : this.importModeMerge;
    await radio.check();
  }

  async importBackupFile(filePath: string) {
    await this.fileInput.setInputFiles(filePath);
    // 等待导入完成
    await this.page.waitForTimeout(1000);
  }

  async createSnapshot() {
    await this.createSnapshotButton.click();
    // 等待创建完成
    await this.page.waitForTimeout(1000);
  }

  async refreshSnapshots() {
    await this.refreshSnapshotsButton.click();
    // 等待刷新完成
    await this.page.waitForTimeout(1000);
  }

  async getSnapshotCount(): Promise<number> {
    return await this.snapshotItems.count();
  }

  async restoreSnapshot(index: number = 0) {
    const snapshot = this.snapshotItems.nth(index);
    const restoreButton = snapshot.locator('button[title="恢复此快照"]');
    
    // 监听对话框并确认
    this.page.once('dialog', async dialog => {
      await dialog.accept();
    });
    
    await restoreButton.click();
    await this.page.waitForTimeout(1000);
  }

  async deleteSnapshot(index: number = 0) {
    const snapshot = this.snapshotItems.nth(index);
    const deleteButton = snapshot.locator('button[title="删除此快照"]');
    
    // 监听对话框并确认
    this.page.once('dialog', async dialog => {
      await dialog.accept();
    });
    
    await deleteButton.click();
    await this.page.waitForTimeout(500);
  }

  // 安全设置相关方法
  async clickChangePassword() {
    await this.changePasswordButton.click();
  }

  // 获取成功消息
  async waitForSuccessMessage(): Promise<string | null> {
    const successMessage = this.page.locator('[class*="bg-green"], [class*="success"]').first();
    await successMessage.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null);
    return await successMessage.textContent().catch(() => null);
  }

  // 获取错误消息
  async waitForErrorMessage(): Promise<string | null> {
    const errorMessage = this.page.locator('[class*="bg-red"], [class*="error"]').first();
    await errorMessage.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null);
    return await errorMessage.textContent().catch(() => null);
  }
}
