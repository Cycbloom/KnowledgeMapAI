import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // Exclude quarantined (flaky) tests from ALL runs (including test:flaky).
  // To re-run a quarantined test, move it back out of e2e/quarantine/.
  exclude: /quarantine\//,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  // In CI: produce blob reports per shard (merged by merge-reports job) + final HTML.
  // Locally: list + HTML report.
  reporter: process.env.CI
    ? [['list'], ['blob'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  // CI 中只跑 chromium 以减少运行时间；本地可跑全部浏览器
  projects: process.env.CI
    ? [
        {
          name: 'chromium',
          use: { ...devices['Desktop Chrome'] },
        },
      ]
    : [
        {
          name: 'chromium',
          use: { ...devices['Desktop Chrome'] },
        },
        {
          name: 'firefox',
          use: { ...devices['Desktop Firefox'] },
        },
        {
          name: 'webkit',
          use: { ...devices['Desktop Safari'] },
        },
        {
          name: 'Mobile Chrome',
          use: { ...devices['Pixel 5'] },
        },
        {
          name: 'Mobile Safari',
          use: { ...devices['iPhone 12'] },
        },
      ],
  webServer: {
    command: 'npm run dev',
    // 检查 /api/health/system 端点（通过 Vite proxy 转发到 API 服务器），
    // 确保 API 服务器完全就绪后再开始测试。
    // 如果只检查前端 5173 端口，API 服务器可能还没启动，所有测试会超时。
    url: 'http://localhost:5173/api/health/system',
    reuseExistingServer: !process.env.CI,
    timeout: 180 * 1000,
  },
});
