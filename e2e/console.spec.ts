import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

// 控制台功能说明：
// - 打开快捷键：Ctrl+Shift+P（在 shortcuts.ts 中定义，action: openConsole）
// - 关闭快捷键：Ctrl+Shift+C 或 Escape（在 Console.tsx 中监听）
// - 测试环境 locale 为 en-US，UI 文本为英文；使用双语正则匹配中英文
// - 输入框 placeholder（en-US）: "Enter command... (Tab for autocomplete, Ctrl+R to search history)"
// - 控制台标题（en-US）: "Console"（i18n key: console.tabs.console）
// - 帮助/版本命令输出中硬编码 "KnowledgeMap" 字符串

const consoleTitle = 'text=/控制台|Console/';
const commandInput = 'input[placeholder*="命令"], input[placeholder*="command"]';
const helpHint = 'text=/输入 help 查看可用命令|Enter help to see available commands/';
const historyButton = 'button[title="历史记录"], button[title="History"]';
const clearOutputButton = 'button[title="清空输出"], button[title="Clear Output"]';

// 等待 Dashboard 内容可见后通过快捷键打开控制台。
// authenticatedPage fixture 仅等待 page load 事件，React 应用和 useGlobalShortcuts
// 监听器可能尚未挂载。等待 Dashboard 文本可见可确保：
// 1. 用户已加载（user?.id 已设置，Console 组件已渲染）
// 2. useGlobalShortcuts 的 keydown 监听器已注册
async function openConsole(page: Page) {
  // 确认认证成功：URL 不在 /login
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
  // 等待 /api/v1/graphs 响应完成（无论成功或失败），确保 Dashboard 已开始渲染
  await page.waitForResponse(
    (res) => res.url().includes('/api/v1/graphs'),
    { timeout: 15000 },
  ).catch(() => {});
  // 等待 useGlobalShortcuts 注册 Control+Shift+P 监听器
  await page.waitForTimeout(500);
  await page.keyboard.press('Control+Shift+P');
  await expect(page.locator(consoleTitle)).toBeVisible({ timeout: 5000 });
}

test.describe('控制台功能测试', () => {
  test('应该通过快捷键打开控制台', async ({ authenticatedPage: page }) => {
    await openConsole(page);
  });

  test('应该通过快捷键关闭控制台', async ({ authenticatedPage: page }) => {
    await openConsole(page);

    // Ctrl+Shift+P 为 toggle 快捷键，再次按下关闭控制台
    await page.keyboard.press('Control+Shift+P');

    await expect(page.locator(consoleTitle)).not.toBeVisible({ timeout: 3000 });
  });

  test('应该通过 Escape 键关闭控制台', async ({ authenticatedPage: page }) => {
    await openConsole(page);

    await page.keyboard.press('Escape');

    await expect(page.locator(consoleTitle)).not.toBeVisible({ timeout: 3000 });
  });
});

test.describe('控制台命令执行测试', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await openConsole(page);
  });

  test('应该执行 help 命令', async ({ page }) => {
    const input = page.locator(commandInput);
    await input.fill('help');
    await input.press('Enter');

    // help 输出中硬编码 "📖 KnowledgeMap 控制台"
    await expect(page.locator('text=/KnowledgeMap/')).toBeVisible({ timeout: 5000 });
  });

  test('应该执行 version 命令', async ({ page }) => {
    const input = page.locator(commandInput);
    await input.fill('version');
    await input.press('Enter');

    // version 输出中硬编码 "📦 KnowledgeMap 控制台"
    await expect(page.locator('text=/KnowledgeMap/')).toBeVisible({ timeout: 5000 });
  });

  test('应该显示未知命令错误', async ({ page }) => {
    const input = page.locator(commandInput);
    await input.fill('unknowncommand123');
    await input.press('Enter');

    // CommandRegistry 对未知命令返回 "Unknown command: <name>"
    await expect(page.locator('text=Unknown command')).toBeVisible({ timeout: 5000 });
  });

  test('应该执行 history 命令', async ({ page }) => {
    const input = page.locator(commandInput);

    await input.fill('help');
    await input.press('Enter');
    await expect(page.locator('text=/KnowledgeMap/')).toBeVisible({ timeout: 5000 });

    await input.fill('history');
    await input.press('Enter');

    // history 输出包含之前执行的 "help" 命令
    // 使用 .first() 避免匹配多个元素（输入回显 + 历史表格单元格）
    await expect(page.locator('text=help').first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('控制台命令历史测试', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await openConsole(page);
  });

  test('应该显示历史记录面板', async ({ page }) => {
    const historyBtn = page.locator(historyButton);
    await historyBtn.click();

    // ConsoleHistory 组件中硬编码 "历史记录" 标题文本
    await expect(page.locator('text=历史记录')).toBeVisible({ timeout: 3000 });
  });

  test('应该在历史记录中显示执行的命令', async ({ page }) => {
    const input = page.locator(commandInput);

    await input.fill('version');
    await input.press('Enter');
    await page.waitForTimeout(500);

    const historyBtn = page.locator(historyButton);
    await historyBtn.click();

    // ConsoleHistory 历史项使用 text-xs font-mono 类
    await expect(page.locator('.text-xs.font-mono:has-text("version")').first()).toBeVisible({ timeout: 3000 });
  });

  test('应该点击历史记录项填充命令', async ({ page }) => {
    const input = page.locator(commandInput);

    await input.fill('help');
    await input.press('Enter');
    await page.waitForTimeout(500);

    const historyBtn = page.locator(historyButton);
    await historyBtn.click();
    // 等待历史面板展开动画完成（motion.div width 0→200, 0.2s）
    await page.waitForTimeout(500);

    // 使用 button 限定选择器，避免匹配输出区域的表格单元格
    const historyItem = page.locator('button:has(.text-xs.font-mono)').filter({ hasText: 'help' }).first();
    await historyItem.click();

    await expect(input).toHaveValue('help');
  });

  test('应该搜索历史记录', async ({ page }) => {
    const input = page.locator(commandInput);

    await input.fill('version');
    await input.press('Enter');
    await page.waitForTimeout(500);

    await input.fill('help');
    await input.press('Enter');
    await page.waitForTimeout(500);

    const historyBtn = page.locator(historyButton);
    await historyBtn.click();

    // ConsoleHistory 搜索框 placeholder 硬编码为 "搜索..."
    const searchInput = page.locator('input[placeholder="搜索..."]');
    await searchInput.fill('version');

    // 使用 button 限定选择器，避免匹配输出区域的表格单元格
    const historyButtons = page.locator('button:has(.text-xs.font-mono)');
    await expect(historyButtons.filter({ hasText: 'version' })).toBeVisible({ timeout: 3000 });
    await expect(historyButtons.filter({ hasText: 'help' })).toHaveCount(0, { timeout: 1000 });
  });
});

