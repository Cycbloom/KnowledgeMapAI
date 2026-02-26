export const testConfig = {
  baseURL: 'http://localhost:5173',
  timeout: 30000,
  navigationTimeout: 60000,
};

export const testUser = {
  email: process.env.TEST_USER_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PASSWORD || 'test123456',
};

export const selectors = {
  loginPage: {
    emailInput: 'input[name="email"]',
    passwordInput: 'input[name="password"]',
    loginButton: 'button[type="submit"]',
    registerLink: 'a[href="/register"]',
    errorMessage: '.bg-red-100, .dark\\:bg-red-900\\/30',
    themeButton: 'button[title*="切换"]',
  },
  registerPage: {
    nameInput: 'input[name="name"]',
    emailInput: 'input[name="email"]',
    passwordInput: 'input[name="password"]',
    registerButton: 'button[type="submit"]',
    loginLink: 'a[href="/login"]',
    errorMessage: '.bg-red-100, .dark\\:bg-red-900\\/30',
    themeButton: 'button[title*="切换"]',
  },
  dashboard: {
    title: /dashboard/i,
    searchInput: 'input[placeholder*="搜索"]',
    newGraphButton: 'button:has-text("新建图谱")',
    aiGenerateButton: 'button:has-text("AI 生成")',
    graphCards: '[class*="group relative rounded-2xl"]',
    themeButton: 'button[title*="切换"]',
    emptyState: 'text=开始您的知识之旅',
    graphTitleInput: 'input[placeholder*="例如"]',
    graphDescriptionInput: 'textarea[placeholder*="描述"]',
    confirmCreateButton: 'button:has-text("立即创建")',
    cancelButton: 'button:has-text("取消")',
  },
};

export async function login(page: any, email: string, password: string) {
  await page.goto('/');
  await page.fill(selectors.loginPage.emailInput, email);
  await page.fill(selectors.loginPage.passwordInput, password);
  await page.click(selectors.loginPage.loginButton);
  await page.waitForURL(/\/dashboard/);
}

export async function waitForElement(page: any, selector: string, timeout: number = testConfig.timeout) {
  await page.waitForSelector(selector, { timeout });
}
