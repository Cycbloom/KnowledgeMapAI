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

/**
 * 等待前端 auth session 恢复完成。
 *
 * 页面导航（page.goto）后 React 应用重新挂载，restoreSession() 异步从
 * Supabase 恢复 session 到 Zustand store。在此之前，组件发出的 API 请求
 * 不携带 Authorization header（401 竞态）。此函数等待任意一个需要认证的
 * API 请求返回 200，确认 session 已恢复后再返回。
 *
 * 使用 Promise.all 模式：在 page.goto 之前设置 waitForResponse，
 * 避免错过已到达的响应。
 */
export async function navigateAndWaitForAuth(
  page: Page,
  url: string,
  timeout = 10000,
): Promise<void> {
  // 在导航前设置 response 监听器，避免错过已到达的响应
  const responsePromise = page
    .waitForResponse(
      async (response) => {
        const reqUrl = response.url();
        if (
          !reqUrl.includes('/api/') ||
          reqUrl.includes('/api/csrf-token') ||
          reqUrl.includes('/api/health')
        ) {
          return false;
        }
        return response.status() === 200;
      },
      { timeout },
    )
    .catch(() => {
      // 超时不阻塞测试：session 可能已通过其他方式恢复
    });

  await page.goto(url);
  await responsePromise;
  await page.waitForLoadState('networkidle');
}


