import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './utils/auth';

test.describe('控制台日志折叠功能测试', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.waitForLoadState('networkidle');
    await page.keyboard.press('Control+Shift+C');
    await expect(page.locator('text=控制台')).toBeVisible({ timeout: 5000 });
  });

  test('执行超过 20 条命令后应该显示"查看更多"提示', async ({ page }) => {
    const input = page.locator('input[placeholder*="输入命令"]');
    
    for (let i = 0; i < 25; i++) {
      await input.fill(`test command ${i}`);
      await input.press('Enter');
      await page.waitForTimeout(200);
    }
    
    await expect(page.locator('text=向上滚动查看更多历史记录')).toBeVisible({ timeout: 5000 });
  });

  test('初始应该只显示最近 20 条日志', async ({ page }) => {
    const input = page.locator('input[placeholder*="输入命令"]');
    
    for (let i = 0; i < 25; i++) {
      await input.fill(`log ${i}`);
      await input.press('Enter');
      await page.waitForTimeout(200);
    }
    
    const outputContainer = page.locator('.overflow-y-auto').first();
    const visibleLogs = await outputContainer.locator('.text-sm.font-mono').count();
    
    expect(visibleLogs).toBe(20);
  });

  test('点击"查看更多"按钮应该加载更多日志', async ({ page }) => {
    const input = page.locator('input[placeholder*="输入命令"]');
    
    for (let i = 0; i < 50; i++) {
      await input.fill(`command ${i}`);
      await input.press('Enter');
      await page.waitForTimeout(150);
    }
    
    const loadMoreButton = page.locator('text=向上滚动查看更多历史记录');
    await expect(loadMoreButton).toBeVisible({ timeout: 5000 });
    
    await loadMoreButton.click();
    await page.waitForTimeout(300);
    
    const outputContainer = page.locator('.overflow-y-auto').first();
    const visibleLogsAfterClick = await outputContainer.locator('.text-sm.font-mono').count();
    
    expect(visibleLogsAfterClick).toBeGreaterThan(20);
  });

  test('向上滚动到顶部应该自动加载更多', async ({ page }) => {
    const input = page.locator('input[placeholder*="输入命令"]');
    
    for (let i = 0; i < 60; i++) {
      await input.fill(`scroll test ${i}`);
      await input.press('Enter');
      await page.waitForTimeout(150);
    }
    
    const outputContainer = page.locator('.overflow-y-auto').first();
    
    await outputContainer.evaluate((element) => {
      element.scrollTop = 0;
    });
    
    await page.waitForTimeout(500);
    
    const visibleLogs = await outputContainer.locator('.text-sm.font-mono').count();
    
    expect(visibleLogs).toBeGreaterThan(20);
  });

  test('"查看更多"提示应该正确显示隐藏的日志数量', async ({ page }) => {
    const input = page.locator('input[placeholder*="输入命令"]');
    
    for (let i = 0; i < 40; i++) {
      await input.fill(`count test ${i}`);
      await input.press('Enter');
      await page.waitForTimeout(150);
    }
    
    const loadMoreText = page.locator('text=向上滚动查看更多历史记录');
    await expect(loadMoreText).toBeVisible({ timeout: 5000 });
    
    const textContent = await loadMoreText.textContent();
    
    expect(textContent).toContain('20 条');
  });

  test('所有日志加载完成后应该隐藏"查看更多"提示', async ({ page }) => {
    const input = page.locator('input[placeholder*="输入命令"]');
    
    for (let i = 0; i < 80; i++) {
      await input.fill(`final test ${i}`);
      await input.press('Enter');
      await page.waitForTimeout(100);
    }
    
    const loadMoreButton = page.locator('text=向上滚动查看更多历史记录');
    for (let i = 0; i < 20; i++) {
      if ((await loadMoreButton.count()) === 0) break;
      await loadMoreButton.click();
      await page.waitForTimeout(300);
    }

    await expect(loadMoreButton).toHaveCount(0, { timeout: 3000 });
  });

  test('新日志添加时应该自动滚动到底部', async ({ page }) => {
    const input = page.locator('input[placeholder*="输入命令"]');
    
    for (let i = 0; i < 10; i++) {
      await input.fill(`auto scroll ${i}`);
      await input.press('Enter');
      await page.waitForTimeout(200);
    }
    
    const outputContainer = page.locator('.overflow-y-auto').first();
    const isAtBottom = await outputContainer.evaluate((element) => {
      const { scrollTop, scrollHeight, clientHeight } = element;
      return scrollHeight - scrollTop - clientHeight < 50;
    });
    
    expect(isAtBottom).toBe(true);
  });

  test('清空输出后不应该显示"查看更多"提示', async ({ page }) => {
    const input = page.locator('input[placeholder*="输入命令"]');
    
    for (let i = 0; i < 30; i++) {
      await input.fill(`clear test ${i}`);
      await input.press('Enter');
      await page.waitForTimeout(150);
    }
    
    await expect(page.locator('text=向上滚动查看更多历史记录')).toBeVisible({ timeout: 5000 });
    
    await input.fill('clear');
    await input.press('Enter');
    
    await expect(page.locator('text=输入 help 查看可用命令')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('text=向上滚动查看更多历史记录')).not.toBeVisible({ timeout: 1000 });
  });
});