test.describe('控制台自动补全测试', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await openConsole(page);
  });

  test('应该显示命令自动补全建议', async ({ page }) => {
    const input = page.locator(commandInput);
    await input.fill('h');

    // 输入 "h" 后应显示以 h 开头的命令建议（help, history, home）
    await expect(page.locator('text=help')).toBeVisible({ timeout: 3000 });
  });

  test('应该通过 Tab 选择建议', async ({ page }) => {
    const input = page.locator(commandInput);
    await input.fill('hel');
    await input.press('Tab');

    await expect(input).toHaveValue(/help\s*/);
  });

  test('应该通过箭头键导航建议', async ({ page }) => {
    const input = page.locator(commandInput);

    // 使用 "hel" 而非 "h" 作为输入：单字符 "h" 在 E2E 环境中无法可靠触发
    // ConsoleInput 的 useEffect 更新补全建议（React 状态时序问题）。
    // "hel" 能可靠触发建议面板渲染（与 "应该通过 Tab 选择建议" 测试一致）。
    await input.fill('hel');
    await expect(page.locator('text=/个建议/')).toBeVisible({ timeout: 3000 });

    await input.press('ArrowDown');
    await input.press('Enter');

    // Enter 选择建议后，输入值应为 "help "（含尾部空格）
    await expect(input).toHaveValue(/^[a-z]+\s$/);
  });

  test('应该通过 Escape 关闭建议列表', async ({ page }) => {
    const input = page.locator(commandInput);
    await input.fill('h');

    await expect(page.locator('text=help')).toBeVisible({ timeout: 3000 });

    await input.press('Escape');

    await expect(page.locator('text=help')).not.toBeVisible({ timeout: 2000 });
  });
});

test.describe('控制台权限确认测试', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await openConsole(page);
  });

});

test.describe('控制台输出测试', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await openConsole(page);
  });

  test('应该显示命令输入', async ({ page }) => {
    const input = page.locator(commandInput);
    await input.fill('help');
    await input.press('Enter');

    // 输入回显使用 text-sm font-mono 类
    await expect(page.locator('.text-sm.font-mono:has-text("help")').first()).toBeVisible({ timeout: 5000 });
  });

  test('应该显示成功图标', async ({ page }) => {
    const input = page.locator(commandInput);
    await input.fill('help');
    await input.press('Enter');

    // 成功输出项有 border-green-500 类，内部 SVG 为 CheckCircle 图标
    await expect(page.locator('.border-green-500 svg').first()).toBeVisible({ timeout: 5000 });
  });

  test('应该显示错误图标当命令失败', async ({ page }) => {
    const input = page.locator(commandInput);
    await input.fill('unknowncommand');
    await input.press('Enter');

    // 错误输出项有 border-red-500 类，内部 SVG 为 XCircle 图标
    await expect(page.locator('.border-red-500 svg').first()).toBeVisible({ timeout: 5000 });
  });

  test('应该清空输出', async ({ page }) => {
    const input = page.locator(commandInput);
    await input.fill('help');
    await input.press('Enter');

    await expect(page.locator('text=/KnowledgeMap/')).toBeVisible({ timeout: 5000 });

    // 点击清空输出按钮（非 clear 命令），调用 clearOutput() 清空
    const clearBtn = page.locator(clearOutputButton);
    await clearBtn.click();

    // 输出为空后显示帮助提示
    await expect(page.locator(helpHint)).toBeVisible({ timeout: 3000 });
  });
});
