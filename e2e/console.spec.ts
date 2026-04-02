import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './utils/auth';

test.describe('控制台功能测试', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.waitForLoadState('networkidle');
  });

  test('应该通过快捷键打开控制台', async ({ page }) => {
    await page.keyboard.press('Control+Shift+C');
    
    await expect(page.locator('text=控制台')).toBeVisible({ timeout: 5000 });
  });

  test('应该通过快捷键关闭控制台', async ({ page }) => {
    await page.keyboard.press('Control+Shift+C');
    await expect(page.locator('text=控制台')).toBeVisible({ timeout: 5000 });
    
    await page.keyboard.press('Control+Shift+C');
    
    await expect(page.locator('text=控制台')).not.toBeVisible({ timeout: 3000 });
  });

  test('应该通过 Escape 键关闭控制台', async ({ page }) => {
    await page.keyboard.press('Control+Shift+C');
    await expect(page.locator('text=控制台')).toBeVisible({ timeout: 5000 });
    
    await page.keyboard.press('Escape');
    
    await expect(page.locator('text=控制台')).not.toBeVisible({ timeout: 3000 });
  });
});

test.describe('控制台命令执行测试', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.waitForLoadState('networkidle');
    await page.keyboard.press('Control+Shift+C');
    await expect(page.locator('text=控制台')).toBeVisible({ timeout: 5000 });
  });

  test('应该执行 help 命令', async ({ page }) => {
    const input = page.locator('input[placeholder*="输入命令"]');
    await input.fill('help');
    await input.press('Enter');
    
    await expect(page.locator('text=可用命令')).toBeVisible({ timeout: 5000 });
  });

  test('应该执行 version 命令', async ({ page }) => {
    const input = page.locator('input[placeholder*="输入命令"]');
    await input.fill('version');
    await input.press('Enter');
    
    await expect(page.locator('text=KnowledgeMap')).toBeVisible({ timeout: 5000 });
  });

  test('应该执行 clear 命令清空输出', async ({ page }) => {
    const input = page.locator('input[placeholder*="输入命令"]');
    
    await input.fill('help');
    await input.press('Enter');
    await expect(page.locator('text=可用命令')).toBeVisible({ timeout: 5000 });
    
    await input.fill('clear');
    await input.press('Enter');
    
    await expect(page.locator('text=输入 help 查看可用命令')).toBeVisible({ timeout: 3000 });
  });

  test('应该显示未知命令错误', async ({ page }) => {
    const input = page.locator('input[placeholder*="输入命令"]');
    await input.fill('unknowncommand123');
    await input.press('Enter');
    
    await expect(page.locator('text=Unknown command')).toBeVisible({ timeout: 5000 });
  });

  test('应该执行 history 命令', async ({ page }) => {
    const input = page.locator('input[placeholder*="输入命令"]');
    
    await input.fill('help');
    await input.press('Enter');
    await expect(page.locator('text=可用命令')).toBeVisible({ timeout: 5000 });
    
    await input.fill('history');
    await input.press('Enter');
    
    await expect(page.locator('text=help')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('控制台命令历史测试', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.waitForLoadState('networkidle');
    await page.keyboard.press('Control+Shift+C');
    await expect(page.locator('text=控制台')).toBeVisible({ timeout: 5000 });
  });

  test('应该显示历史记录面板', async ({ page }) => {
    const historyButton = page.locator('button[title="历史记录"]');
    await historyButton.click();
    
    await expect(page.locator('text=历史记录')).toBeVisible({ timeout: 3000 });
  });

  test('应该在历史记录中显示执行的命令', async ({ page }) => {
    const input = page.locator('input[placeholder*="输入命令"]');
    
    await input.fill('version');
    await input.press('Enter');
    await page.waitForTimeout(500);
    
    const historyButton = page.locator('button[title="历史记录"]');
    await historyButton.click();
    
    await expect(page.locator('.text-xs.font-mono:has-text("version")').first()).toBeVisible({ timeout: 3000 });
  });

  test('应该点击历史记录项填充命令', async ({ page }) => {
    const input = page.locator('input[placeholder*="输入命令"]');
    
    await input.fill('help');
    await input.press('Enter');
    await page.waitForTimeout(500);
    
    const historyButton = page.locator('button[title="历史记录"]');
    await historyButton.click();
    
    const historyItem = page.locator('.text-xs.font-mono:has-text("help")').first();
    await historyItem.click();
    
    await expect(input).toHaveValue('help');
  });

  test('应该搜索历史记录', async ({ page }) => {
    const input = page.locator('input[placeholder*="输入命令"]');
    
    await input.fill('version');
    await input.press('Enter');
    await page.waitForTimeout(500);
    
    await input.fill('help');
    await input.press('Enter');
    await page.waitForTimeout(500);
    
    const historyButton = page.locator('button[title="历史记录"]');
    await historyButton.click();
    
    const searchInput = page.locator('input[placeholder="搜索..."]');
    await searchInput.fill('version');
    
    await expect(page.locator('.text-xs.font-mono:has-text("version")')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.text-xs.font-mono:has-text("help")')).not.toBeVisible({ timeout: 1000 });
  });
});

test.describe('控制台自动补全测试', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.waitForLoadState('networkidle');
    await page.keyboard.press('Control+Shift+C');
    await expect(page.locator('text=控制台')).toBeVisible({ timeout: 5000 });
  });

  test('应该显示命令自动补全建议', async ({ page }) => {
    const input = page.locator('input[placeholder*="输入命令"]');
    await input.fill('h');
    
    await expect(page.locator('text=help')).toBeVisible({ timeout: 3000 });
  });

  test('应该通过 Tab 选择建议', async ({ page }) => {
    const input = page.locator('input[placeholder*="输入命令"]');
    await input.fill('hel');
    await input.press('Tab');
    
    await expect(input).toHaveValue(/help\s*/);
  });

  test('应该通过箭头键导航建议', async ({ page }) => {
    const input = page.locator('input[placeholder*="输入命令"]');
    await input.fill('h');
    
    await page.waitForTimeout(300);
    
    await input.press('ArrowDown');
    await input.press('Enter');
    
    const inputValue = await input.inputValue();
    expect(inputValue).toMatch(/^[a-z]+\s*$/);
  });

  test('应该通过 Escape 关闭建议列表', async ({ page }) => {
    const input = page.locator('input[placeholder*="输入命令"]');
    await input.fill('h');
    
    await expect(page.locator('text=help')).toBeVisible({ timeout: 3000 });
    
    await input.press('Escape');
    
    await expect(page.locator('text=help')).not.toBeVisible({ timeout: 2000 });
  });
});

