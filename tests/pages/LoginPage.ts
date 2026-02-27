import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly registerLink: Locator;
  readonly errorMessage: Locator;
  readonly themeButton: Locator;
  readonly heading: Locator;
  readonly emailLabel: Locator;
  readonly passwordLabel: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('input[name="email"]');
    this.passwordInput = page.locator('input[name="password"]');
    this.loginButton = page.locator('button[type="submit"]');
    this.registerLink = page.locator('a[href="/register"]');
    this.errorMessage = page.locator('.bg-red-100, .dark\\:bg-red-900\\/30');
    this.themeButton = page.locator('button[title*="切换"]');
    this.heading = page.getByRole('heading', { name: '登录' });
    this.emailLabel = page.getByText('邮箱');
    this.passwordLabel = page.getByText('密码');
  }

  async goto() {
    await this.page.goto('/');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  async submitEmptyForm() {
    await this.loginButton.click();
  }

  async getErrorMessage() {
    return await this.errorMessage.textContent();
  }

  async hasErrorMessage() {
    return await this.errorMessage.isVisible();
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

  async isEmailInputFocused() {
    return await this.emailInput.evaluate((el: HTMLInputElement) => document.activeElement === el);
  }

  async isPasswordInputFocused() {
    return await this.passwordInput.evaluate((el: HTMLInputElement) => document.activeElement === el);
  }

  async getEmailValidationMessage() {
    return await this.emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);
  }

  async isEmailValid() {
    return await this.emailInput.evaluate((el: HTMLInputElement) => el.checkValidity());
  }
}
