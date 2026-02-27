import { Locator, Page } from '@playwright/test';

export class AchievementsPage {
  readonly page: Page;
  readonly title: Locator;
  readonly achievementList: Locator;
  readonly unlockedSection: Locator;
  readonly lockedSection: Locator;
  readonly achievementCard: Locator;
  readonly progressBadge: Locator;
  
  // Tab 相关定位器
  readonly dailyTab: Locator;
  readonly periodicTab: Locator;
  readonly passTab: Locator;
  readonly achievementsTab: Locator;
  
  // 分类相关定位器
  readonly categorySection: Locator;
  readonly studyCategory: Locator;
  readonly focusCategory: Locator;
  readonly creationCategory: Locator;
  readonly streakCategory: Locator;
  readonly tasksCategory: Locator;
  
  // 进度相关定位器
  readonly levelDisplay: Locator;
  readonly xpProgressBar: Locator;
  readonly totalXpDisplay: Locator;
  readonly unlockedCountDisplay: Locator;
  
  // 每日任务相关定位器
  readonly dailyTaskCard: Locator;
  readonly streakDisplay: Locator;

  constructor(page: Page) {
    this.page = page;
    // 页面没有 h1 标题，使用 tabs 容器作为页面加载标识
    this.title = page.locator('button:has-text("每日任务"), button:has-text("终身成就")').first();
    this.achievementList = page.locator('[data-testid="achievement-list"], .achievement-grid');
    this.unlockedSection = page.locator('[data-testid="unlocked-section"], section:has-text("已解锁")');
    this.lockedSection = page.locator('[data-testid="locked-section"], section:has-text("未解锁")');
    this.achievementCard = page.locator('[data-testid="achievement-card"], .achievement-card, [class*="rounded-xl"][class*="border"]');
    this.progressBadge = page.locator('[data-testid="progress-badge"], .progress-badge');
    
    // Tab 定位器
    this.dailyTab = page.locator('button:has-text("每日任务")');
    this.periodicTab = page.locator('button:has-text("周期任务")');
    this.passTab = page.locator('button:has-text("通行证")');
    this.achievementsTab = page.locator('button:has-text("终身成就")');
    
    // 分类定位器
    this.categorySection = page.locator('[class*="space-y-8"] > div');
    this.studyCategory = page.locator('div:has(> div:has(h3:has-text("学习成就")))');
    this.focusCategory = page.locator('div:has(> div:has(h3:has-text("专注成就")))');
    this.creationCategory = page.locator('div:has(> div:has(h3:has-text("创造者")))');
    this.streakCategory = page.locator('div:has(> div:has(h3:has-text("连续成就")))');
    this.tasksCategory = page.locator('div:has(> div:has(h3:has-text("任务成就")))');
    
    // 进度定位器
    this.levelDisplay = page.locator('div:has(> div:has-text("等级")) span.text-4xl, [class*="text-4xl"][class*="font-bold"]');
    this.xpProgressBar = page.locator('[class*="h-3"][class*="bg-black/20"] > div, [class*="h-3"][class*="rounded-full"] > div');
    this.totalXpDisplay = page.locator('p:has-text("总获得经验"), p:has-text("XP")');
    this.unlockedCountDisplay = page.locator('div:has(> p:has-text("已解锁成就")) div.text-3xl');
    
    // 每日任务定位器
    this.dailyTaskCard = page.locator('[class*="rounded-xl"][class*="border"]:has([class*="h-1.5"][class*="bg-slate-100"])');
    this.streakDisplay = page.locator('div:has(> div:has-text("连续完成记录")), .bg-white:has-text("连续")').first();
  }

  async goto() {
    await this.page.goto('/achievements');
    // 使用 domcontentloaded 而不是 networkidle，避免长时间等待
    await this.page.waitForLoadState('domcontentloaded');
    // 等待页面主要内容出现
    await this.page.waitForSelector('button:has-text("每日任务"), button:has-text("终身成就")', { timeout: 10000 }).catch(() => {
      // 忽略错误，页面可能已经加载
    });
  }

  async getAchievementCount() {
    return await this.achievementCard.count();
  }

  async getUnlockedCount() {
    const unlocked = await this.unlockedSection.locator('[data-testid="achievement-card"], .achievement-card').count();
    return unlocked;
  }

  async getLockedCount() {
    const locked = await this.lockedSection.locator('[data-testid="achievement-card"], .achievement-card').count();
    return locked;
  }

  async toggleTheme() {
    const themeButton = this.page.locator('button[title*="主题"], button[title*="theme"], [data-testid="theme-toggle"]');
    await themeButton.click();
  }
  
  // 切换到指定 Tab
  async switchToTab(tab: 'daily' | 'periodic' | 'pass' | 'achievements') {
    const tabMap = {
      daily: this.dailyTab,
      periodic: this.periodicTab,
      pass: this.passTab,
      achievements: this.achievementsTab
    };
    await tabMap[tab].click();
    await this.page.waitForTimeout(300); // 等待动画完成
  }
  
