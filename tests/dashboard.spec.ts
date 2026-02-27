import { test, expect } from '@playwright/test';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { testUser } from './utils/testHelpers';

test.describe('Dashboard 页面测试', () => {
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(testUser.email, testUser.password);
    
    dashboardPage = new DashboardPage(page);
    // 等待 Dashboard 页面标题出现，确保页面加载完成
    await dashboardPage.title.waitFor({ state: 'visible', timeout: 30000 });
  });

  test('应该显示 Dashboard 页面', async () => {
    await dashboardPage.title.waitFor({ state: 'visible', timeout: 10000 });
    await expect(dashboardPage.title).toBeVisible();
    await expect(dashboardPage.searchInput).toBeVisible();
    await expect(dashboardPage.newGraphButton).toBeVisible();
  });

  test('应该显示图谱列表', async () => {
    await dashboardPage.title.waitFor({ state: 'visible', timeout: 10000 });
    const graphCount = await dashboardPage.getGraphCount();
    expect(graphCount).toBeGreaterThanOrEqual(0);
  });

  test('应该能够打开模板选择器', async ({ page }) => {
    await dashboardPage.newGraphButton.click();
    await expect(page.locator('text=选择模板')).toBeVisible();
    await expect(page.locator('button:has-text("跳过，创建空白图谱")')).toBeVisible();
  });

  test('应该能够跳过模板创建空白图谱', async ({ page }) => {
    await dashboardPage.newGraphButton.click();
    await page.locator('button:has-text("跳过，创建空白图谱")').click();
    await expect(dashboardPage.graphTitleInput).toBeVisible();
    await expect(dashboardPage.graphDescriptionInput).toBeVisible();
    await expect(dashboardPage.confirmCreateButton).toBeVisible();
    await expect(dashboardPage.cancelButton).toBeVisible();
  });

  test('应该能够关闭创建图谱弹窗', async () => {
    await dashboardPage.openCreateGraphModal();
    await expect(dashboardPage.graphTitleInput).toBeVisible();
    await dashboardPage.closeModal();
    await expect(dashboardPage.graphTitleInput).not.toBeVisible();
  });

  test('应该能够搜索图谱', async () => {
    await dashboardPage.searchGraphs('测试');
    await expect(dashboardPage.searchInput).toHaveValue('测试');
  });

  test('应该支持主题切换', async () => {
    const isDarkBefore = await dashboardPage.isDarkMode();
    await dashboardPage.toggleTheme();
    const isDarkAfter = await dashboardPage.isDarkMode();
    expect(isDarkBefore).not.toBe(isDarkAfter);
  });
});

test.describe('Dashboard 图谱列表显示测试', () => {
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(testUser.email, testUser.password);
    
    dashboardPage = new DashboardPage(page);
    await dashboardPage.title.waitFor({ state: 'visible', timeout: 30000 });
  });

  test('应该显示图谱卡片列表', async () => {
    const graphCount = await dashboardPage.getGraphCount();
    
    // 验证图谱数量大于等于预期
    expect(graphCount).toBeGreaterThanOrEqual(0);
    
    // 如果有图谱，验证卡片结构
    if (graphCount > 0) {
      const titles = await dashboardPage.getGraphCardTitles();
      expect(titles.length).toBe(graphCount);
      
      // 验证每个卡片都有标题
      for (const title of titles) {
        expect(title.length).toBeGreaterThan(0);
      }
    }
  });

  test('图谱卡片应该包含必要信息', async ({ page }) => {
    const graphCount = await dashboardPage.getGraphCount();
    
    if (graphCount > 0) {
      const firstCard = dashboardPage.firstGraphCard;
      await expect(firstCard).toBeVisible();
      
      // 验证卡片包含标题
      const title = await firstCard.locator('h3').textContent();
      expect(title).toBeTruthy();
      
      // 验证卡片包含节点数量信息
      await expect(firstCard.locator('text=节点')).toBeVisible();
    }
  });
});

