import { Page, Locator } from '@playwright/test';

export class RegisterPage {
  readonly page: Page;
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly registerButton: Locator;
  readonly loginLink: Locator;
  readonly errorMessage: Locator;
  readonly themeButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.nameInput = page.locator('input[name="name"]');
    this.emailInput = page.locator('input[name="email"]');
    this.passwordInput = page.locator('input[name="password"]');
    this.registerButton = page.locator('button[type="submit"]');
    this.loginLink = page.locator('a[href="/login"]');
    this.errorMessage = page.locator('.bg-red-100, .dark\\:bg-red-900\\/30');
    this.themeButton = page.locator('button[title*="切换"]');
  }

  async goto() {
    await this.page.goto('/register');
  }

  async register(name: string, email: string, password: string) {
    await this.nameInput.fill(name);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.registerButton.click();
  }

  async getErrorMessage() {
    return await this.errorMessage.textContent();
  }

  async clickLogin() {
    await this.loginLink.click();
  }

  async toggleTheme() {
    await this.themeButton.click();
  }

  async isDarkMode() {
    return await this.page.locator('.dark').count() > 0;
  }
}