test.describe('控制台权限确认测试', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.waitForLoadState('networkidle');
    await page.keyboard.press('Control+Shift+C');
    await expect(page.locator('text=控制台')).toBeVisible({ timeout: 5000 });
  });

  test('应该对危险命令显示确认对话框', async ({ page }) => {
    const input = page.locator('input[placeholder*="输入命令"]');
    await input.fill('data reset');
    await input.press('Enter');
    
    await expect(page.locator('text=危险操作确认')).toBeVisible({ timeout: 5000 });
  });

  test('应该取消危险命令执行', async ({ page }) => {
    const input = page.locator('input[placeholder*="输入命令"]');
    await input.fill('data reset');
    await input.press('Enter');
    
    await expect(page.locator('text=危险操作确认')).toBeVisible({ timeout: 5000 });
    
    const cancelButton = page.locator('button:has-text("取消")');
    await cancelButton.click();
    
    await expect(page.locator('text=危险操作确认')).not.toBeVisible({ timeout: 3000 });
  });

  test('应该确认后执行危险命令', async ({ page }) => {
    const input = page.locator('input[placeholder*="输入命令"]');
    await input.fill('data reset --confirm');
    await input.press('Enter');
    
    await expect(page.locator('text=危险操作确认')).toBeVisible({ timeout: 5000 });
    
    const confirmInput = page.locator('input[placeholder*="输入 CONFIRM"]');
    await confirmInput.fill('CONFIRM');
    
    const confirmButton = page.locator('button:has-text("确认"):not(:disabled)').last();
    await confirmButton.click();
    
    await expect(page.locator('text=危险操作确认')).not.toBeVisible({ timeout: 5000 });
  });
});

test.describe('控制台输出测试', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    await page.waitForLoadState('networkidle');
    await page.keyboard.press('Control+Shift+C');
    await expect(page.locator('text=控制台')).toBeVisible({ timeout: 5000 });
  });

  test('应该显示命令输入', async ({ page }) => {
    const input = page.locator('input[placeholder*="输入命令"]');
    await input.fill('help');
    await input.press('Enter');
    
    await expect(page.locator('.text-sm.font-mono:has-text("help")').first()).toBeVisible({ timeout: 5000 });
  });

  test('应该显示成功图标', async ({ page }) => {
    const input = page.locator('input[placeholder*="输入命令"]');
    await input.fill('help');
    await input.press('Enter');
    
    await expect(page.locator('svg.lucide-check-circle')).toBeVisible({ timeout: 5000 });
  });

  test('应该显示错误图标当命令失败', async ({ page }) => {
    const input = page.locator('input[placeholder*="输入命令"]');
    await input.fill('unknowncommand');
    await input.press('Enter');
    
    await expect(page.locator('svg.lucide-x-circle')).toBeVisible({ timeout: 5000 });
  });

  test('应该清空输出', async ({ page }) => {
    const input = page.locator('input[placeholder*="输入命令"]');
    await input.fill('help');
    await input.press('Enter');
    
    await expect(page.locator('text=可用命令')).toBeVisible({ timeout: 5000 });
    
    const clearButton = page.locator('button[title="清空输出"]');
    await clearButton.click();
    
    await expect(page.locator('text=输入 help 查看可用命令')).toBeVisible({ timeout: 3000 });
  });
});
