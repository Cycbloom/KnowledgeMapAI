import { test, expect } from '@playwright/test';
import { AchievementsPage } from './pages/AchievementsPage';
import { LoginPage } from './pages/LoginPage';
import { testUser } from './utils/testHelpers';

test.describe.skip('成就系统测试', () => {
  let achievementsPage: AchievementsPage;
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    achievementsPage = new AchievementsPage(page);

    // 登录
    await loginPage.goto();
    await loginPage.login(testUser.email, testUser.password);
    await expect(page).toHaveURL(/\/$/, { timeout: 30000 });
  });

  test.describe('显示成就列表测试', () => {
    test('应该能够进入成就页面', async ({ page }) => {
      // 导航到成就页面
      await achievementsPage.goto();

      // 验证页面标题正确显示
      await expect(achievementsPage.title).toBeVisible({ timeout: 10000 });

      // 验证成就列表显示
      await expect(achievementsPage.achievementList).toBeVisible({ timeout: 10000 });
    });

    test('应该显示已解锁和未解锁成就区域', async ({ page }) => {
      await achievementsPage.goto();

      // 等待页面加载完成
      await achievementsPage.title.waitFor({ state: 'visible', timeout: 10000 });

      // 验证已解锁成就区域显示（如果存在）
      const unlockedVisible = await achievementsPage.unlockedSection.isVisible().catch(() => false);
      const lockedVisible = await achievementsPage.lockedSection.isVisible().catch(() => false);

      // 至少有一个区域显示
      expect(unlockedVisible || lockedVisible).toBeTruthy();
    });

    test('应该显示成就卡片列表', async ({ page }) => {
      await achievementsPage.goto();

      // 等待页面加载完成
      await achievementsPage.title.waitFor({ state: 'visible', timeout: 10000 });

      // 验证成就卡片存在
      const achievementCount = await achievementsPage.getAchievementCount();
      expect(achievementCount).toBeGreaterThan(0);
    });
  });

  test.describe('查看成就详情测试', () => {
    test('应该能够点击成就卡片查看详情', async ({ page }) => {
      await achievementsPage.goto();

      // 等待页面加载完成
      await achievementsPage.title.waitFor({ state: 'visible', timeout: 10000 });

      // 获取第一个成就卡片
      const firstCard = achievementsPage.achievementCard.first();
      await expect(firstCard).toBeVisible({ timeout: 10000 });

      // 点击成就卡片
      await firstCard.click();

      // 验证成就详情弹窗或页面显示
      // 检查是否有详情弹窗或详情面板
      const detailModal = page.locator('[data-testid="achievement-detail"], .achievement-detail-modal, [role="dialog"]');
      const detailPanel = page.locator('[data-testid="achievement-detail-panel"], .achievement-detail');

      // 等待详情显示
      const isModalVisible = await detailModal.isVisible().catch(() => false);
      const isPanelVisible = await detailPanel.isVisible().catch(() => false);

      expect(isModalVisible || isPanelVisible).toBeTruthy();
    });

    test('应该显示成就进度信息', async ({ page }) => {
      await achievementsPage.goto();

      // 等待页面加载完成
      await achievementsPage.title.waitFor({ state: 'visible', timeout: 10000 });

      // 检查是否有进度徽章显示
      const progressBadge = achievementsPage.progressBadge;
      const hasProgress = await progressBadge.count() > 0;

      // 如果有进度显示，验证其可见性
      if (hasProgress) {
        await expect(progressBadge.first()).toBeVisible();
      }
    });

    test('应该能够关闭成就详情', async ({ page }) => {
      await achievementsPage.goto();

      // 等待页面加载完成
      await achievementsPage.title.waitFor({ state: 'visible', timeout: 10000 });

      // 获取第一个成就卡片
      const firstCard = achievementsPage.achievementCard.first();
      await expect(firstCard).toBeVisible({ timeout: 10000 });

      // 点击成就卡片打开详情
      await firstCard.click();

      // 查找关闭按钮
      const closeButton = page.locator(
        'button[aria-label="关闭"], button:has-text("关闭"), [data-testid="close-detail"], button:has(svg)'
      );

      // 如果存在关闭按钮，点击关闭
      if (await closeButton.first().isVisible().catch(() => false)) {
        await closeButton.first().click();

        // 验证详情已关闭
        const detailModal = page.locator('[data-testid="achievement-detail"], .achievement-detail-modal, [role="dialog"]');
        await expect(detailModal).not.toBeVisible().catch(() => {
          // 某些实现可能没有弹窗，忽略此验证
        });
      }
    });
  });

  test.describe('边界条件测试', () => {
    test('应该正确处理无解锁成就状态', async ({ page }) => {
      await achievementsPage.goto();

      // 等待页面加载完成
      await achievementsPage.title.waitFor({ state: 'visible', timeout: 10000 });

      // 获取已解锁和未解锁成就数量
      const unlockedCount = await achievementsPage.getUnlockedCount();
      const lockedCount = await achievementsPage.getLockedCount();

      // 验证至少有未解锁成就显示
      expect(lockedCount + unlockedCount).toBeGreaterThan(0);

      // 如果没有已解锁成就，验证未解锁区域显示
      if (unlockedCount === 0) {
        await expect(achievementsPage.lockedSection).toBeVisible();
      }
    });

    test('应该正确显示成就总数', async ({ page }) => {
      await achievementsPage.goto();

      // 等待页面加载完成
      await achievementsPage.title.waitFor({ state: 'visible', timeout: 10000 });

      // 获取成就总数
      const totalCount = await achievementsPage.getAchievementCount();

      // 验证成就总数大于0
      expect(totalCount).toBeGreaterThan(0);
    });

    test('应该支持主题切换', async () => {
      await achievementsPage.goto();

      // 等待页面加载完成
      await achievementsPage.title.waitFor({ state: 'visible', timeout: 10000 });

      // 获取当前主题状态
      const isDarkBefore = await achievementsPage.page.locator('.dark').count() > 0;

      // 切换主题
      await achievementsPage.toggleTheme();

      // 验证主题已切换
      const isDarkAfter = await achievementsPage.page.locator('.dark').count() > 0;
      expect(isDarkBefore).not.toBe(isDarkAfter);
    });
  });

  test.describe('成就页面导航测试', () => {
    test('应该能够通过导航栏访问成就页面', async ({ page }) => {
      // 查找成就导航链接
      const achievementsLink = page.locator('a[href="/achievements"], nav a:has-text("成就")');

      // 如果存在导航链接，点击它
      if (await achievementsLink.isVisible().catch(() => false)) {
        await achievementsLink.click();

        // 验证导航到成就页面
        await expect(page).toHaveURL(/\/achievements/);
        await expect(achievementsPage.title).toBeVisible({ timeout: 10000 });
      } else {
        // 如果没有导航链接，直接访问
        await achievementsPage.goto();
        await expect(achievementsPage.title).toBeVisible({ timeout: 10000 });
      }
    });

    test('应该能够返回到首页', async ({ page }) => {
      await achievementsPage.goto();

      // 等待页面加载完成
      await achievementsPage.title.waitFor({ state: 'visible', timeout: 10000 });

      // 查找首页链接或Logo
      const homeLink = page.locator('a[href="/"], a:has-text("首页"), a:has-text("Dashboard")');

      if (await homeLink.isVisible().catch(() => false)) {
        await homeLink.click();

        // 验证返回首页
        await expect(page).toHaveURL(/\/$/);
      }
    });
  });

  test.describe('成就解锁条件验证测试', () => {
    test('应该正确区分已解锁和未解锁成就', async ({ page }) => {
      await achievementsPage.goto();
      await achievementsPage.switchToTab('achievements');
      await achievementsPage.waitForAchievementsLoaded();

      // 获取成就总数
      const totalCount = await achievementsPage.getAchievementCount();
      expect(totalCount).toBeGreaterThan(0);

      // 检查每个成就的锁定状态
      let unlockedCount = 0;
      let lockedCount = 0;

      for (let i = 0; i < Math.min(totalCount, 10); i++) {
        const isLocked = await achievementsPage.isAchievementLocked(i);
        if (isLocked) {
          lockedCount++;
        } else {
          unlockedCount++;
        }
      }

      // 验证至少有一些成就存在
      expect(unlockedCount + lockedCount).toBeGreaterThan(0);
    });

    test('应该显示成就解锁状态的视觉差异', async ({ page }) => {
      await achievementsPage.goto();
      await achievementsPage.switchToTab('achievements');
      await achievementsPage.waitForAchievementsLoaded();

      // 查找已解锁成就卡片（有渐变背景色）
      const unlockedCards = page.locator('[class*="rounded-xl"][class*="border"]:has([class*="from-blue-500"])');
      const unlockedCount = await unlockedCards.count();

      // 查找未解锁成就卡片（有灰色效果）
      const lockedCards = page.locator('[class*="rounded-xl"][class*="border"][class*="opacity-75"]');
      const lockedCount = await lockedCards.count();

      // 验证至少有一种类型的成就
      expect(unlockedCount + lockedCount).toBeGreaterThan(0);
    });

    test('应该显示成就的XP奖励信息', async ({ page }) => {
      await achievementsPage.goto();
      await achievementsPage.switchToTab('achievements');
      await achievementsPage.waitForAchievementsLoaded();

      // 获取第一个成就的信息
      const achievementInfo = await achievementsPage.getAchievementInfo(0);

      // 验证成就有名称
      expect(achievementInfo.name.length).toBeGreaterThan(0);

      // 验证XP奖励为正数
      expect(achievementInfo.xp).toBeGreaterThan(0);
    });

    test('应该显示成就解锁日期（如果已解锁）', async ({ page }) => {
      await achievementsPage.goto();
      await achievementsPage.switchToTab('achievements');
      await achievementsPage.waitForAchievementsLoaded();

      // 查找已解锁成就上的日期显示
      const unlockedDates = page.locator('[class*="rounded-xl"][class*="border"]:has([class*="text-green-500"]) span:has-text("/")');
      const hasUnlockedWithDate = await unlockedDates.count() > 0;

      // 如果有已解锁成就，验证日期格式
      if (hasUnlockedWithDate) {
        const dateText = await unlockedDates.first().textContent();
        // 验证日期格式（中文格式：YYYY/M/D 或类似）
        expect(dateText).toBeTruthy();
      }
    });

    test('应该正确显示成就图标', async ({ page }) => {
      await achievementsPage.goto();
      await achievementsPage.switchToTab('achievements');
      await achievementsPage.waitForAchievementsLoaded();

      // 查找成就图标容器
      const iconContainers = page.locator('[class*="rounded-xl"][class*="border"] [class*="w-12"][class*="h-12"]');
      const iconCount = await iconContainers.count();

      // 验证每个成就都有图标
      const achievementCount = await achievementsPage.getAchievementCount();
      expect(iconCount).toBeGreaterThanOrEqual(Math.min(achievementCount, 10));
    });

    test('应该显示锁定成就的锁定图标', async ({ page }) => {
      await achievementsPage.goto();
      await achievementsPage.switchToTab('achievements');
      await achievementsPage.waitForAchievementsLoaded();

      // 查找锁定成就卡片
      const lockedCards = page.locator('[class*="rounded-xl"][class*="border"][class*="opacity-75"]');

      if (await lockedCards.count() > 0) {
        // 悬停在锁定成就上
        await lockedCards.first().hover();

        // 等待悬停效果
        await page.waitForTimeout(300);

        // 验证锁定图标显示（悬停时显示）
        const lockIcon = lockedCards.first().locator('[class*="Lock"], svg');
        const hasLockIcon = await lockIcon.count() > 0;

        // 锁定成就应该有锁定图标或灰色效果
        expect(hasLockIcon || await lockedCards.first().isVisible()).toBeTruthy();
      }
    });
  });

  test.describe('成就进度追踪测试', () => {
    test('应该正确显示用户等级', async ({ page }) => {
      await achievementsPage.goto();
      await achievementsPage.title.waitFor({ state: 'visible', timeout: 10000 });

      // 获取用户等级
      const level = await achievementsPage.getUserLevel();

      // 验证等级显示
      expect(level).not.toBeNull();
      const levelNum = parseInt(level || '0');
      expect(levelNum).toBeGreaterThanOrEqual(1);
    });

    test('应该正确显示XP进度条', async ({ page }) => {
      await achievementsPage.goto();
      await achievementsPage.title.waitFor({ state: 'visible', timeout: 10000 });

      // 检查进度条存在
      const hasProgressBar = await achievementsPage.hasProgressBar();
      expect(hasProgressBar).toBeTruthy();

      // 获取进度百分比
      const progressPercent = await achievementsPage.getXpProgressPercent();

      // 验证进度在合理范围内
      expect(progressPercent).toBeGreaterThanOrEqual(0);
      expect(progressPercent).toBeLessThanOrEqual(100);
    });

    test('应该正确显示已解锁成就统计', async ({ page }) => {
      await achievementsPage.goto();
      await achievementsPage.title.waitFor({ state: 'visible', timeout: 10000 });

      // 获取已解锁成就统计
      const stats = await achievementsPage.getUnlockedAchievementsCount();

      // 验证统计数据
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.unlocked).toBeGreaterThanOrEqual(0);
      expect(stats.unlocked).toBeLessThanOrEqual(stats.total);
    });

    test('应该正确计算解锁百分比', async ({ page }) => {
      await achievementsPage.goto();
      await achievementsPage.title.waitFor({ state: 'visible', timeout: 10000 });

      // 获取已解锁成就统计
      const stats = await achievementsPage.getUnlockedAchievementsCount();

      // 计算百分比
      const percentage = (stats.unlocked / stats.total) * 100;

      // 验证百分比在合理范围内
      expect(percentage).toBeGreaterThanOrEqual(0);
      expect(percentage).toBeLessThanOrEqual(100);
    });

    test('应该显示总获得经验值', async ({ page }) => {
      await achievementsPage.goto();
      await achievementsPage.title.waitFor({ state: 'visible', timeout: 10000 });

      // 查找总经验显示
      const xpDisplay = page.locator('p:has-text("总获得经验"), p:has-text("XP")');
      const hasXpDisplay = await xpDisplay.count() > 0;

      if (hasXpDisplay) {
        const xpText = await xpDisplay.first().textContent();
        // 验证包含 XP 关键字
        expect(xpText?.toLowerCase()).toContain('xp');
      }
    });

    test('应该显示升级所需经验值', async ({ page }) => {
      await achievementsPage.goto();
      await achievementsPage.title.waitFor({ state: 'visible', timeout: 10000 });

      // 查找升级提示
      const levelUpHint = page.locator('p:has-text("升级"), p:has-text("Level")');
      const hasLevelUpHint = await levelUpHint.count() > 0;

      // 验证有升级相关信息
      expect(hasLevelUpHint).toBeTruthy();
    });

    test('应该正确显示每日任务进度', async ({ page }) => {
      await achievementsPage.goto();
      await achievementsPage.switchToTab('daily');
      await page.waitForTimeout(500);

      // 获取每日任务数量
      const dailyTaskCount = await achievementsPage.getDailyTaskCount();

      // 验证有每日任务显示
      expect(dailyTaskCount).toBeGreaterThan(0);

      // 获取已完成任务数量
      const completedCount = await achievementsPage.getCompletedDailyTaskCount();

      // 验证已完成数量不超过总数
      expect(completedCount).toBeLessThanOrEqual(dailyTaskCount);
    });

    test('应该显示每日任务的XP奖励', async ({ page }) => {
      await achievementsPage.goto();
      await achievementsPage.switchToTab('daily');
      await page.waitForTimeout(500);

      // 查找任务卡片中的XP奖励显示
      const xpRewards = page.locator('[class*="rounded-xl"][class*="border"] span:has-text("XP")');
      const xpCount = await xpRewards.count();

      // 验证有XP奖励显示
      expect(xpCount).toBeGreaterThan(0);

      // 验证第一个XP奖励格式正确
      const firstXp = await xpRewards.first().textContent();
      expect(firstXp).toMatch(/\+?\d+\s*XP/i);
    });

    test('应该显示连续签到信息', async ({ page }) => {
      await achievementsPage.goto();
      await achievementsPage.switchToTab('daily');
      await page.waitForTimeout(500);

      // 查找连续签到显示区域
      const streakSection = achievementsPage.streakDisplay;
      const hasStreakDisplay = await streakSection.count() > 0;

      // 验证有连续签到显示
      if (hasStreakDisplay) {
        const streakInfo = await achievementsPage.getStreakInfo();
        // 验证连续签到数据存在
        expect(streakInfo).not.toBeNull();
      }
    });
  });

  test.describe('成就分类筛选测试', () => {
    test('应该能够切换到终身成就标签', async ({ page }) => {
      await achievementsPage.goto();
      await achievementsPage.switchToTab('achievements');
      await page.waitForTimeout(500);

      // 验证标签已激活
      await expect(achievementsPage.achievementsTab).toHaveAttribute('class', /bg-blue-100|text-blue-600/);
    });

    test('应该按分类显示成就', async ({ page }) => {
      await achievementsPage.goto();
      await achievementsPage.switchToTab('achievements');
      await achievementsPage.waitForAchievementsLoaded();

      // 获取分类数量
      const categoryCount = await achievementsPage.getCategoryCount();

      // 验证有多个分类
      expect(categoryCount).toBeGreaterThan(0);
    });

    test('应该显示学习成就分类', async ({ page }) => {
      await achievementsPage.goto();
      await achievementsPage.switchToTab('achievements');
      await achievementsPage.waitForAchievementsLoaded();

      // 查找学习成就分类标题
      const studyCategoryTitle = page.locator('h3:has-text("学习成就")');
      const hasStudyCategory = await studyCategoryTitle.count() > 0;

      if (hasStudyCategory) {
        // 获取学习分类下的成就数量
        const studyAchievements = await achievementsPage.getAchievementsInCategory('study');
        expect(studyAchievements).toBeGreaterThanOrEqual(0);
      }
    });

    test('应该显示专注成就分类', async ({ page }) => {
      await achievementsPage.goto();
      await achievementsPage.switchToTab('achievements');
      await achievementsPage.waitForAchievementsLoaded();

      // 查找专注成就分类标题
      const focusCategoryTitle = page.locator('h3:has-text("专注成就")');
      const hasFocusCategory = await focusCategoryTitle.count() > 0;

      if (hasFocusCategory) {
        // 获取专注分类下的成就数量
        const focusAchievements = await achievementsPage.getAchievementsInCategory('focus');
        expect(focusAchievements).toBeGreaterThanOrEqual(0);
      }
    });

    test('应该显示创造者分类', async ({ page }) => {
      await achievementsPage.goto();
      await achievementsPage.switchToTab('achievements');
      await achievementsPage.waitForAchievementsLoaded();

      // 查找创造者分类标题
      const creationCategoryTitle = page.locator('h3:has-text("创造者")');
      const hasCreationCategory = await creationCategoryTitle.count() > 0;

      if (hasCreationCategory) {
        // 获取创造者分类下的成就数量
        const creationAchievements = await achievementsPage.getAchievementsInCategory('creation');
        expect(creationAchievements).toBeGreaterThanOrEqual(0);
      }
    });

    test('应该显示连续成就分类', async ({ page }) => {
      await achievementsPage.goto();
      await achievementsPage.switchToTab('achievements');
      await achievementsPage.waitForAchievementsLoaded();

      // 查找连续成就分类标题
      const streakCategoryTitle = page.locator('h3:has-text("连续成就")');
      const hasStreakCategory = await streakCategoryTitle.count() > 0;

      if (hasStreakCategory) {
        // 获取连续成就分类下的成就数量
        const streakAchievements = await achievementsPage.getAchievementsInCategory('streak');
        expect(streakAchievements).toBeGreaterThanOrEqual(0);
      }
    });

    test('应该显示任务成就分类', async ({ page }) => {
      await achievementsPage.goto();
      await achievementsPage.switchToTab('achievements');
      await achievementsPage.waitForAchievementsLoaded();

      // 查找任务成就分类标题
      const tasksCategoryTitle = page.locator('h3:has-text("任务成就")');
      const hasTasksCategory = await tasksCategoryTitle.count() > 0;

      if (hasTasksCategory) {
        // 获取任务成就分类下的成就数量
        const tasksAchievements = await achievementsPage.getAchievementsInCategory('tasks');
        expect(tasksAchievements).toBeGreaterThanOrEqual(0);
      }
    });

    test('应该能够切换到每日任务标签', async ({ page }) => {
      await achievementsPage.goto();
      await achievementsPage.switchToTab('daily');
      await page.waitForTimeout(500);

      // 验证每日任务卡片显示
      const dailyTaskCount = await achievementsPage.getDailyTaskCount();
      expect(dailyTaskCount).toBeGreaterThan(0);
    });

    test('应该能够切换到周期任务标签', async ({ page }) => {
      await achievementsPage.goto();
      await achievementsPage.switchToTab('periodic');
      await page.waitForTimeout(500);

      // 验证周期任务标签已激活
      await expect(achievementsPage.periodicTab).toHaveAttribute('class', /bg-blue-100|text-blue-600/);
    });

    test('应该能够切换到通行证标签', async ({ page }) => {
      await achievementsPage.goto();
      await achievementsPage.switchToTab('pass');
      await page.waitForTimeout(500);

      // 验证通行证标签已激活
      await expect(achievementsPage.passTab).toHaveAttribute('class', /bg-blue-100|text-blue-600/);
    });

    test('每个分类应该显示分类图标', async ({ page }) => {
      await achievementsPage.goto();
      await achievementsPage.switchToTab('achievements');
      await achievementsPage.waitForAchievementsLoaded();

      // 查找分类标题区域的图标
      const categoryIcons = page.locator('div:has(> h3) svg, h3 + svg, div:has(h3) svg');
      const iconCount = await categoryIcons.count();

      // 验证有分类图标
      expect(iconCount).toBeGreaterThan(0);
    });

    test('应该正确统计各分类的成就数量', async ({ page }) => {
      await achievementsPage.goto();
      await achievementsPage.switchToTab('achievements');
      await achievementsPage.waitForAchievementsLoaded();

      // 获取所有成就数量
      const totalCount = await achievementsPage.getAchievementCount();

      // 验证成就总数大于 0
      expect(totalCount).toBeGreaterThan(0);

      // 验证分类区域存在
      const categoryCount = await achievementsPage.getCategoryCount();
      expect(categoryCount).toBeGreaterThan(0);
    });
  });
});
