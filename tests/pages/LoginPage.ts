import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly registerLink: Locator;
  readonly errorMessage: Locator;
  readonly themeButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('input[name="email"]');
    this.passwordInput = page.locator('input[name="password"]');
    this.loginButton = page.locator('button[type="submit"]');
    this.registerLink = page.locator('a[href="/register"]');
    this.errorMessage = page.locator('.bg-red-100, .dark\\:bg-red-900\\/30');
    this.themeButton = page.locator('button[title*="切换"]');
  }

  async goto() {
    await this.page.goto('/');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  async getErrorMessage() {
    return await this.errorMessage.textContent();
  }

  async clickRegister() {
    await this.registerLink.click();
  }

  async toggleTheme() {
    await this.themeButton.click();
  }

  async isDarkMode() {
    return await this.page.locator('.dark').count() > 0;
  }
}
