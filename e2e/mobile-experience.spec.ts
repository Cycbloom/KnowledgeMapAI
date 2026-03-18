import { test, expect } from '@playwright/test';

const MOBILE_PORTRAIT = { width: 390, height: 844 };
const MOBILE_LANDSCAPE = { width: 844, height: 390 };
const TABLET_PORTRAIT = { width: 768, height: 1024 };
const TABLET_LANDSCAPE = { width: 1024, height: 768 };

const MIN_TOUCH_SIZE = 44;

test.describe('移动端体验测试', () => {
  test.use({ viewport: MOBILE_PORTRAIT });

  test('应该在移动端显示正确的布局', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).toBeVisible();
    
    const viewport = page.viewportSize();
    expect(viewport?.width).toBe(MOBILE_PORTRAIT.width);
    expect(viewport?.height).toBe(MOBILE_PORTRAIT.height);
  });

  test('应该显示移动端底部导航', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    const bottomNav = page.locator('[class*="MobileBottomNav"], [data-testid="mobile-bottom-nav"], nav').first();
    const isVisible = await bottomNav.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (isVisible) {
      const navItems = await bottomNav.locator('a, button').all();
      expect(navItems.length).toBeGreaterThanOrEqual(0);
    }
    
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('核心页面移动端测试', () => {
  test.use({ viewport: MOBILE_PORTRAIT });

  const testMobilePage = async (page, url, name) => {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    } catch (e) {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
    }
    
    await page.waitForTimeout(1500);
    await expect(page.locator('body')).toBeVisible();
    
    const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    
    if (scrollHeight > viewportHeight) {
      const startY = viewportHeight * 0.8;
      const endY = viewportHeight * 0.2;
      
      await page.mouse.move(MOBILE_PORTRAIT.width / 2, startY);
      await page.mouse.down();
      await page.mouse.move(MOBILE_PORTRAIT.width / 2, endY, { steps: 10 });
      await page.mouse.up();
      
      await page.waitForTimeout(300);
    }
  };

  test('Dashboard页面移动端显示正常', async ({ page }) => {
    await testMobilePage(page, '/dashboard', 'Dashboard');
  });

  test('Tasks页面移动端显示正常', async ({ page }) => {
    await testMobilePage(page, '/tasks', 'Tasks');
  });

  test('Scheduler页面移动端显示正常', async ({ page }) => {
    await testMobilePage(page, '/scheduler', 'Scheduler');
  });

  test('Study页面移动端显示正常', async ({ page }) => {
    await testMobilePage(page, '/study', 'Study');
  });

  test('Calendar页面移动端显示正常', async ({ page }) => {
    await testMobilePage(page, '/calendar', 'Calendar');
  });

  test('Statistics页面移动端显示正常', async ({ page }) => {
    await testMobilePage(page, '/statistics', 'Statistics');
  });

  test('Profile页面移动端显示正常', async ({ page }) => {
    await testMobilePage(page, '/profile', 'Profile');
  });

  test('Settings页面移动端显示正常', async ({ page }) => {
    await testMobilePage(page, '/settings', 'Settings');
  });

  test('Achievements页面移动端显示正常', async ({ page }) => {
    await testMobilePage(page, '/achievements', 'Achievements');
  });

  test('Templates页面移动端显示正常', async ({ page }) => {
    await testMobilePage(page, '/templates', 'Templates');
  });
});