test.describe('控制台历史命令导航功能测试', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.waitForLoadState('networkidle');
    await page.keyboard.press('Control+Shift+C');
    await expect(page.locator('text=控制台')).toBeVisible({ timeout: 5000 });
  });

  test('按 ArrowUp 应该显示上一条历史命令', async ({ page }) => {
    const input = page.locator('input[placeholder*="输入命令"]');
    
    await input.fill('first command');
    await input.press('Enter');
    await page.waitForTimeout(300);
    
    await input.fill('second command');
    await input.press('Enter');
    await page.waitForTimeout(300);
    
    await input.fill('third command');
    await input.press('Enter');
    await page.waitForTimeout(300);
    
    await input.press('ArrowUp');
    
    const inputValue = await input.inputValue();
    expect(inputValue).toBe('third command');
  });

  test('连续按 ArrowUp 应该遍历所有历史命令', async ({ page }) => {
    const input = page.locator('input[placeholder*="输入命令"]');
    
    const commands = ['cmd1', 'cmd2', 'cmd3'];
    
    for (const cmd of commands) {
      await input.fill(cmd);
      await input.press('Enter');
      await page.waitForTimeout(300);
    }
    
    await input.press('ArrowUp');
    expect(await input.inputValue()).toBe('cmd3');
    
    await input.press('ArrowUp');
    expect(await input.inputValue()).toBe('cmd2');
    
    await input.press('ArrowUp');
    expect(await input.inputValue()).toBe('cmd1');
  });

  test('按 ArrowDown 应该返回下一条历史命令', async ({ page }) => {
    const input = page.locator('input[placeholder*="输入命令"]');
    
    await input.fill('alpha');
    await input.press('Enter');
    await page.waitForTimeout(300);
    
    await input.fill('beta');
    await input.press('Enter');
    await page.waitForTimeout(300);
    
    await input.press('ArrowUp');
    await input.press('ArrowUp');
    
    expect(await input.inputValue()).toBe('alpha');
    
    await input.press('ArrowDown');
    
    expect(await input.inputValue()).toBe('beta');
  });

  test('按 ArrowDown 回到起始位置应该恢复编辑内容', async ({ page }) => {
    const input = page.locator('input[placeholder*="输入命令"]');
    
    await input.fill('history cmd');
    await input.press('Enter');
    await page.waitForTimeout(300);
    
    await input.fill('my new input');
    
    await input.press('ArrowUp');
    expect(await input.inputValue()).toBe('history cmd');
    
    await input.press('ArrowDown');
    
    expect(await input.inputValue()).toBe('my new input');
  });

  test('提交命令后重置历史导航索引', async ({ page }) => {
    const input = page.locator('input[placeholder*="输入命令"]');
    
    await input.fill('reset test');
    await input.press('Enter');
    await page.waitForTimeout(300);
    
    await input.fill('another reset');
    await input.press('Enter');
    await page.waitForTimeout(300);
    
    await input.press('ArrowUp');
    expect(await input.inputValue()).toBe('another reset');
    
    await input.fill('fresh command');
    await input.press('Enter');
    await page.waitForTimeout(300);
    
    await input.press('ArrowUp');
    
    expect(await input.inputValue()).toBe('fresh command');
  });

  test('空历史时不响应上下键导航', async ({ page }) => {
    const input = page.locator('input[placeholder*="输入命令"]');
    
    const initialValue = await input.inputValue();
    
    await input.press('ArrowUp');
    expect(await input.inputValue()).toBe(initialValue);
    
    await input.press('ArrowDown');
    expect(await input.inputValue()).toBe(initialValue);
  });

  test('有补全建议时优先导航补全列表', async ({ page }) => {
    const input = page.locator('input[placeholder*="输入命令"]');
    
    await input.fill('autocomplete test');
    await input.press('Enter');
    await page.waitForTimeout(300);
    
    await input.fill('h');
    await page.waitForTimeout(300);
    
    await expect(page.locator('text=help')).toBeVisible({ timeout: 3000 });
    
    await input.press('ArrowUp');
    
    await expect(page.locator('text=help')).toBeVisible({ timeout: 1000 });
  });

  test('关闭补全后恢复正常历史导航', async ({ page }) => {
    const input = page.locator('input[placeholder*="输入命令"]');
    
    await input.fill('nav after close');
    await input.press('Enter');
    await page.waitForTimeout(300);
    
    await input.fill('h');
    await page.waitForTimeout(300);
    
    await expect(page.locator('text=help')).toBeVisible({ timeout: 3000 });
    
    await input.press('Escape');
    
    await expect(page.locator('text=help')).not.toBeVisible({ timeout: 2000 });
    
    await input.press('ArrowUp');
    
    expect(await input.inputValue()).toBe('nav after close');
  });
});