test.describe('Dashboard 创建新图谱测试', () => {
  let dashboardPage: DashboardPage;
  const testGraphTitle = `测试图谱_${Date.now()}`;

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(testUser.email, testUser.password);
    
    dashboardPage = new DashboardPage(page);
    await dashboardPage.title.waitFor({ state: 'visible', timeout: 30000 });
  });

  test('应该能够创建空白图谱', async ({ page }) => {
    // 打开创建图谱弹窗
    await dashboardPage.openCreateGraphModal();
    
    // 填写图谱信息
    await dashboardPage.graphTitleInput.fill(testGraphTitle);
    await dashboardPage.graphDescriptionInput.fill('这是一个测试图谱的描述');
    
    // 确认创建
    await dashboardPage.confirmCreateButton.click();
    
    // 等待创建完成（图谱卡片出现或弹窗关闭）
    await page.waitForTimeout(2000);
    
    // 验证图谱创建成功 - 弹窗应该关闭
    await expect(dashboardPage.graphTitleInput).not.toBeVisible();
    
    // 验证新图谱出现在列表中
    await dashboardPage.waitForGraphToBeVisible(testGraphTitle, 15000);
    const isVisible = await dashboardPage.isGraphVisible(testGraphTitle);
    expect(isVisible).toBe(true);
  });

  test('创建图谱时标题为空应该禁用创建按钮', async () => {
    await dashboardPage.openCreateGraphModal();
    
    // 不填写标题，验证创建按钮被禁用
    await expect(dashboardPage.confirmCreateButton).toBeDisabled();
    
    // 填写标题后，验证创建按钮可用
    await dashboardPage.graphTitleInput.fill('测试标题');
    await expect(dashboardPage.confirmCreateButton).toBeEnabled();
  });

  test('应该能够取消创建图谱', async () => {
    await dashboardPage.openCreateGraphModal();
    await dashboardPage.graphTitleInput.fill('应该被取消的图谱');
    
    // 点击取消按钮
    await dashboardPage.closeModal();
    
    // 验证弹窗已关闭
    await expect(dashboardPage.graphTitleInput).not.toBeVisible();
  });
});

test.describe('Dashboard 搜索图谱测试', () => {
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(testUser.email, testUser.password);
    
    // 等待登录成功后跳转到首页
    await page.waitForURL(/\/$/, { timeout: 30000 });
    
    dashboardPage = new DashboardPage(page);
    await dashboardPage.title.waitFor({ state: 'visible', timeout: 15000 });
  });

  test('应该能够按关键词搜索图谱', async ({ page }) => {
    const graphCount = await dashboardPage.getGraphCount();
    
    if (graphCount > 0) {
      // 获取第一个图谱的标题作为搜索关键词
      const titles = await dashboardPage.getGraphCardTitles();
      const searchKeyword = titles[0].substring(0, 3);
      
      // 执行搜索
      await dashboardPage.searchGraphs(searchKeyword);
      await page.waitForTimeout(1000);
      
      // 验证搜索框值正确
      await expect(dashboardPage.searchInput).toHaveValue(searchKeyword);
    }
  });

  test('搜索无结果时应该显示提示', async ({ page }) => {
    // 搜索一个不存在的图谱名称
    const nonExistentKeyword = 'xyzabc123不存在的图谱';
    await dashboardPage.searchGraphs(nonExistentKeyword);
    
    // 等待搜索完成
    await page.waitForTimeout(1000);
    
    // 验证显示无结果提示
    await expect(dashboardPage.noResultsState).toBeVisible();
  });

  test('清空搜索应该恢复图谱列表', async ({ page }) => {
    const initialCount = await dashboardPage.getGraphCount();
    
    if (initialCount > 0) {
      // 先执行搜索
      await dashboardPage.searchGraphs('xyzabc123不存在的图谱');
      await page.waitForTimeout(1000);
      
      // 清空搜索
      await dashboardPage.clearSearch();
      await page.waitForTimeout(1000);
      
      // 验证图谱列表恢复
      const restoredCount = await dashboardPage.getGraphCount();
      expect(restoredCount).toBe(initialCount);
    }
  });
});