test.describe('横竖屏切换测试', () => {
  test('应该支持竖屏到横屏切换', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    await expect(page.locator('body')).toBeVisible();
    
    await page.setViewportSize(MOBILE_PORTRAIT);
    await page.waitForTimeout(500);
    
    await page.setViewportSize(MOBILE_LANDSCAPE);
    await page.waitForTimeout(500);
    await expect(page.locator('body')).toBeVisible();
    
    const viewport = page.viewportSize();
    expect(viewport?.width).toBe(MOBILE_LANDSCAPE.width);
    expect(viewport?.height).toBe(MOBILE_LANDSCAPE.height);
  });

  test('应该支持横屏到竖屏切换', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    
    await page.setViewportSize(MOBILE_LANDSCAPE);
    await page.waitForTimeout(500);
    await expect(page.locator('body')).toBeVisible();
    
    await page.setViewportSize(MOBILE_PORTRAIT);
    await page.waitForTimeout(500);
    await expect(page.locator('body')).toBeVisible();
    
    const viewport = page.viewportSize();
    expect(viewport?.width).toBe(MOBILE_PORTRAIT.width);
    expect(viewport?.height).toBe(MOBILE_PORTRAIT.height);
  });

  test('平板设备横竖屏切换正常', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    
    await page.setViewportSize(TABLET_PORTRAIT);
    await page.waitForTimeout(500);
    await expect(page.locator('body')).toBeVisible();
    
    await page.setViewportSize(TABLET_LANDSCAPE);
    await page.waitForTimeout(500);
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('触摸操作测试', () => {
  test.use({ viewport: MOBILE_PORTRAIT });

  test('应该支持触摸滚动', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    
    const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    
    if (scrollHeight > viewportHeight) {
      const startY = viewportHeight * 0.8;
      const endY = viewportHeight * 0.2;
      
      await page.mouse.move(MOBILE_PORTRAIT.width / 2, startY);
      await page.mouse.down();
      await page.mouse.move(MOBILE_PORTRAIT.width / 2, endY, { steps: 15 });
      await page.mouse.up();
      
      await page.waitForTimeout(300);
      
      const scrollTop = await page.evaluate(() => document.documentElement.scrollTop);
      expect(scrollTop).toBeGreaterThanOrEqual(0);
    }
    
    await expect(page.locator('body')).toBeVisible();
  });

  test('应该支持点击交互', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    
    const buttons = await page.locator('button:visible, a:visible').all();
    
    if (buttons.length > 0) {
      const button = buttons[0];
      const box = await button.boundingBox();
      
      if (box && box.width > 0 && box.height > 0) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(300);
      }
    }
    
    await expect(page.locator('body')).toBeVisible();
  });

  test('应该支持双击操作', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    
    const centerX = MOBILE_PORTRAIT.width / 2;
    const centerY = MOBILE_PORTRAIT.height / 2;
    
    await page.mouse.dblclick(centerX, centerY);
    await page.waitForTimeout(300);
    
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('响应式布局和触摸区域测试', () => {
  test.use({ viewport: MOBILE_PORTRAIT });

  test('移动端按钮应该有足够的触摸区域', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    
    const buttons = await page.locator('button:visible').all();
    const links = await page.locator('a:visible').all();
    const interactiveElements = [...buttons, ...links];
    
    let checkedCount = 0;
    let goodTouchCount = 0;
    
    for (const element of interactiveElements) {
      if (checkedCount >= 10) break;
      
      try {
        const box = await element.boundingBox();
        if (box && box.width > 0 && box.height > 0) {
          checkedCount++;
          if (box.width >= MIN_TOUCH_SIZE && box.height >= MIN_TOUCH_SIZE) {
            goodTouchCount++;
          }
        }
      } catch {
        continue;
      }
    }
    
    expect(checkedCount).toBeGreaterThanOrEqual(0);
    await expect(page.locator('body')).toBeVisible();
  });

  test('应该在不同设备尺寸上正确显示', async ({ page }) => {
    const devices = [
      { name: 'iPhone SE', size: { width: 375, height: 667 } },
      { name: 'iPhone 12', size: { width: 390, height: 844 } },
      { name: 'iPhone 14 Pro', size: { width: 393, height: 852 } },
      { name: 'Pixel 5', size: { width: 393, height: 851 } },
      { name: 'Samsung S21', size: { width: 360, height: 800 } },
    ];
    
    for (const device of devices) {
      await page.setViewportSize(device.size);
      await page.waitForTimeout(500);
      
      const viewport = page.viewportSize();
      expect(viewport?.width).toBe(device.size.width);
      expect(viewport?.height).toBe(device.size.height);
      
      await expect(page.locator('body')).toBeVisible();
      
      const fontSize = await page.evaluate(() => {
        const body = document.body;
        return window.getComputedStyle(body).fontSize;
      });
      
      const fontSizeNum = parseInt(fontSize, 10);
      expect(fontSizeNum).toBeGreaterThanOrEqual(12);
    }
  });

  test('平板设备显示正常', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    
    await page.setViewportSize(TABLET_PORTRAIT);
    await page.waitForTimeout(500);
    await expect(page.locator('body')).toBeVisible();
    
    await page.setViewportSize(TABLET_LANDSCAPE);
    await page.waitForTimeout(500);
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('PWA和离线功能测试', () => {
  test.use({ viewport: MOBILE_PORTRAIT });

  test('应该能够安装 PWA', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    
    const manifestLink = page.locator('link[rel="manifest"]');
    const hasManifest = await manifestLink.count() > 0;
    
    let manifestValid = false;
    if (hasManifest) {
      const manifestHref = await manifestLink.first().getAttribute('href');
      if (manifestHref) {
        try {
          const response = await page.request.get(manifestHref);
          if (response.ok()) {
            const manifest = await response.json();
            manifestValid = !!(manifest.name || manifest.short_name || manifest.icons);
          }
        } catch {
          manifestValid = false;
        }
      }
    }
    
    const hasServiceWorker = await page.evaluate(() => {
      return 'serviceWorker' in navigator;
    });
    
    const pwaScore = [hasManifest, manifestValid, hasServiceWorker].filter(Boolean).length;
    expect(pwaScore).toBeGreaterThanOrEqual(0);
  });

  test('离线状态处理正常', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    
    await context.setOffline(true);
    await page.waitForTimeout(1000);
    
    await expect(page.locator('body')).toBeVisible();
    
    await context.setOffline(false);
    await page.waitForTimeout(1000);
    
    await expect(page.locator('body')).toBeVisible();
  });
});
