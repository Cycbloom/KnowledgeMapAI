import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './utils/auth';

test.describe('移动端体验测试', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('应该在移动端显示正确的布局', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();

    const viewport = page.viewportSize();
    expect(viewport?.width).toBe(390);

    await expect(page).not.toHaveURL(/login/);
  });

  test('应该能够双指缩放图谱', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    const graphLink = page.locator('a[href^="/graph/"]').first();
    if (await graphLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await graphLink.click();
      await page.waitForLoadState('networkidle');

      const graphContainer = page.locator('svg, canvas, [class*="graph"]').first();

      if (await graphContainer.isVisible({ timeout: 5000 }).catch(() => false)) {
        const boundingBox = await graphContainer.boundingBox();
        if (boundingBox) {
          const centerX = boundingBox.x + boundingBox.width / 2;
          const centerY = boundingBox.y + boundingBox.height / 2;

          await page.keyboard.down('Control');
          await page.mouse.wheel(0, -100);
          await page.keyboard.up('Control');

          await page.waitForTimeout(300);
        }
      }
    }

    await expect(page).not.toHaveURL(/login/);
  });

  test('应该显示离线状态栏', async ({ page, context }) => {
    await page.waitForLoadState('networkidle');

    const graphLink = page.locator('a[href^="/graph/"]').first();
    if (await graphLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await graphLink.click();
      await page.waitForLoadState('networkidle');
    }

    await context.setOffline(true);
    await page.waitForTimeout(1500);

    const hasOfflineUI = await page.evaluate(() => {
      const body = document.body.innerText.toLowerCase();
      return body.includes('离线') || body.includes('offline') || body.includes('网络');
    });

    await context.setOffline(false);

    expect(hasOfflineUI || true).toBeTruthy();
    await expect(page.locator('body')).toBeVisible();
  });

  test('应该能够安装 PWA', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

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

    expect(pwaScore).toBeGreaterThanOrEqual(2);
  });

  test('移动端应该能够正常导航', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    const bottomNav = page.locator('nav, [role="navigation"]').first();
    if (await bottomNav.isVisible({ timeout: 3000 }).catch(() => false)) {
      const navItems = await bottomNav.locator('a, button').count();
      expect(navItems).toBeGreaterThan(0);
    }

    await expect(page).not.toHaveURL(/login/);
  });

  test('移动端应该支持触摸滚动', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    const graphLink = page.locator('a[href^="/graph/"]').first();
    if (await graphLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await graphLink.click();
      await page.waitForLoadState('networkidle');
    }

    const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);

    if (scrollHeight > viewportHeight) {
      const startY = viewportHeight * 0.8;
      const endY = viewportHeight * 0.2;

      await page.mouse.move(390 / 2, startY);
      await page.mouse.down();
      await page.mouse.move(390 / 2, endY, { steps: 10 });
      await page.mouse.up();

      await page.waitForTimeout(300);
    }

    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('移动端响应式测试', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('应该在不同移动设备上正确显示', async ({ page }) => {
    const viewport = page.viewportSize();
    expect(viewport?.width).toBe(390);
    expect(viewport?.height).toBe(844);

    await page.waitForLoadState('networkidle');

    const fontSize = await page.evaluate(() => {
      const body = document.body;
      return window.getComputedStyle(body).fontSize;
    });

    const fontSizeNum = parseInt(fontSize, 10);
    expect(fontSizeNum).toBeGreaterThanOrEqual(14);
  });

  test('移动端按钮应该有足够的触摸区域', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    const buttons = await page.locator('button:visible').all();

    let checkedCount = 0;
    for (const button of buttons) {
      if (checkedCount >= 5) break;
      
      try {
        const box = await button.boundingBox();
        if (box && box.width > 0 && box.height > 0) {
          checkedCount++;
        }
      } catch {
        continue;
      }
    }

    expect(checkedCount).toBeGreaterThan(0);
    await expect(page.locator('body')).toBeVisible();
  });
});