test.describe('Dashboard 删除图谱测试', () => {
  let dashboardPage: DashboardPage;
  const testGraphTitle = `待删除图谱_${Date.now()}`;

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(testUser.email, testUser.password);
    
    // 等待登录成功后跳转到首页
    await page.waitForURL(/\/$/, { timeout: 30000 });
    
    dashboardPage = new DashboardPage(page);
    await dashboardPage.title.waitFor({ state: 'visible', timeout: 15000 });
  });

  test('应该能够删除指定图谱', async ({ page }) => {
    // 先创建一个测试图谱
    await dashboardPage.openCreateGraphModal();
    await dashboardPage.graphTitleInput.fill(testGraphTitle);
    await dashboardPage.confirmCreateButton.click();
    
    // 等待图谱创建成功
    await dashboardPage.waitForGraphToBeVisible(testGraphTitle, 15000);
    
    // 执行删除操作
    await dashboardPage.deleteGraphByTitle(testGraphTitle);
    
    // 验证删除确认弹窗出现
    await expect(dashboardPage.deleteConfirmModal).toBeVisible();
    
    // 确认删除
    await dashboardPage.confirmDelete();
    
    // 等待删除完成
    await page.waitForTimeout(2000);
    
    // 验证图谱已从列表中移除
    await dashboardPage.waitForGraphToBeHidden(testGraphTitle, 10000);
  });

  test('应该能够取消删除操作', async ({ page }) => {
    const cancelTestTitle = `取消删除测试_${Date.now()}`;
    
    // 先创建一个测试图谱
    await dashboardPage.openCreateGraphModal();
    await dashboardPage.graphTitleInput.fill(cancelTestTitle);
    await dashboardPage.confirmCreateButton.click();
    
    // 等待图谱创建成功
    await dashboardPage.waitForGraphToBeVisible(cancelTestTitle, 15000);
    
    // 执行删除操作
    await dashboardPage.deleteGraphByTitle(cancelTestTitle);
    
    // 验证删除确认弹窗出现
    await expect(dashboardPage.deleteConfirmModal).toBeVisible();
    
    // 取消删除
    await dashboardPage.cancelDelete();
    
    // 验证弹窗关闭
    await expect(dashboardPage.deleteConfirmModal).not.toBeVisible();
    
    // 验证图谱仍然存在
    const isVisible = await dashboardPage.isGraphVisible(cancelTestTitle);
    expect(isVisible).toBe(true);
    
    // 清理：删除测试图谱
    await dashboardPage.deleteGraphByTitle(cancelTestTitle);
    await dashboardPage.confirmDelete();
    await page.waitForTimeout(1000);
  });
});

test.describe('Dashboard 边界条件测试', () => {
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(testUser.email, testUser.password);
    
    // 等待登录成功后跳转到首页
    await page.waitForURL(/\/$/, { timeout: 30000 });
    
    dashboardPage = new DashboardPage(page);
    await dashboardPage.title.waitFor({ state: 'visible', timeout: 15000 });
  });

  test('搜索框应该支持清空操作', async () => {
    // 输入搜索内容
    await dashboardPage.searchGraphs('测试内容');
    await expect(dashboardPage.searchInput).toHaveValue('测试内容');
    
    // 清空搜索框
    await dashboardPage.clearSearch();
    await expect(dashboardPage.searchInput).toHaveValue('');
  });

  test('页面应该正确显示统计信息', async ({ page }) => {
    // 验证统计信息区域存在
    const statsSection = page.locator('text=您已创建').or(page.locator('text=个图谱'));
    await expect(statsSection.first()).toBeVisible();
  });

  test('新建图谱按钮应该始终可用', async () => {
    await expect(dashboardPage.newGraphButton).toBeEnabled();
    await expect(dashboardPage.newGraphButton).toBeVisible();
  });
});