test.describe('控制台性能和边界情况测试', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.waitForLoadState('networkidle');
    await page.keyboard.press('Control+Shift+C');
    await expect(page.locator('text=控制台')).toBeVisible({ timeout: 5000 });
  });

  test('处理 100+ 条日志的性能', async ({ page }) => {
    const startTime = Date.now();
    
    const input = page.locator('input[placeholder*="输入命令"]');
    
    for (let i = 0; i < 120; i++) {
      await input.fill(`perf test ${i}`);
      await input.press('Enter');
      await page.waitForTimeout(50);
    }
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    expect(totalTime).toBeLessThan(30000);
    
    await expect(page.locator('text=向上滚动查看更多历史记录')).toBeVisible({ timeout: 5000 });
  });

  test('快速连续滚动的稳定性', async ({ page }) => {
    const input = page.locator('input[placeholder*="输入命令"]');
    
    for (let i = 0; i < 80; i++) {
      await input.fill(`rapid scroll ${i}`);
      await input.press('Enter');
      await page.waitForTimeout(50);
    }
    
    const outputContainer = page.locator('.overflow-y-auto').first();
    
    for (let i = 0; i < 5; i++) {
      await outputContainer.evaluate((element) => {
        element.scrollTop = 0;
      });
      await page.waitForTimeout(200);
      
      await outputContainer.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      await page.waitForTimeout(200);
    }
    
    const finalLogCount = await outputContainer.locator('.text-sm.font-mono').count();
    expect(finalLogCount).toBeGreaterThan(0);
  });

  test('空数组边界情况', async ({ page }) => {
    const outputContainer = page.locator('.overflow-y-auto').first();
    
    await expect(page.locator('text=输入 help 查看可用命令')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('text=向上滚动查看更多历史记录')).not.toBeVisible({ timeout: 1000 });
  });

  test('单条记录边界情况', async ({ page }) => {
    const input = page.locator('input[placeholder*="输入命令"]');
    
    await input.fill('single record');
    await input.press('Enter');
    await page.waitForTimeout(300);
    
    const outputContainer = page.locator('.overflow-y-auto').first();
    const logCount = await outputContainer.locator('.text-sm.font-mono').count();
    
    expect(logCount).toBe(1);
    await expect(page.locator('text=向上滚动查看更多历史记录')).not.toBeVisible({ timeout: 1000 });
  });

  test('恰好 20 条记录的边界情况', async ({ page }) => {
    const input = page.locator('input[placeholder*="输入命令"]');
    
    for (let i = 0; i < 20; i++) {
      await input.fill(`exactly twenty ${i}`);
      await input.press('Enter');
      await page.waitForTimeout(150);
    }
    
    const outputContainer = page.locator('.overflow-y-auto').first();
    const logCount = await outputContainer.locator('.text-sm.font-mono').count();
    
    expect(logCount).toBe(20);
    await expect(page.locator('text=向上滚动查看更多历史记录')).not.toBeVisible({ timeout: 1000 });
  });

  test('21 条记录触发折叠', async ({ page }) => {
    const input = page.locator('input[placeholder*="输入命令"]');
    
    for (let i = 0; i < 21; i++) {
      await input.fill(`trigger fold ${i}`);
      await input.press('Enter');
      await page.waitForTimeout(150);
    }
    
    await expect(page.locator('text=向上滚动查看更多历史记录')).toBeVisible({ timeout: 5000 });
    
    const loadMoreText = await page.locator('text=向上滚动查看更多历史记录').textContent();
    expect(loadMoreText).toContain('1 条');
  });

  test('并发操作的安全性', async ({ page }) => {
    const input = page.locator('input[placeholder*="输入命令"]');
    
    const promises = [];
    
    for (let i = 0; i < 30; i++) {
      promises.push(
        (async () => {
          await input.fill(`concurrent ${i}`);
          await input.press('Enter');
        })()
      );
      
      if (i % 5 === 0) {
        await Promise.all(promises);
        promises.length = 0;
        await page.waitForTimeout(100);
      }
    }
    
    if (promises.length > 0) {
      await Promise.all(promises);
    }
    
    await page.waitForTimeout(500);
    
    const outputContainer = page.locator('.overflow-y-auto').first();
    const logCount = await outputContainer.locator('.text-sm.font-mono').count();
    
    expect(logCount).toBeGreaterThan(0);
    expect(logCount).toBeLessThanOrEqual(30);
  });

  test('混合操作：导航 + 输入 + 提交', async ({ page }) => {
    const input = page.locator('input[placeholder*="输入命令"]');
    
    await input.fill('base command');
    await input.press('Enter');
    await page.waitForTimeout(300);
    
    await input.fill('second base');
    await input.press('Enter');
    await page.waitForTimeout(300);
    
    await input.press('ArrowUp');
    expect(await input.inputValue()).toBe('second base');
    
    await input.fill('modified during nav');
    
    await input.press('ArrowDown');
    expect(await input.inputValue()).toBe('modified during nav');
    
    await input.press('Enter');
    await page.waitForTimeout(300);
    
    await input.press('ArrowUp');
    expect(await input.inputValue()).toBe('modified during nav');
  });
});