  // 获取成就分类数量
  async getCategoryCount(): Promise<number> {
    return await this.categorySection.count();
  }
  
  // 获取指定分类下的成就数量
  async getAchievementsInCategory(category: string): Promise<number> {
    const categoryMap: Record<string, Locator> = {
      'study': this.studyCategory,
      'focus': this.focusCategory,
      'creation': this.creationCategory,
      'streak': this.streakCategory,
      'tasks': this.tasksCategory
    };
    const categoryLocator = categoryMap[category];
    if (!categoryLocator) return 0;
    return await categoryLocator.locator('[class*="rounded-xl"][class*="border"]').count();
  }
  
  // 获取用户等级
  async getUserLevel(): Promise<string | null> {
    const levelText = await this.levelDisplay.textContent();
    return levelText;
  }
  
  // 获取 XP 进度百分比
  async getXpProgressPercent(): Promise<number> {
    const progressBar = this.xpProgressBar;
    const style = await progressBar.getAttribute('style');
    if (style) {
      const match = style.match(/width:\s*(\d+(?:\.\d+)?)%/);
      if (match) {
        return parseFloat(match[1]);
      }
    }
    return 0;
  }
  
  // 获取已解锁成就总数
  async getUnlockedAchievementsCount(): Promise<{ unlocked: number; total: number }> {
    const countText = await this.unlockedCountDisplay.textContent();
    if (countText) {
      // 格式: "3 / 10"
      const match = countText.match(/(\d+)\s*\/\s*(\d+)/);
      if (match) {
        return { unlocked: parseInt(match[1]), total: parseInt(match[2]) };
      }
      // 只有数字
      const num = parseInt(countText);
      if (!isNaN(num)) {
        return { unlocked: num, total: await this.getAchievementCount() };
      }
    }
    return { unlocked: 0, total: 0 };
  }
  
  // 获取每日任务数量
  async getDailyTaskCount(): Promise<number> {
    return await this.dailyTaskCard.count();
  }
  
  // 获取已完成每日任务数量
  async getCompletedDailyTaskCount(): Promise<number> {
    const completedTasks = this.dailyTaskCard.locator('[class*="bg-green-50"], [class*="bg-green-900"]');
    return await completedTasks.count();
  }
  
  // 点击指定成就卡片
  async clickAchievementByIndex(index: number) {
    const card = this.achievementCard.nth(index);
    await card.click();
  }
  
  // 获取成就卡片信息
  async getAchievementInfo(index: number): Promise<{ name: string; xp: number; isUnlocked: boolean }> {
    const card = this.achievementCard.nth(index);
    const name = await card.locator('h4').textContent() || '';
    const xpText = await card.locator('span:has-text("XP")').textContent() || '0 XP';
    const xp = parseInt(xpText.replace(/[^0-9]/g, '')) || 0;
    const isUnlocked = await card.locator('[class*="CheckCircle2"], svg:has-text("CheckCircle2")').count() > 0 ||
                       await card.locator('[class*="text-green-500"]').count() > 0;
    return { name, xp, isUnlocked };
  }
  
  // 检查是否有进度条显示
  async hasProgressBar(): Promise<boolean> {
    return await this.xpProgressBar.count() > 0;
  }
  
  // 获取连续签到信息
  async getStreakInfo(): Promise<{ daily: number; weekly: number; monthly: number } | null> {
    const streakSection = this.streakDisplay;
    if (await streakSection.count() === 0) return null;
    
    // 尝试从页面获取连续签到数据
    const text = await streakSection.textContent() || '';
    const dailyMatch = text.match(/(\d+)\s*天/);
    const weeklyMatch = text.match(/(\d+)\s*周/);
    const monthlyMatch = text.match(/(\d+)\s*月/);
    
    return {
      daily: dailyMatch ? parseInt(dailyMatch[1]) : 0,
      weekly: weeklyMatch ? parseInt(weeklyMatch[1]) : 0,
      monthly: monthlyMatch ? parseInt(monthlyMatch[1]) : 0
    };
  }
  
  // 检查成就是否锁定
  async isAchievementLocked(index: number): Promise<boolean> {
    const card = this.achievementCard.nth(index);
    const hasLockIcon = await card.locator('[class*="Lock"]').count() > 0;
    const hasGrayscale = await card.locator('[class*="grayscale"]').count() > 0;
    const hasOpacity = await card.evaluate(el => el.classList.contains('opacity-75'));
    return hasLockIcon || hasGrayscale || hasOpacity;
  }
  
  // 等待成就加载完成
  async waitForAchievementsLoaded() {
    await this.page.waitForSelector('[class*="rounded-xl"][class*="border"]', { timeout: 10000 });
  }
}
