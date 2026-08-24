import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

// 控制台功能说明：
// - 打开快捷键：Ctrl+Shift+P（在 shortcuts.ts 中定义，action: openConsole）
// - 关闭快捷键：Ctrl+Shift+C 或 Escape（在 Console.tsx 中监听）
// - 测试环境 locale 为 en-US，UI 文本为英文；使用双语正则匹配中英文
// - 输入框 placeholder（en-US）: "Enter command... (Tab for autocomplete, Ctrl+R to search history)"
// - 控制台标题（en-US）: "Console"（i18n key: console.tabs.console）
// - 已修复的历史缺陷：
//   1. 日志折叠失效（visibleCount 被扩张为 output.length）→ 固定初始窗口 20 条
//   2. ArrowUp 遍历顺序相反（最旧优先）→ 与 store 一致（最新优先）
//   3. canNavigateHistory 阻止非空输入的历史导航 → 门控已移除
//   4. executeCommand 与 executeCommandInternal 双重回显 → 每条命令仅 1 条回显

const consoleTitle = 'text=/控制台|Console/';
const commandInput = 'input[placeholder*="命令"], input[placeholder*="command"]';
const helpHint = 'text=/输入 help 查看可用命令|Enter help to see available commands/';
const scrollMore = 'text=/向上滚动查看更多历史记录|Scroll up to view more history/';
// ConsoleOutput 的滚动容器选择器（限定在 Console 面板 .fixed.bottom-4.right-4 内，
// 避免匹配 Dashboard 等其他页面中同样使用 h-full.overflow-y-auto.custom-scrollbar 的容器）
const outputScrollContainer = '.fixed.bottom-4.right-4 .h-full.overflow-y-auto.custom-scrollbar';

// 等待 Dashboard 内容可见后通过快捷键打开控制台。
// authenticatedPage fixture 仅等待 page load 事件，React 应用和 useGlobalShortcuts
// 监听器可能尚未挂载。等待 Dashboard 文本可见可确保：
// 1. 用户已加载（user?.id 已设置，Console 组件已渲染）
// 2. useGlobalShortcuts 的 keydown 监听器已注册
async function openConsole(page: Page) {
  // 确认认证成功：URL 不在 /login
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
  // 等待 /api/graphs 响应完成（无论成功或失败），确保 Dashboard 已开始渲染
  await page.waitForResponse(
    (res) => res.url().includes('/api/graphs'),
    { timeout: 15000 },
  ).catch(() => {});
  // 等待 useGlobalShortcuts 注册 Control+Shift+P 监听器
  await page.waitForTimeout(500);
  await page.keyboard.press('Control+Shift+P');
  await expect(page.locator(consoleTitle)).toBeVisible({ timeout: 5000 });
}

test.describe('控制台日志折叠功能测试', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await openConsole(page);
  });

  test('新日志添加时应该自动滚动到底部', async ({ page }) => {
    const input = page.locator(commandInput);

    for (let i = 0; i < 10; i++) {
      await input.fill(`auto scroll ${i}`);
      await input.press('Enter');
      await page.waitForTimeout(200);
    }

    const outputContainer = page.locator(outputScrollContainer);
    const isAtBottom = await outputContainer.evaluate((element) => {
      const { scrollTop, scrollHeight, clientHeight } = element;
      return scrollHeight - scrollTop - clientHeight < 50;
    });

    expect(isAtBottom).toBe(true);
  });

});

test.describe('控制台历史命令导航功能测试', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await openConsole(page);
  });

  test('空历史时不响应上下键导航', async ({ page }) => {
    const input = page.locator(commandInput);

    const initialValue = await input.inputValue();

    await input.press('ArrowUp');
    expect(await input.inputValue()).toBe(initialValue);

    await input.press('ArrowDown');
    expect(await input.inputValue()).toBe(initialValue);
  });

  test('有补全建议时优先导航补全列表', async ({ page }) => {
    const input = page.locator(commandInput);

    // 使用 "hel" 而非 "h" 作为输入：单字符 "h" 在 E2E 环境中无法可靠触发
    // ConsoleInput 的 useEffect 更新补全建议（React 状态时序问题）。
    // "hel" 能可靠触发建议面板渲染（与 Tab 选择建议的测试一致）。
    await input.fill('hel');
    await expect(page.locator('text=/个建议/')).toBeVisible({ timeout: 3000 });

    await input.press('ArrowUp');
    await input.press('Tab');

    // Tab 选择建议后，输入值应为 "命令名 "（含尾部空格）
    await expect(input).toHaveValue(/^[a-z]+\s$/);
  });

  test('执行命令后 ArrowUp 应召回最近命令', async ({ page }) => {
    const input = page.locator(commandInput);

    await input.fill('version');
    await input.press('Enter');
    await page.waitForTimeout(300);

    await input.press('ArrowUp');
    await expect(input).toHaveValue('version');
  });

});

test.describe('控制台性能和边界情况测试', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await openConsole(page);
  });

  test('快速连续滚动的稳定性', async ({ page }) => {
    const input = page.locator(commandInput);

    for (let i = 0; i < 80; i++) {
      await input.fill(`rapid scroll ${i}`);
      await input.press('Enter');
      await page.waitForTimeout(50);
    }

    const outputContainer = page.locator(outputScrollContainer);

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
    await expect(page.locator(helpHint)).toBeVisible({ timeout: 3000 });
    await expect(page.locator(scrollMore)).not.toBeVisible({ timeout: 1000 });
  });

  test('单条记录边界情况', async ({ page }) => {
    const input = page.locator(commandInput);

    await input.fill('single record');
    await input.press('Enter');
    await page.waitForTimeout(300);

    const outputContainer = page.locator(outputScrollContainer);
    // 每条未知命令产生 1 个 "Unknown command" 错误输出（ConsoleOutput.tsx 中
    // 错误输出使用 text-sm text-red-* 类，不含 font-mono）。
    const errorCount = await outputContainer.locator('text=/Unknown command/').count();

    expect(errorCount).toBe(1);
    await expect(page.locator(scrollMore)).not.toBeVisible({ timeout: 1000 });
  });

  test('恰好 20 条记录的边界情况', async ({ page }) => {
    const input = page.locator(commandInput);

    // 回显修复后每条未知命令产生 2 条输出（1 条回显 + 1 条错误），发 10 条凑满 20
    for (let i = 0; i < 10; i++) {
      await input.fill(`exactly twenty ${i}`);
      await input.press('Enter');
      await page.waitForTimeout(150);
    }

    const outputContainer = page.locator(outputScrollContainer);
    const errorCount = await outputContainer.locator('text=/Unknown command/').count();

    expect(errorCount).toBe(10);
    await expect(page.locator(scrollMore)).not.toBeVisible({ timeout: 1000 });
  });

});
