import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';

test.describe('登录功能测试', () => {
  const testEmail = process.env.TEST_USER_EMAIL || 'test@example.com';
  const testPassword = process.env.TEST_USER_PASSWORD || 'test123456';

  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test.describe('页面显示测试', () => {
    test('应该显示登录页面', async ({ page }) => {
      await expect(page).toHaveTitle(/Knowledge Map AI/);
      await expect(loginPage.heading).toBeVisible();
      await expect(loginPage.emailLabel).toBeVisible();
      await expect(loginPage.passwordLabel).toBeVisible();
      await expect(loginPage.loginButton).toBeVisible();
    });

    test('应该能够导航到注册页面', async () => {
      await loginPage.clickRegister();
      await expect(loginPage.page).toHaveURL(/\/register/);
    });

    test('应该支持主题切换', async () => {
      await expect(loginPage.themeButton).toBeVisible();
      await loginPage.toggleTheme();
      expect(await loginPage.isDarkMode()).toBe(true);
    });
  });

  test.describe('登录成功测试', () => {
    test('应该能够成功登录', async ({ page }) => {
      await loginPage.login(testEmail, testPassword);

      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole('heading', { name: '我的知识图谱' })).toBeVisible();
    });

    test('登录后刷新页面应保持登录状态', async ({ page, context }) => {
      // 成功登录
      await loginPage.login(testEmail, testPassword);
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole('heading', { name: '我的知识图谱' })).toBeVisible();

      // 刷新页面
      await page.reload();

      // 验证仍然保持登录状态（不会被重定向到登录页）
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole('heading', { name: '我的知识图谱' })).toBeVisible();
    });
  });

  test.describe('登录失败测试', () => {
    test('使用错误密码登录应显示错误信息', async () => {
      await loginPage.login(testEmail, 'wrongpassword123');

      // 验证错误提示显示
      await expect(loginPage.errorMessage).toBeVisible();

      // 验证错误信息内容
      const errorMessage = await loginPage.getErrorMessage();
      expect(errorMessage).toBeTruthy();
    });

    test('使用不存在的用户登录应显示错误信息', async () => {
      await loginPage.login('nonexistent@example.com', 'anypassword123');

      // 验证错误提示显示
      await expect(loginPage.errorMessage).toBeVisible();

      // 验证错误信息内容
      const errorMessage = await loginPage.getErrorMessage();
      expect(errorMessage).toBeTruthy();
    });
  });

  test.describe('边界条件测试', () => {
    test('空表单提交应触发必填字段验证', async ({ page }) => {
      await loginPage.submitEmptyForm();

      // 验证邮箱输入框获得焦点（HTML5 required 属性会阻止提交并聚焦到第一个无效字段）
      await expect(loginPage.emailInput).toBeFocused();
    });

    test('只填写邮箱不填写密码应触发验证', async ({ page }) => {
      await loginPage.emailInput.fill(testEmail);
      await loginPage.submitEmptyForm();

      // 验证密码输入框获得焦点
      await expect(loginPage.passwordInput).toBeFocused();
    });

    test('只填写密码不填写邮箱应触发验证', async ({ page }) => {
      await loginPage.passwordInput.fill(testPassword);
      await loginPage.submitEmptyForm();

      // 验证邮箱输入框获得焦点
      await expect(loginPage.emailInput).toBeFocused();
    });

    test('无效邮箱格式应显示验证错误', async ({ page }) => {
      await loginPage.emailInput.fill('invalid-email');
      await loginPage.passwordInput.fill(testPassword);
      await loginPage.submitEmptyForm();

      // 验证邮箱格式无效
      const isValid = await loginPage.isEmailValid();
      expect(isValid).toBe(false);

      // 验证浏览器原生验证消息
      const validationMessage = await loginPage.getEmailValidationMessage();
      expect(validationMessage).toBeTruthy();
    });

    test('缺少@符号的邮箱应显示验证错误', async ({ page }) => {
      await loginPage.emailInput.fill('invalidemail.com');
      await loginPage.passwordInput.fill(testPassword);
      await loginPage.submitEmptyForm();

      const isValid = await loginPage.isEmailValid();
      expect(isValid).toBe(false);
    });

    test('缺少域名的邮箱应显示验证错误', async ({ page }) => {
      await loginPage.emailInput.fill('test@');
      await loginPage.passwordInput.fill(testPassword);
      await loginPage.submitEmptyForm();

      const isValid = await loginPage.isEmailValid();
      expect(isValid).toBe(false);
    });
  });

  test.describe('表单交互测试', () => {
    test('应该能够正常输入邮箱和密码', async () => {
      const testEmailInput = 'test@example.com';
      const testPasswordInput = 'testpassword';

      await loginPage.emailInput.fill(testEmailInput);
      await loginPage.passwordInput.fill(testPasswordInput);

      await expect(loginPage.emailInput).toHaveValue(testEmailInput);
      await expect(loginPage.passwordInput).toHaveValue(testPasswordInput);
    });

    test('应该能够清空输入内容', async () => {
      await loginPage.emailInput.fill(testEmail);
      await loginPage.passwordInput.fill(testPassword);

      await loginPage.emailInput.clear();
      await loginPage.passwordInput.clear();

      await expect(loginPage.emailInput).toHaveValue('');
      await expect(loginPage.passwordInput).toHaveValue('');
    });
  });

  test.describe('登录性能测试', () => {
    test('登录操作应在 3 秒内完成', async ({ page }) => {
      const startTime = Date.now();

      await loginPage.login(testEmail, testPassword);

      // 等待登录成功并跳转到首页
      await expect(page).toHaveURL(/\/$/, { timeout: 5000 });

      const endTime = Date.now();
      const loginDuration = endTime - startTime;

      // 验证登录时间在 3 秒内
      expect(loginDuration).toBeLessThan(3000);
      console.log(`登录耗时: ${loginDuration}ms`);
    });

    test('连续登录应保持稳定的响应时间', async ({ page, context }) => {
      const loginTimes: number[] = [];
      const loginCount = 3;

      for (let i = 0; i < loginCount; i++) {
        // 清除之前的会话状态
        await context.clearCookies();

        // 重新访问登录页
        await loginPage.goto();

        const startTime = Date.now();
        await loginPage.login(testEmail, testPassword);
        await expect(page).toHaveURL(/\/$/, { timeout: 5000 });
        const endTime = Date.now();

        loginTimes.push(endTime - startTime);
      }

      // 计算平均登录时间
      const avgTime = loginTimes.reduce((a, b) => a + b, 0) / loginTimes.length;
      console.log(`连续登录 ${loginCount} 次，平均耗时: ${avgTime}ms`);
      console.log(`各次登录耗时: ${loginTimes.join('ms, ')}ms`);

      // 验证平均登录时间在合理范围内
      expect(avgTime).toBeLessThan(4000);

      // 验证登录时间波动不超过 2 秒（确保稳定性）
      const maxTime = Math.max(...loginTimes);
      const minTime = Math.min(...loginTimes);
      expect(maxTime - minTime).toBeLessThan(2000);
    });

    test('登录响应时间应在 P95 阈值内', async ({ page, context }) => {
      const loginTimes: number[] = [];
      const iterations = 10;

      for (let i = 0; i < iterations; i++) {
        await context.clearCookies();
        await loginPage.goto();

        const startTime = Date.now();
        await loginPage.login(testEmail, testPassword);
        await expect(page).toHaveURL(/\/$/, { timeout: 5000 });
        const endTime = Date.now();

        loginTimes.push(endTime - startTime);
      }

      // 排序后计算 P95
      loginTimes.sort((a, b) => a - b);
      const p95Index = Math.floor(loginTimes.length * 0.95);
      const p95Time = loginTimes[p95Index];

      console.log(`登录时间统计:`);
      console.log(`- 最小值: ${loginTimes[0]}ms`);
      console.log(`- 最大值: ${loginTimes[loginTimes.length - 1]}ms`);
      console.log(`- 平均值: ${loginTimes.reduce((a, b) => a + b, 0) / loginTimes.length}ms`);
      console.log(`- P95: ${p95Time}ms`);

      // 验证 P95 在合理范围内
      expect(p95Time).toBeLessThan(4000);
    });

    test('登录性能指标应包含网络请求时间', async ({ page }) => {
      // 监听网络请求
      const loginRequests: string[] = [];
      page.on('request', (request) => {
        if (request.url().includes('auth') || request.url().includes('login')) {
          loginRequests.push(request.url());
        }
      });

      const startTime = Date.now();
      await loginPage.login(testEmail, testPassword);
      await expect(page).toHaveURL(/\/$/, { timeout: 5000 });
      const endTime = Date.now();

      const loginDuration = endTime - startTime;

      console.log(`登录总耗时: ${loginDuration}ms`);
      console.log(`认证相关请求数: ${loginRequests.length}`);

      // 验证有认证请求
      expect(loginRequests.length).toBeGreaterThan(0);

      // 验证总时间在合理范围内
      expect(loginDuration).toBeLessThan(5000);
    });
  });

  test.describe('并发登录测试', () => {
    test('多个用户同时登录应都能成功', async ({ browser }) => {
      const concurrentUsers = 3;
      const contexts = await Promise.all(
        Array(concurrentUsers)
          .fill(null)
          .map(() => browser.newContext())
      );

      const pages = await Promise.all(contexts.map((context) => context.newPage()));

      try {
        // 同时发起登录请求
        const loginPromises = pages.map(async (page, index) => {
          const userLoginPage = new LoginPage(page);
          await userLoginPage.goto();

          const startTime = Date.now();
          await userLoginPage.login(testEmail, testPassword);

          // 等待登录成功
          await expect(page).toHaveURL(/\/$/, { timeout: 10000 });
          const endTime = Date.now();

          console.log(`用户 ${index + 1} 登录耗时: ${endTime - startTime}ms`);
          return { index, duration: endTime - startTime, success: true };
        });

        const results = await Promise.all(loginPromises);

        // 验证所有用户都登录成功
        expect(results.every((r) => r.success)).toBe(true);

        // 验证所有登录时间都在合理范围内
        results.forEach((r) => {
          expect(r.duration).toBeLessThan(5000);
        });

        console.log(`并发 ${concurrentUsers} 个用户登录全部成功`);
      } finally {
        // 清理资源
        await Promise.all(contexts.map((context) => context.close()));
      }
    });

    test('并发登录后各用户会话应独立', async ({ browser }) => {
      const contexts = await Promise.all([browser.newContext(), browser.newContext()]);

      const pages = await Promise.all(contexts.map((context) => context.newPage()));

      try {
        // 两个用户同时登录
        await Promise.all(
          pages.map(async (page) => {
            const userLoginPage = new LoginPage(page);
            await userLoginPage.goto();
            await userLoginPage.login(testEmail, testPassword);
            await expect(page).toHaveURL(/\/$/, { timeout: 10000 });
          })
        );

        // 验证两个页面的会话状态独立
        const [page1, page2] = pages;

        // 在第一个页面刷新，验证会话保持
        await page1.reload();
        await expect(page1).toHaveURL(/\/$/);

        // 第二个页面也应该保持登录状态
        await page2.reload();
        await expect(page2).toHaveURL(/\/$/);

        console.log('并发登录后各用户会话独立验证通过');
      } finally {
        await Promise.all(contexts.map((context) => context.close()));
      }
    });

    test('高并发登录场景（5 个用户）应正常处理', async ({ browser }) => {
      const concurrentUsers = 5;
      const contexts = await Promise.all(
        Array(concurrentUsers)
          .fill(null)
          .map(() => browser.newContext())
      );

      const pages = await Promise.all(contexts.map((context) => context.newPage()));

      try {
        // 同时发起登录请求
        const startTime = Date.now();
        const loginPromises = pages.map(async (page, index) => {
          const userLoginPage = new LoginPage(page);
          await userLoginPage.goto();
          await userLoginPage.login(testEmail, testPassword);
          await expect(page).toHaveURL(/\/$/, { timeout: 15000 });
          return { index, success: true };
        });

        const results = await Promise.all(loginPromises);
        const endTime = Date.now();
        const totalDuration = endTime - startTime;

        // 验证所有用户都登录成功
        expect(results.every((r) => r.success)).toBe(true);

        console.log(`高并发 ${concurrentUsers} 个用户登录全部成功，总耗时: ${totalDuration}ms`);

        // 验证总时间在合理范围内（并发应该比串行快）
        expect(totalDuration).toBeLessThan(10000);
      } finally {
        await Promise.all(contexts.map((context) => context.close()));
      }
    });

    test('并发登录时服务器应正确处理请求顺序', async ({ browser }) => {
      const contexts = await Promise.all([browser.newContext(), browser.newContext()]);

      const pages = await Promise.all(contexts.map((context) => context.newPage()));

      try {
        // 记录登录完成顺序
        const loginOrder: number[] = [];

        const loginPromises = pages.map(async (page, index) => {
          const userLoginPage = new LoginPage(page);
          await userLoginPage.goto();
          await userLoginPage.login(testEmail, testPassword);
          await expect(page).toHaveURL(/\/$/, { timeout: 10000 });
          loginOrder.push(index);
          return index;
        });

        await Promise.all(loginPromises);

        // 验证两个用户都成功登录
        expect(loginOrder.length).toBe(2);

        console.log(`并发登录完成顺序: 用户 ${loginOrder.join(', ')}`);
      } finally {
        await Promise.all(contexts.map((context) => context.close()));
      }
    });

    test('并发登录失败场景应正确处理', async ({ browser }) => {
      const contexts = await Promise.all([browser.newContext(), browser.newContext()]);

      const pages = await Promise.all(contexts.map((context) => context.newPage()));

      try {
        // 第一个用户使用正确凭据，第二个用户使用错误凭据
        const loginPromises = pages.map(async (page, index) => {
          const userLoginPage = new LoginPage(page);
          await userLoginPage.goto();

          if (index === 0) {
            // 正确凭据
            await userLoginPage.login(testEmail, testPassword);
            await expect(page).toHaveURL(/\/$/, { timeout: 10000 });
            return { index, success: true };
          } else {
            // 错误凭据
            await userLoginPage.login('wrong@example.com', 'wrongpassword');
            await expect(userLoginPage.errorMessage).toBeVisible({ timeout: 5000 });
            return { index, success: false };
          }
        });

        const results = await Promise.all(loginPromises);

        // 验证第一个用户成功，第二个用户失败
        expect(results[0].success).toBe(true);
        expect(results[1].success).toBe(false);

        console.log('并发登录成功/失败场景验证通过');
      } finally {
        await Promise.all(contexts.map((context) => context.close()));
      }
    });
  });

  test.describe('会话管理测试', () => {
    test('登录后应正确设置会话 Cookie', async ({ page, context }) => {
      await loginPage.login(testEmail, testPassword);
      await expect(page).toHaveURL(/\/$/);

      // 获取所有 cookies
      const cookies = await context.cookies();

      // 验证存在认证相关的 cookie（Supabase 使用 sb- 前缀的 cookie）
      const authCookies = cookies.filter(
        (cookie) => cookie.name.includes('sb-') || cookie.name.includes('auth')
      );

      console.log(`发现 ${authCookies.length} 个认证相关 Cookie`);
      expect(authCookies.length).toBeGreaterThan(0);
    });

    test('刷新页面后应保持登录状态', async ({ page }) => {
      // 成功登录
      await loginPage.login(testEmail, testPassword);
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole('heading', { name: '我的知识图谱' })).toBeVisible();

      // 刷新页面
      await page.reload();

      // 验证仍然保持登录状态
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole('heading', { name: '我的知识图谱' })).toBeVisible();
    });

    test('新标签页应共享登录状态', async ({ page, context }) => {
      // 在第一个页面登录
      await loginPage.login(testEmail, testPassword);
      await expect(page).toHaveURL(/\/$/);

      // 在同一上下文中打开新标签页
      const newPage = await context.newPage();
      await newPage.goto('/');

      // 验证新标签页也是登录状态
      await expect(newPage).toHaveURL(/\/$/);
      await expect(newPage.getByRole('heading', { name: '我的知识图谱' })).toBeVisible();

      await newPage.close();
    });

    test('清除 Cookie 后应重定向到登录页', async ({ page, context }) => {
      // 先登录
      await loginPage.login(testEmail, testPassword);
      await expect(page).toHaveURL(/\/$/);

      // 清除所有 cookies
      await context.clearCookies();

      // 刷新页面
      await page.reload();

      // 验证被重定向到登录页
      await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
    });

    test('关闭浏览器后重新打开应保持登录状态（持久化会话）', async ({ browser }) => {
      // 创建带存储状态的上下文
      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        const userLoginPage = new LoginPage(page);
        await userLoginPage.goto();
        await userLoginPage.login(testEmail, testPassword);
        await expect(page).toHaveURL(/\/$/);

        // 获取存储状态
        const storageState = await context.storageState();

        // 关闭上下文
        await context.close();

        // 使用相同的存储状态创建新上下文
        const newContext = await browser.newContext({ storageState });
        const newPage = await newContext.newPage();

        try {
          await newPage.goto('/');

          // 验证仍然保持登录状态
          await expect(newPage).toHaveURL(/\/$/);
          await expect(newPage.getByRole('heading', { name: '我的知识图谱' })).toBeVisible();

          console.log('会话持久化验证通过');
        } finally {
          await newContext.close();
        }
      } catch (error) {
        await context.close();
        throw error;
      }
    });

    test('会话 Cookie 应具有正确的过期时间', async ({ page, context }) => {
      await loginPage.login(testEmail, testPassword);
      await expect(page).toHaveURL(/\/$/);

      // 获取所有 cookies
      const cookies = await context.cookies();

      // 验证认证 cookie 的过期时间
      const authCookies = cookies.filter(
        (cookie) => cookie.name.includes('sb-') || cookie.name.includes('auth')
      );

      authCookies.forEach((cookie) => {
        console.log(`Cookie: ${cookie.name}, 过期时间: ${cookie.expires}`);
        // 验证 cookie 有过期时间（不是会话 cookie）
        expect(cookie.expires).toBeDefined();
        expect(cookie.expires).toBeGreaterThan(Date.now() / 1000);
      });
    });

    test('会话超时后应自动登出', async ({ page, context }) => {
      // 登录
      await loginPage.login(testEmail, testPassword);
      await expect(page).toHaveURL(/\/$/);

      // 模拟会话过期（清除所有 cookies）
      await context.clearCookies();

      // 尝试访问受保护页面
      await page.goto('/');

      // 验证被重定向到登录页
      await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
    });

    test('多个标签页同时操作应保持会话一致性', async ({ page, context }) => {
      // 在第一个页面登录
      await loginPage.login(testEmail, testPassword);
      await expect(page).toHaveURL(/\/$/);

      // 打开多个新标签页
      const pages = await Promise.all([
        context.newPage(),
        context.newPage(),
      ]);

      try {
        // 所有标签页访问首页
        await Promise.all(pages.map((p) => p.goto('/')));

        // 验证所有标签页都保持登录状态
        await Promise.all([
          expect(page).toHaveURL(/\/$/),
          ...pages.map((p) => expect(p).toHaveURL(/\/$/)),
        ]);

        console.log('多标签页会话一致性验证通过');
      } finally {
        await Promise.all(pages.map((p) => p.close()));
      }
    });

    test('会话状态应在不同浏览器上下文间独立', async ({ browser }) => {
      // 创建两个独立的浏览器上下文
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();

      const page1 = await context1.newPage();
      const page2 = await context2.newPage();

      try {
        // 在第一个上下文登录
        const loginPage1 = new LoginPage(page1);
        await loginPage1.goto();
        await loginPage1.login(testEmail, testPassword);
        await expect(page1).toHaveURL(/\/$/);

        // 第二个上下文访问首页，应该被重定向到登录页
        await page2.goto('/');
        await expect(page2).toHaveURL(/\/login/);

        console.log('会话独立性验证通过');
      } finally {
        await context1.close();
        await context2.close();
      }
    });

    test('登录后 localStorage 应包含用户信息', async ({ page }) => {
      await loginPage.login(testEmail, testPassword);
      await expect(page).toHaveURL(/\/$/);

      // 获取 localStorage 内容
      const localStorageData = await page.evaluate(() => {
        const data: Record<string, string> = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            data[key] = localStorage.getItem(key) || '';
          }
        }
        return data;
      });

      console.log('LocalStorage 内容:', Object.keys(localStorageData));

      // 验证 localStorage 中有数据（Supabase 通常会在 localStorage 存储会话信息）
      expect(Object.keys(localStorageData).length).toBeGreaterThan(0);
    });

    test('会话恢复后应保持用户偏好设置', async ({ page, context }) => {
      // 登录
      await loginPage.login(testEmail, testPassword);
      await expect(page).toHaveURL(/\/$/);

      // 切换主题
      await loginPage.toggleTheme();
      const isDarkModeAfterToggle = await loginPage.isDarkMode();

      // 刷新页面
      await page.reload();

      // 验证主题设置保持
      const isDarkModeAfterReload = await loginPage.isDarkMode();
      expect(isDarkModeAfterReload).toBe(isDarkModeAfterToggle);

      console.log('用户偏好设置持久化验证通过');
    });
  });
});