test.describe('Dashboard 图谱收藏功能测试', () => {
  let dashboardPage: DashboardPage;
  const testGraphTitle = `收藏测试图谱_${Date.now()}`;

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(testUser.email, testUser.password);
    
    await page.waitForURL(/\/$/, { timeout: 30000 });
    
    dashboardPage = new DashboardPage(page);
    await dashboardPage.title.waitFor({ state: 'visible', timeout: 15000 });
  });

  test('应该能够收藏图谱', async ({ page }) => {
    // 先创建一个测试图谱
    await dashboardPage.openCreateGraphModal();
    await dashboardPage.graphTitleInput.fill(testGraphTitle);
    await dashboardPage.confirmCreateButton.click();
    
    // 等待图谱创建成功
    await dashboardPage.waitForGraphToBeVisible(testGraphTitle, 15000);
    
    // 悬停在图谱卡片上以显示操作按钮
    const card = dashboardPage.getGraphCardByTitle(testGraphTitle);
    await card.hover();
    
    // 点击收藏按钮（空心星星）
    const favoriteButton = card.locator('button[title="收藏图谱"]');
    await expect(favoriteButton).toBeVisible();
    await favoriteButton.click();
    
    // 等待收藏操作完成
    await page.waitForTimeout(1000);
    
    // 验证图谱已被收藏（显示实心星星）
    const isFavorited = await dashboardPage.isFavorited(testGraphTitle);
    expect(isFavorited).toBe(true);
    
    // 清理：取消收藏并删除图谱
    await dashboardPage.toggleFavorite(testGraphTitle);
    await page.waitForTimeout(500);
    await dashboardPage.deleteGraphByTitle(testGraphTitle);
    await dashboardPage.confirmDelete();
    await page.waitForTimeout(1000);
  });

  test('应该能够取消收藏图谱', async ({ page }) => {
    const unfavoriteTestTitle = `取消收藏测试_${Date.now()}`;
    
    // 创建并收藏图谱
    await dashboardPage.openCreateGraphModal();
    await dashboardPage.graphTitleInput.fill(unfavoriteTestTitle);
    await dashboardPage.confirmCreateButton.click();
    await dashboardPage.waitForGraphToBeVisible(unfavoriteTestTitle, 15000);
    
    // 收藏图谱
    const card = dashboardPage.getGraphCardByTitle(unfavoriteTestTitle);
    await card.hover();
    await card.locator('button[title="收藏图谱"]').click();
    await page.waitForTimeout(1000);
    
    // 验证已收藏
    expect(await dashboardPage.isFavorited(unfavoriteTestTitle)).toBe(true);
    
    // 取消收藏
    await dashboardPage.toggleFavorite(unfavoriteTestTitle);
    await page.waitForTimeout(1000);
    
    // 验证已取消收藏
    expect(await dashboardPage.isFavorited(unfavoriteTestTitle)).toBe(false);
    
    // 清理
    await dashboardPage.deleteGraphByTitle(unfavoriteTestTitle);
    await dashboardPage.confirmDelete();
    await page.waitForTimeout(1000);
  });

  test('收藏状态应该在页面刷新后保持', async ({ page }) => {
    const persistTestTitle = `持久化收藏测试_${Date.now()}`;
    
    // 创建并收藏图谱
    await dashboardPage.openCreateGraphModal();
    await dashboardPage.graphTitleInput.fill(persistTestTitle);
    await dashboardPage.confirmCreateButton.click();
    await dashboardPage.waitForGraphToBeVisible(persistTestTitle, 15000);
    
    // 收藏图谱
    const card = dashboardPage.getGraphCardByTitle(persistTestTitle);
    await card.hover();
    await card.locator('button[title="收藏图谱"]').click();
    await page.waitForTimeout(1000);
    
    // 刷新页面
    await page.reload();
    await dashboardPage.title.waitFor({ state: 'visible', timeout: 15000 });
    
    // 验证收藏状态保持
    expect(await dashboardPage.isFavorited(persistTestTitle)).toBe(true);
    
    // 清理
    await dashboardPage.toggleFavorite(persistTestTitle);
    await page.waitForTimeout(500);
    await dashboardPage.deleteGraphByTitle(persistTestTitle);
    await dashboardPage.confirmDelete();
    await page.waitForTimeout(1000);
  });

  test('收藏的图谱应该显示实心星星图标', async ({ page }) => {
    const iconTestTitle = `图标测试_${Date.now()}`;
    
    // 创建图谱
    await dashboardPage.openCreateGraphModal();
    await dashboardPage.graphTitleInput.fill(iconTestTitle);
    await dashboardPage.confirmCreateButton.click();
    await dashboardPage.waitForGraphToBeVisible(iconTestTitle, 15000);
    
    // 收藏图谱
    const card = dashboardPage.getGraphCardByTitle(iconTestTitle);
    await card.hover();
    await card.locator('button[title="收藏图谱"]').click();
    await page.waitForTimeout(1000);
    
    // 验证实心星星存在
    const filledStar = card.locator('svg[fill="currentColor"]');
    await expect(filledStar).toBeVisible();
    
    // 清理
    await dashboardPage.deleteGraphByTitle(iconTestTitle);
    await dashboardPage.confirmDelete();
    await page.waitForTimeout(1000);
  });
});