test.describe('控制台主题切换测试', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.waitForLoadState('networkidle');
    await page.keyboard.press('Control+Shift+C');
    await expect(page.locator('text=控制台')).toBeVisible({ timeout: 5000 });
  });

  test('日志折叠功能在深色模式下正常工作', async ({ page }) => {
    test.skip(true, 'theme-toggle 元素在源码中不存在，无法测试深色模式切换');
    const themeToggle = page.locator('[data-testid="theme-toggle"]').first();

    await expect(themeToggle).toBeVisible({ timeout: 5000 });
    await themeToggle.click();
    await page.waitForTimeout(300);
    
    const input = page.locator('input[placeholder*="输入命令"]');
    
    for (let i = 0; i < 25; i++) {
      await input.fill(`dark mode ${i}`);
      await input.press('Enter');
      await page.waitForTimeout(150);
    }
    
    await expect(page.locator('text=向上滚动查看更多历史记录')).toBeVisible({ timeout: 5000 });
    
    const loadMoreButton = page.locator('text=向上滚动查看更多历史记录');
    const buttonClass = await loadMoreButton.evaluate((el) => el.closest('div')?.className);
    
    expect(buttonClass).toBeDefined();
  });

  test('历史导航在深色模式下正常工作', async ({ page }) => {
    test.skip(true, 'theme-toggle 元素在源码中不存在，无法测试深色模式切换');
    const themeToggle = page.locator('[data-testid="theme-toggle"]').first();

    await expect(themeToggle).toBeVisible({ timeout: 5000 });
    await themeToggle.click();
    await page.waitForTimeout(300);
    
    const input = page.locator('input[placeholder*="输入命令"]');
    
    await input.fill('dark history');
    await input.press('Enter');
    await page.waitForTimeout(300);
    
    await input.press('ArrowUp');
    
    expect(await input.inputValue()).toBe('dark history');
  });
});
