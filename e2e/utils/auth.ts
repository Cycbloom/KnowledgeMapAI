import { Page } from '@playwright/test';

/**
 * 在浏览器上下文中发送携带认证 header 的 API 请求。
 *
 * 使用 page.evaluate + fetch 而非 page.request，确保：
 * 1. 请求通过 Vite dev server 代理到 API 服务器
 * 2. 从 localStorage 读取 Zustand persist 的 token 并注入 Authorization header
 * 3. 请求行为与前端 axios 拦截器一致
 *
 * page.request 不经过 Vite 代理和 axios 拦截器，不会自动携带 token，
 * 会触发 401 AUTH_HEADER_MISSING。
 *
 * 轮询等待 token 出现：Zustand persist 中间件写入 localStorage 是异步的，
 * 可能在 navigateAndWaitForAuth 返回后尚未完成。最多等待 5 秒。
 */
export async function authedRequest(
  page: Page,
  method: 'POST' | 'DELETE' | 'PATCH' | 'GET' | 'PUT',
  url: string,
  data?: unknown,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const result = await page.evaluate(
    async ({ method, url, data }) => {
      // 轮询等待 token 出现（最多 5 秒）
      const waitForToken = async (): Promise<string | null> => {
        const deadline = Date.now() + 5000;
        while (Date.now() < deadline) {
          const raw = localStorage.getItem('km-auth');
          if (raw) {
            try {
              const token = JSON.parse(raw)?.state?.token ?? null;
              if (token) return token;
            } catch {
              // ignore parse error
            }
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        return null;
      };

      const token = await waitForToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(url, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
      });
      const body = await response.json().catch(() => null);
      return { ok: response.ok, status: response.status, body };
    },
    { method, url, data },
  );
  return result;
}

/**
 * 以测试用户身份完成认证。
 *
 * 不再通过 UI 填写登录表单（Login.tsx 的认证表单默认隐藏，且输入框无
 * name 属性）。改为导航到 `/` 触发 App.tsx 的开发模式自动认证
 * （signInWithPassword with test@example.com），然后等待认证 API 请求
 * 返回 200，确认 session 已恢复到 Zustand store。
 */
export async function loginAsTestUser(page: Page) {
  await navigateAndWaitForAuth(page, '/');
}

/**
 * 确保页面已认证。若当前 URL 包含 "login"，则触发自动认证流程。
 */
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
 *
 * 不使用 `networkidle`：应用维持 SSE 长连接（NotificationSubscriber、
 * CacheInvalidationSubscriber），网络永远不空闲，会导致超时。
 * 改用 `domcontentloaded` 确保基础 DOM 就绪，认证状态由 responsePromise 保证。
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

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await responsePromise;
}