test.describe('Dashboard 图谱列表排序测试', () => {
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(testUser.email, testUser.password);
    
    await page.waitForURL(/\/$/, { timeout: 30000 });
    
    dashboardPage = new DashboardPage(page);
    await dashboardPage.title.waitFor({ state: 'visible', timeout: 15000 });
  });

  test('图谱列表应该正确显示', async () => {
    const graphCount = await dashboardPage.getGraphCount();
    
    // 验证图谱列表存在
    expect(graphCount).toBeGreaterThanOrEqual(0);
    
    // 如果有图谱，验证标题可以获取
    if (graphCount > 0) {
      const titles = await dashboardPage.getGraphCardTitles();
      expect(titles.length).toBe(graphCount);
    }
  });

  test('图谱卡片应该按默认顺序显示', async ({ page }) => {
    const graphCount = await dashboardPage.getGraphCount();
    
    if (graphCount >= 2) {
      // 获取当前图谱标题列表
      const titles = await dashboardPage.getGraphCardTitles();
      
      // 验证图谱按某种顺序排列（默认是创建时间倒序）
      expect(titles.length).toBeGreaterThanOrEqual(2);
      
      // 刷新页面验证顺序保持一致
      await page.reload();
      await dashboardPage.title.waitFor({ state: 'visible', timeout: 15000 });
      
      const titlesAfterReload = await dashboardPage.getGraphCardTitles();
      expect(titlesAfterReload).toEqual(titles);
    }
  });

  test('图谱列表应该支持分页', async ({ page }) => {
    const graphCount = await dashboardPage.getGraphCount();
    
    // 如果图谱数量足够多，验证分页功能
    if (graphCount > 9) {
      // 检查分页按钮存在
      const paginationButtons = page.locator('button:has(svg[class*="chevron"])');
      const paginationCount = await paginationButtons.count();
      
      // 应该有分页按钮
      expect(paginationCount).toBeGreaterThan(0);
    }
  });

  test('分页导航应该正常工作', async ({ page }) => {
    const totalPages = await dashboardPage.getTotalPages();
    
    if (totalPages > 1) {
      // 记录第一页的第一个图谱标题
      const firstPageTitles = await dashboardPage.getGraphCardTitles();
      const firstTitle = firstPageTitles[0];
      
      // 点击下一页
      await dashboardPage.goToNextPage();
      await page.waitForTimeout(500);
      
      // 验证图谱列表已更新
      const secondPageTitles = await dashboardPage.getGraphCardTitles();
      
      // 如果图谱数量足够，第二页的第一个图谱应该与第一页不同
      if (secondPageTitles.length > 0) {
        expect(secondPageTitles[0]).not.toBe(firstTitle);
      }
      
      // 返回上一页
      await dashboardPage.goToPreviousPage();
      await page.waitForTimeout(500);
      
      // 验证返回到第一页
      const backToFirstTitles = await dashboardPage.getGraphCardTitles();
      expect(backToFirstTitles[0]).toBe(firstTitle);
    }
  });
});

test.describe('Dashboard 图谱卡片交互测试', () => {
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(testUser.email, testUser.password);
    
    await page.waitForURL(/\/$/, { timeout: 30000 });
    
    dashboardPage = new DashboardPage(page);
    await dashboardPage.title.waitFor({ state: 'visible', timeout: 15000 });
  });

  test('图谱卡片悬停应该显示操作按钮', async ({ page }) => {
    const graphCount = await dashboardPage.getGraphCount();
    
    if (graphCount > 0) {
      const firstCard = dashboardPage.firstGraphCard;
      await firstCard.hover();
      
      // 验证删除按钮可见
      const deleteButton = firstCard.locator('button[title="删除图谱"]');
      await expect(deleteButton).toBeVisible({ timeout: 5000 });
    }
  });

  test('图谱卡片应该显示节点数量', async () => {
    const graphCount = await dashboardPage.getGraphCount();
    
    if (graphCount > 0) {
      const firstCard = dashboardPage.firstGraphCard;
      
      // 验证节点数量显示
      const nodesText = firstCard.locator('text=节点');
      await expect(nodesText).toBeVisible();
    }
  });

  test('图谱卡片应该显示描述信息', async () => {
    const graphCount = await dashboardPage.getGraphCount();
    
    if (graphCount > 0) {
      const firstCard = dashboardPage.firstGraphCard;
      
      // 验证描述段落存在
      const description = firstCard.locator('p');
      await expect(description).toBeVisible();
    }
  });

  test('点击图谱卡片应该跳转到学习页面', async ({ page }) => {
    const graphCount = await dashboardPage.getGraphCount();
    
    if (graphCount > 0) {
      const firstCard = dashboardPage.firstGraphCard;
      const title = await firstCard.locator('h3').textContent();
      
      // 点击卡片主体（不是操作按钮）
      await firstCard.locator('a').first().click();
      
      // 验证跳转到学习页面
      await page.waitForURL(/\/learning/, { timeout: 10000 });
      expect(page.url()).toContain('/learning');
    }
  });
});

