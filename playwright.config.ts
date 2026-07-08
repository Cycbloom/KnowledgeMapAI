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
  // 分别启动前端 (Vite) 和 API 服务器，避免 concurrently 输出被吞掉。
  // API 用 server:start (tsx 直接运行) 而非 server:dev (nodemon)，
  // 因为 CI 不需要文件监视，且 nodemon 会缓冲输出导致日志不可见。
  webServer: [
    {
      command: 'npm run server:start',
      url: 'http://localhost:3001/api/health/system',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'npm run client:dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 60 * 1000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
