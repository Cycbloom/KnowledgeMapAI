import { defineConfig, devices } from '@playwright/test';

// Windows 上 Hyper-V 会保留动态端口范围（常见如 5141-5240），可能覆盖默认的 5173，
// 导致 Vite 启动时报 EACCES。允许通过 E2E_PORT 环境变量覆盖（本地用 5341，CI 仍用 5173）。
const e2ePort = process.env.E2E_PORT || '5173';
const e2eBaseUrl = `http://localhost:${e2ePort}`;
// API 服务器端口同样可能被 Hyper-V 保留（如 2996-3095 覆盖 3001）。
const apiPort = process.env.API_PORT || '3001';

export default defineConfig({
  testDir: './e2e',
  // Exclude quarantined (flaky) tests from ALL runs (including test:flaky).
  // To re-run a quarantined test, move it back out of e2e/quarantine/.
  exclude: /quarantine\//,
  // 整套测试只 provision 一次专属用户，所有 context 复用登录状态
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // CI 固定 1 worker；本地默认 4 worker（避免 Vite dev server 在高并行下
  // transform 积压导致 page.goto 超时）。可通过 E2E_WORKERS 环境变量覆盖。
  workers: process.env.CI
    ? 1
    : process.env.E2E_WORKERS
      ? Number.parseInt(process.env.E2E_WORKERS, 10)
      : 4,
  // 统一使用 120s 超时。全集并行运行时 Vite dev server 可能因 transform 积压
  // 导致 page.goto 的 domcontentloaded 延迟，60s 不足以完成初始 HTML 加载。
  timeout: 120 * 1000,
  // In CI: produce blob reports per shard (merged by merge-reports job) + final HTML.
  // Locally: list + HTML report.
  reporter: process.env.CI
    ? [['list'], ['blob'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: e2eBaseUrl,
    storageState: 'test-results/.e2e-auth-state.json',
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
      url: `http://localhost:${apiPort}/api/health/system`,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...process.env, SKIP_DUPLICATE_TOPIC_CHECK: 'true' },
    },
    {
      command: e2ePort === '5173' ? 'npm run client:dev' : `npx vite --port ${e2ePort} --strictPort`,
      url: e2eBaseUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 60 * 1000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...process.env, SKIP_DUPLICATE_TOPIC_CHECK: 'true' },
    },
  ],
});