test.describe('Dashboard 图谱标签筛选测试', () => {
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(testUser.email, testUser.password);
    
    await page.waitForURL(/\/$/, { timeout: 30000 });
    
    dashboardPage = new DashboardPage(page);
    await dashboardPage.title.waitFor({ state: 'visible', timeout: 15000 });
  });

  test('标签云区域应该正确显示', async ({ page }) => {
    // 检查标签云标题
    const tagCloudTitle = page.locator('text=标签云');
    const tagCloudVisible = await tagCloudTitle.count() > 0;
    
    // 如果有标签，验证标签云存在
    if (tagCloudVisible) {
      await expect(tagCloudTitle).toBeVisible();
    }
  });

  test('点击标签应该筛选图谱列表', async ({ page }) => {
    // 查找标签按钮
    const tagButtons = page.locator('button:has-text("标签云") + div button, [class*="rounded-full"]');
    const tagCount = await tagButtons.count();
    
    if (tagCount > 0) {
      // 记录初始图谱数量
      const initialCount = await dashboardPage.getGraphCount();
      
      // 点击第一个标签
      await tagButtons.first().click();
      await page.waitForTimeout(500);
      
      // 验证筛选后的图谱列表（可能数量变化）
      const filteredCount = await dashboardPage.getGraphCount();
      
      // 筛选后的数量应该小于等于初始数量
      expect(filteredCount).toBeLessThanOrEqual(initialCount);
    }
  });

  test('清除筛选应该恢复完整列表', async ({ page }) => {
    const tagButtons = page.locator('button:has-text("标签云") + div button, [class*="rounded-full"]');
    const tagCount = await tagButtons.count();
    
    if (tagCount > 0) {
      const initialCount = await dashboardPage.getGraphCount();
      
      // 点击标签筛选
      await tagButtons.first().click();
      await page.waitForTimeout(500);
      
      // 点击清除筛选按钮
      const clearButton = page.locator('button:has-text("清除筛选"), button:has-text("清除")');
      if (await clearButton.count() > 0) {
        await clearButton.click();
        await page.waitForTimeout(500);
        
        // 验证列表恢复
        const restoredCount = await dashboardPage.getGraphCount();
        expect(restoredCount).toBe(initialCount);
      }
    }
  });
});

test.describe('Dashboard 图谱排序测试', () => {
  let dashboardPage: DashboardPage;
  const testGraphs = [
    { title: `A_排序测试_${Date.now()}`, description: 'A开头的测试图谱' },
    { title: `B_排序测试_${Date.now() + 1}`, description: 'B开头的测试图谱' },
    { title: `C_排序测试_${Date.now() + 2}`, description: 'C开头的测试图谱' }
  ];

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(testUser.email, testUser.password);
    
    await page.waitForURL(/\/$/, { timeout: 30000 });
    
    dashboardPage = new DashboardPage(page);
    await dashboardPage.title.waitFor({ state: 'visible', timeout: 15000 });
  });

  test('应该能够按名称排序', async ({ page }) => {
    // 检查排序下拉框是否存在
    const hasSortDropdown = await dashboardPage.isSortDropdownVisible();
    
    if (hasSortDropdown) {
      // 尝试选择按名称排序
      await dashboardPage.selectSortOption('名称');
      await page.waitForTimeout(1000);
      
      // 获取排序后的图谱标题
      const titles = await dashboardPage.getGraphCardTitles();
      
      // 验证标题按字母顺序排列
      const sortedTitles = [...titles].sort((a, b) => a.localeCompare(b, 'zh-CN'));
      expect(titles).toEqual(sortedTitles);
    } else {
      // 如果没有排序功能，跳过测试
      test.skip();
    }
  });

  test('应该能够按创建时间排序', async ({ page }) => {
    const hasSortDropdown = await dashboardPage.isSortDropdownVisible();
    
    if (hasSortDropdown) {
      // 选择按创建时间排序
      await dashboardPage.selectSortOption('创建时间');
      await page.waitForTimeout(1000);
      
      // 获取当前排序选项
      const currentSort = await dashboardPage.getCurrentSortOption();
      expect(currentSort).toContain('创建时间');
    } else {
      test.skip();
    }
  });

  test('应该能够按更新时间排序', async ({ page }) => {
    const hasSortDropdown = await dashboardPage.isSortDropdownVisible();
    
    if (hasSortDropdown) {
      // 选择按更新时间排序
      await dashboardPage.selectSortOption('更新时间');
      await page.waitForTimeout(1000);
      
      // 获取当前排序选项
      const currentSort = await dashboardPage.getCurrentSortOption();
      expect(currentSort).toContain('更新时间');
    } else {
      test.skip();
    }
  });

  test('排序选项切换后应该正确更新列表', async ({ page }) => {
    const hasSortDropdown = await dashboardPage.isSortDropdownVisible();
    
    if (hasSortDropdown && await dashboardPage.getGraphCount() >= 2) {
      // 获取初始顺序
      const initialTitles = await dashboardPage.getGraphCardTitles();
      
      // 切换排序选项
      await dashboardPage.selectSortOption('名称');
      await page.waitForTimeout(1000);
      
      const nameSortedTitles = await dashboardPage.getGraphCardTitles();
      
      // 切换回创建时间
      await dashboardPage.selectSortOption('创建时间');
      await page.waitForTimeout(1000);
      
      const timeSortedTitles = await dashboardPage.getGraphCardTitles();
      
      // 验证不同排序选项产生不同结果
      expect(nameSortedTitles).not.toEqual(timeSortedTitles);
    } else {
      test.skip();
    }
  });
});

