import { Page } from '@playwright/test';

export async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(graph|home)?$/, { timeout: 15000 });
}

export async function loginAsTestUser(page: Page) {
  await login(page, 'test@example.com', 'test123456');
}

export async function ensureAuthenticated(page: Page) {
  const currentUrl = page.url();
  if (currentUrl.includes('login')) {
    await loginAsTestUser(page);
  }
}