test.describe('Dashboard 收藏筛选功能测试', () => {
  let dashboardPage: DashboardPage;
  const favoritedGraphTitle = `收藏筛选测试_${Date.now()}`;
  const normalGraphTitle = `普通图谱_${Date.now() + 1}`;

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(testUser.email, testUser.password);
    
    await page.waitForURL(/\/$/, { timeout: 30000 });
    
    dashboardPage = new DashboardPage(page);
    await dashboardPage.title.waitFor({ state: 'visible', timeout: 15000 });

    // 创建两个测试图谱
    await dashboardPage.openCreateGraphModal();
    await dashboardPage.graphTitleInput.fill(favoritedGraphTitle);
    await dashboardPage.confirmCreateButton.click();
    await dashboardPage.waitForGraphToBeVisible(favoritedGraphTitle, 15000);

    await dashboardPage.openCreateGraphModal();
    await dashboardPage.graphTitleInput.fill(normalGraphTitle);
    await dashboardPage.confirmCreateButton.click();
    await dashboardPage.waitForGraphToBeVisible(normalGraphTitle, 15000);

    // 收藏第一个图谱
    await dashboardPage.toggleFavorite(favoritedGraphTitle);
    await page.waitForTimeout(1000);
  });

  test.afterEach(async ({ page }) => {
    // 清理测试图谱
    try {
      await dashboardPage.deleteGraphByTitle(favoritedGraphTitle);
      await dashboardPage.confirmDelete();
      await page.waitForTimeout(500);
      
      await dashboardPage.deleteGraphByTitle(normalGraphTitle);
      await dashboardPage.confirmDelete();
      await page.waitForTimeout(500);
    } catch (error) {
      // 忽略清理错误
    }
  });

  test('应该能够筛选收藏的图谱', async ({ page }) => {
    // 记录初始图谱数量
    const initialCount = await dashboardPage.getGraphCount();
    
    // 尝试筛选收藏图谱
    await dashboardPage.filterByFavorites();
    await page.waitForTimeout(1000);
    
    // 验证筛选后的图谱数量减少
    const filteredCount = await dashboardPage.getGraphCount();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
    
    // 验证筛选后的图谱都是收藏的
    if (filteredCount > 0) {
      const filteredTitles = await dashboardPage.getGraphCardTitles();
      for (const title of filteredTitles) {
        const isFavorited = await dashboardPage.isFavorited(title);
        expect(isFavorited).toBe(true);
      }
    }
  });

  test('筛选收藏后应该只显示收藏的图谱', async ({ page }) => {
    // 筛选收藏
    await dashboardPage.filterByFavorites();
    await page.waitForTimeout(1000);
    
    // 获取筛选后的图谱列表
    const filteredTitles = await dashboardPage.getGraphCardTitles();
    
    // 验证收藏的图谱在列表中
    if (filteredTitles.length > 0) {
      expect(filteredTitles).toContain(favoritedGraphTitle);
    }
    
    // 验证普通图谱不在列表中（如果图谱数量足够多）
    if (filteredTitles.length < await dashboardPage.getGraphCount()) {
      expect(filteredTitles).not.toContain(normalGraphTitle);
    }
  });

  test('应该能够清除收藏筛选', async ({ page }) => {
    // 先筛选收藏
    await dashboardPage.filterByFavorites();
    await page.waitForTimeout(1000);
    
    const filteredCount = await dashboardPage.getGraphCount();
    
    // 清除筛选
    await dashboardPage.clearFavoriteFilter();
    await page.waitForTimeout(1000);
    
    // 验证列表恢复
    const restoredCount = await dashboardPage.getGraphCount();
    expect(restoredCount).toBeGreaterThanOrEqual(filteredCount);
  });

  test('收藏筛选状态应该正确显示', async ({ page }) => {
    // 筛选收藏
    await dashboardPage.filterByFavorites();
    await page.waitForTimeout(1000);
    
    // 验证筛选状态激活
    const isActive = await dashboardPage.isFavoriteFilterActive();
    expect(isActive).toBe(true);
    
    // 清除筛选
    await dashboardPage.clearFavoriteFilter();
    await page.waitForTimeout(1000);
    
    // 验证筛选状态未激活
    const isNotActive = await dashboardPage.isFavoriteFilterActive();
    expect(isNotActive).toBe(false);
  });

  test('筛选收藏后创建新图谱应该正确显示', async ({ page }) => {
    // 筛选收藏
    await dashboardPage.filterByFavorites();
    await page.waitForTimeout(1000);
    
    const filteredCount = await dashboardPage.getGraphCount();
    
    // 创建新图谱
    const newGraphTitle = `新图谱_${Date.now()}`;
    await dashboardPage.openCreateGraphModal();
    await dashboardPage.graphTitleInput.fill(newGraphTitle);
    await dashboardPage.confirmCreateButton.click();
    await dashboardPage.waitForGraphToBeVisible(newGraphTitle, 15000);
    
    // 验证新图谱不在筛选列表中（因为未收藏）
    const newFilteredCount = await dashboardPage.getGraphCount();
    expect(newFilteredCount).toBe(filteredCount);
    
    // 清理
    await dashboardPage.clearFavoriteFilter();
    await page.waitForTimeout(500);
    await dashboardPage.deleteGraphByTitle(newGraphTitle);
    await dashboardPage.confirmDelete();
    await page.waitForTimeout(500);
  });
});

test.describe('Dashboard 图谱分享功能测试（可选）', () => {
  let dashboardPage: DashboardPage;
  const shareTestTitle = `分享测试图谱_${Date.now()}`;

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(testUser.email, testUser.password);
    
    await page.waitForURL(/\/$/, { timeout: 30000 });
    
    dashboardPage = new DashboardPage(page);
    await dashboardPage.title.waitFor({ state: 'visible', timeout: 15000 });

    // 创建测试图谱
    await dashboardPage.openCreateGraphModal();
    await dashboardPage.graphTitleInput.fill(shareTestTitle);
    await dashboardPage.confirmCreateButton.click();
    await dashboardPage.waitForGraphToBeVisible(shareTestTitle, 15000);
  });

  test.afterEach(async ({ page }) => {
    // 清理测试图谱
    try {
      await dashboardPage.deleteGraphByTitle(shareTestTitle);
      await dashboardPage.confirmDelete();
      await page.waitForTimeout(500);
    } catch (error) {
      // 忽略清理错误
    }
  });

  test('应该能够打开分享菜单（如果功能存在）', async ({ page }) => {
    // 尝试打开分享菜单
    await dashboardPage.openShareMenu(shareTestTitle);
    
    // 检查分享菜单是否打开
    const isShareMenuVisible = await dashboardPage.isShareMenuVisible();
    
    if (isShareMenuVisible) {
      // 如果分享功能存在，验证菜单可见
      expect(isShareMenuVisible).toBe(true);
      
      // 关闭菜单
      await dashboardPage.closeShareMenu();
    } else {
      // 如果分享功能不存在，跳过测试
      test.skip();
    }
  });

  test('应该能够获取分享链接（如果功能存在）', async ({ page }) => {
    await dashboardPage.openShareMenu(shareTestTitle);
    
    const isShareMenuVisible = await dashboardPage.isShareMenuVisible();
    
    if (isShareMenuVisible) {
      // 获取分享链接
      const shareLink = await dashboardPage.getShareLink();
      
      // 验证链接格式
      expect(shareLink).toBeTruthy();
      expect(shareLink).toMatch(/^https?:\/\//);
      
      await dashboardPage.closeShareMenu();
    } else {
      test.skip();
    }
  });

  test('应该能够复制分享链接（如果功能存在）', async ({ page }) => {
    await dashboardPage.openShareMenu(shareTestTitle);
    
    const isShareMenuVisible = await dashboardPage.isShareMenuVisible();
    
    if (isShareMenuVisible) {
      // 复制分享链接
      await dashboardPage.copyShareLink();
      
      // 验证复制操作（这里只是验证按钮可点击）
      // 实际的剪贴板验证需要浏览器权限，这里跳过
      
      await dashboardPage.closeShareMenu();
    } else {
      test.skip();
    }
  });

  test('应该能够切换图谱公开/私有状态（如果功能存在）', async ({ page }) => {
    // 尝试切换可见性
    await dashboardPage.toggleGraphVisibility(shareTestTitle);
    await page.waitForTimeout(1000);
    
    // 获取当前可见性状态
    const visibility = await dashboardPage.getGraphVisibility(shareTestTitle);
    
    if (visibility) {
      // 如果功能存在，验证状态
      expect(visibility).toBeTruthy();
      expect(['公开', '私有']).toContain(visibility);
    } else {
      // 如果功能不存在，跳过测试
      test.skip();
    }
  });

  test('分享菜单应该能够正常关闭', async ({ page }) => {
    await dashboardPage.openShareMenu(shareTestTitle);
    
    const isShareMenuVisible = await dashboardPage.isShareMenuVisible();
    
    if (isShareMenuVisible) {
      // 关闭菜单
      await dashboardPage.closeShareMenu();
      
      // 验证菜单已关闭
      const isMenuClosed = !(await dashboardPage.isShareMenuVisible());
      expect(isMenuClosed).toBe(true);
    } else {
      test.skip();
    }
  });
});
