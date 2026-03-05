import { Locator, Page } from '@playwright/test';

export class StudyPage {
  readonly page: Page;
  
  // 页面标题和导航
  readonly title: Locator;
  readonly backButton: Locator;
  readonly sidebar: Locator;
  
  // 统计区域 - 使用图标和布局结构定位,避免依赖文本内容
  readonly progressStats: Locator;
  readonly totalCardsStat: Locator;
  readonly masteredCardsStat: Locator;
  readonly dueCardsStat: Locator;
  readonly streakDaysStat: Locator;
  readonly weeklyStudyTimeStat: Locator;
  
  // 卡片列表
  readonly cardList: Locator;
  readonly cardItem: Locator;
  readonly emptyState: Locator;
  
  // 学习按钮 - 使用布局结构和图标定位,避免依赖动态文本
  readonly startStudyButton: Locator;
  readonly startDueStudyButton: Locator;
  readonly startAllStudyButton: Locator;
  
  // 答题模式
  readonly quizContainer: Locator;
  readonly questionText: Locator;
  readonly answerText: Locator;
  readonly explanationText: Locator;
  readonly showAnswerButton: Locator;
  readonly optionsContainer: Locator;
  readonly optionButton: Locator;
  
  // 评分按钮
  readonly ratingButtons: Locator;
  readonly rateAgainButton: Locator;
  readonly rateHardButton: Locator;
  readonly rateGoodButton: Locator;
  readonly rateEasyButton: Locator;
  
  // 完成状态
  readonly finishScreen: Locator;
  readonly returnToDashboardButton: Locator;
  readonly restartButton: Locator;
  
  // 视图切换 - 使用布局结构定位,避免依赖文本内容
  readonly viewTabs: Locator;
  readonly dashboardTab: Locator;
  readonly bankTab: Locator;
  readonly focusTab: Locator;
  
  // 搜索和筛选 - 使用布局结构定位
  readonly searchInput: Locator;
  readonly tableModeDueButton: Locator;
  readonly tableModeAllButton: Locator;
  
  // 分页
  readonly paginationControls: Locator;
  readonly prevPageButton: Locator;
  readonly nextPageButton: Locator;
  
  // 消息提示
  readonly toastMessage: Locator;
  
  // 题库管理 - 高级筛选
  readonly typeFilterSelect: Locator;
  readonly advancedFilterButton: Locator;
  readonly reviewCountMinInput: Locator;
  readonly reviewCountMaxInput: Locator;
  readonly nextReviewStartInput: Locator;
  readonly nextReviewEndInput: Locator;
  
  // 统计卡片
  readonly streakDaysStat: Locator;
  readonly weeklyStudyTimeStat: Locator;
  readonly newCardsStat: Locator;
  readonly learningCardsStat: Locator;
  readonly reviewCardsStat: Locator;
  readonly relearningCardsStat: Locator;
  
  // 薄弱知识点和预测 - 使用布局结构定位,避免依赖文本内容
  readonly weakPointsSection: Locator;
  readonly predictionsSection: Locator;
  
  // 完成界面统计
  readonly finishStatsSection: Locator;
  readonly finishCorrectRate: Locator;
  readonly finishTotalCards: Locator;

  // 移动端专用选择器 - 考虑响应式布局差异
  readonly mobileViewTabs: Locator;
  readonly mobileSearchInput: Locator;
  readonly mobileStatCards: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // 页面标题和导航
    this.title = page.locator('h1:has-text("学习中心")');
    this.backButton = page.locator('button:has(svg[class*="ArrowLeft"])');
    this.sidebar = page.locator('nav');
    
    // 统计区域 - 使用布局结构和索引定位,避免依赖文本内容
    // 统计卡片位于 grid-cols-3 或 grid-cols-5 的 grid 中
    this.progressStats = page.locator('.grid.grid-cols-3, .grid.grid-cols-5');
    // 使用索引定位各个统计卡片,避免依赖文本
    this.totalCardsStat = this.progressStats.locator('div.p-3').nth(0).locator('p.text-xl');
    this.masteredCardsStat = this.progressStats.locator('div.p-3').nth(1).locator('p.text-xl');
    this.dueCardsStat = this.progressStats.locator('div.p-3').nth(2).locator('p.text-xl');
    this.streakDaysStat = this.progressStats.locator('div.p-3').nth(3).locator('p.text-xl');
    this.weeklyStudyTimeStat = this.progressStats.locator('div.p-3').nth(4).locator('p.text-xl');
    
    // 卡片列表
    this.cardList = page.locator('[data-testid="card-list"]');
    this.cardItem = page.locator('[class*="group relative rounded"]');
    this.emptyState = page.locator('text=没有找到匹配的卡片');
    
    // 学习按钮 - 使用布局结构和图标定位,避免依赖动态文本
    this.startStudyButton = page.locator('button:has-text("开始学习")');
    // 使用 Brain 图标定位"今日待复习"按钮
    this.startDueStudyButton = page.locator('button').filter({ has: page.locator('svg').filter({ hasText: '' }) }).nth(0);
    // 使用 Play 图标定位"自由练习"按钮
    this.startAllStudyButton = page.locator('button').filter({ has: page.locator('svg').filter({ hasText: '' }) }).nth(1);
    
    // 答题模式
    this.quizContainer = page.locator('[class*="perspective-1000"]');
    this.questionText = page.locator('div:has(> h3:has-text("问题"))');
    this.answerText = page.locator('div:has(> h3:has-text("标准答案"))');
    this.explanationText = page.locator('div:has(> h4:has-text("题目解析"))');
    this.showAnswerButton = page.locator('button:has-text("显示答案")');
    this.optionsContainer = page.locator('[class*="flex flex-col gap-2"]');
    this.optionButton = page.locator('button[class*="rounded-xl border"]');
    
    // 评分按钮
    this.ratingButtons = page.locator('div:has(> h4:has-text("评价记忆程度"))');
    this.rateAgainButton = page.locator('button:has-text("重来")');
    this.rateHardButton = page.locator('button:has-text("困难")');
    this.rateGoodButton = page.locator('button:has-text("良好")');
    this.rateEasyButton = page.locator('button:has-text("简单")');
    
    // 完成状态
    this.finishScreen = page.locator('div:has(> h2:has-text("本次学习完成"))');
    this.returnToDashboardButton = page.locator('button:has-text("返回学习中心")');
    this.restartButton = page.locator('button:has-text("再练一次")');
    
    // 视图切换 - 使用布局结构定位,避免依赖文本内容
    this.viewTabs = page.locator('div.flex.p-1.rounded-lg');
    // 使用索引定位各个标签页按钮
    this.dashboardTab = this.viewTabs.locator('button').nth(0);
    this.bankTab = this.viewTabs.locator('button').nth(1);
    this.focusTab = this.viewTabs.locator('button').nth(2);
    
    // 搜索和筛选 - 使用布局结构定位
    this.searchInput = page.locator('input[placeholder*="搜索"]');
    // 使用布局结构定位筛选按钮组
    const filterButtons = page.locator('div.flex.p-1.rounded-xl');
    this.tableModeDueButton = filterButtons.locator('button').nth(0);
    this.tableModeAllButton = filterButtons.locator('button').nth(1);
    
    // 分页
    this.paginationControls = page.locator('div:has(> button:has(svg[class*="ChevronLeft"]))');
    this.prevPageButton = page.locator('button:has(svg[class*="ChevronLeft"])');
    this.nextPageButton = page.locator('button:has(svg[class*="ChevronRight"])');
    
    // 消息提示
    this.toastMessage = page.locator('[class*="toast"], [class*="message"]');
    
    // 题库管理 - 高级筛选
    this.typeFilterSelect = page.locator('select').first();
    this.advancedFilterButton = page.locator('button[title="高级筛选"]');
    this.reviewCountMinInput = page.locator('input[type="number"]').first();
    this.reviewCountMaxInput = page.locator('input[type="number"]').nth(1);
    this.nextReviewStartInput = page.locator('input[type="date"]').first();
    this.nextReviewEndInput = page.locator('input[type="date"]').nth(1);
    
    // 统计卡片 - 已在上方定义,这里删除重复定义
    // this.streakDaysStat = page.locator('p:has-text("连续学习")').locator('..').locator('p').nth(1);
    // this.weeklyStudyTimeStat = page.locator('p:has-text("本周学习")').locator('..').locator('p').nth(1);
    this.newCardsStat = page.locator('text=新卡片').locator('..');
    this.learningCardsStat = page.locator('text=学习中').locator('..');
    this.reviewCardsStat = page.locator('text=复习中').locator('..');
    this.relearningCardsStat = page.locator('text=重学中').locator('..');
    
    // 薄弱知识点和预测 - 使用布局结构定位,避免依赖文本内容
    // 使用 AlertTriangle 图标定位薄弱知识点区域
    this.weakPointsSection = page.locator('div').filter({ has: page.locator('svg').filter({ hasText: '' }) }).filter({ hasText: /薄弱知识点|Weak Points/ });
    // 使用 TrendingUp 图标定位未来7天预测区域
    this.predictionsSection = page.locator('div').filter({ has: page.locator('svg').filter({ hasText: '' }) }).filter({ hasText: /未来7天预测|Predictions/ });
    
    // 完成界面统计
    this.finishStatsSection = page.locator('div:has(> h2:has-text("本次学习完成"))');
    this.finishCorrectRate = page.locator('text=正确率').locator('..').locator('span');
    this.finishTotalCards = page.locator('text=已学习').locator('..').locator('span');

    // 移动端专用选择器 - 考虑响应式布局差异
    // 移动端的视图标签可能在不同的容器中
    this.mobileViewTabs = page.locator('div.flex.p-1.rounded-lg, div.flex.p-1.rounded-md');
    // 移动端的搜索框可能有不同的样式
    this.mobileSearchInput = page.locator('input[placeholder*="搜索"], input[placeholder*="search"]');
    // 移动端的统计卡片可能在单列布局中
    this.mobileStatCards = page.locator('div.p-3.rounded-xl');
  }

  /**
   * 导航到学习页面
   */
  async goto() {
    await this.page.goto('/study');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * 导航到特定图谱的学习页面
   */
  async gotoGraphStudy(graphId: string) {
    await this.page.goto(`/study?graph_id=${graphId}`);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * 导航到特定节点的学习页面
   */
  async gotoNodeStudy(nodeId: string) {
    await this.page.goto(`/study?node_id=${nodeId}`);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * 获取卡片数量
   */
  async getCardCount() {
    return await this.cardItem.count();
  }

  /**
   * 点击开始待复习卡片学习
   */
  async clickStartDueStudy() {
    await this.startDueStudyButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * 点击开始全部卡片学习
   */
  async clickStartAllStudy() {
    await this.startAllStudyButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * 点击返回按钮
   */
  async clickBack() {
    await this.backButton.click();
  }

  /**
   * 点击显示答案
   */
  async clickShowAnswer() {
    await this.showAnswerButton.click();
  }

  /**
   * 选择选项（单选题、判断题）
   */
  async selectOption(optionText: string) {
    await this.page.locator(`button:has-text("${optionText}")`).first().click();
  }

  /**
   * 选择选项（按索引）
   */
  async selectOptionByIndex(index: number) {
    const options = this.optionButton;
    await options.nth(index).click();
  }

  /**
   * 评分：重来
   */
  async rateAgain() {
    await this.rateAgainButton.click();
  }

  /**
   * 评分：困难
   */
  async rateHard() {
    await this.rateHardButton.click();
  }

  /**
   * 评分：良好
   */
  async rateGood() {
    await this.rateGoodButton.click();
  }

  /**
   * 评分：简单
   */
  async rateEasy() {
    await this.rateEasyButton.click();
  }

  /**
   * 返回学习中心
   */
  async returnToDashboard() {
    await this.returnToDashboardButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * 重新开始练习
   */
  async restart() {
    await this.restartButton.click();
  }

  /**
   * 切换到题库管理视图
   */
  async switchToBankView() {
    await this.bankTab.click();
  }

  /**
   * 切换到专注统计视图
   */
  async switchToFocusView() {
    await this.focusTab.click();
  }

  /**
   * 切换到概览视图
   */
  async switchToDashboardView() {
    await this.dashboardTab.click();
  }

  /**
   * 搜索卡片 - 支持响应式布局
   */
  async searchCards(query: string) {
    const searchInput = await this.getSearchInput();
    await searchInput.fill(query);
    await this.page.waitForTimeout(300); // 等待搜索结果更新
  }

  /**
   * 切换到待复习模式
   */
  async switchToDueMode() {
    await this.tableModeDueButton.click();
  }

  /**
   * 切换到全部模式
   */
  async switchToAllMode() {
    await this.tableModeAllButton.click();
  }

  /**
   * 切换主题
   */
  async toggleTheme() {
    const themeButton = this.page.locator('button[title*="主题"], button[title*="theme"], [data-testid="theme-toggle"]');
    await themeButton.click();
  }

  /**
   * 等待答题模式加载
   */
  async waitForQuizMode() {
    await this.quizContainer.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * 等待完成界面显示
   */
  async waitForFinishScreen() {
    await this.finishScreen.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * 获取当前卡片进度文本
   */
  async getCurrentProgressText() {
    const progressBadge = this.page.locator('span:has-text("/")');
    return await progressBadge.textContent();
  }

  /**
   * 检查是否有待复习卡片
   */
  async hasDueCards() {
    const dueButton = this.startDueStudyButton;
    const isDisabled = await dueButton.isDisabled();
    return !isDisabled;
  }

  /**
   * 检查是否有任何卡片
   */
  async hasAnyCards() {
    const allButton = this.startAllStudyButton;
    const isDisabled = await allButton.isDisabled();
    return !isDisabled;
  }

  /**
   * 获取统计卡片数值
   */
  async getStatValue(statName: 'total' | 'mastered' | 'due' | 'streak' | 'weeklyTime'): Promise<string> {
    let locator: Locator;
    switch (statName) {
      case 'total':
        locator = this.totalCardsStat;
        break;
      case 'mastered':
        locator = this.masteredCardsStat;
        break;
      case 'due':
        locator = this.dueCardsStat;
        break;
      case 'streak':
        locator = this.streakDaysStat;
        break;
      case 'weeklyTime':
        locator = this.weeklyStudyTimeStat;
        break;
    }
    return await locator.textContent() || '0';
  }

  /**
   * 获取 FSRS 状态分布
   */
  async getFSRSDistribution(): Promise<{ new: number; learning: number; review: number; relearning: number }> {
    const getText = async (locator: Locator) => {
      const text = await locator.textContent() || '0';
      return parseInt(text.replace(/\D/g, '')) || 0;
    };
    
    return {
      new: await getText(this.newCardsStat),
      learning: await getText(this.learningCardsStat),
      review: await getText(this.reviewCardsStat),
      relearning: await getText(this.relearningCardsStat)
    };
  }

  /**
   * 在题库管理中按类型筛选
   */
  async filterByType(type: 'all' | 'qa' | 'choice' | 'multi_choice' | 'true_false' | 'fill_in_the_blank') {
    await this.switchToBankView();
    await this.page.waitForTimeout(500);
    
    const select = this.page.locator('select').first();
    await select.selectOption(type);
    await this.page.waitForTimeout(300);
  }

  /**
   * 打开高级筛选
   */
  async openAdvancedFilters() {
    const filterBtn = this.page.locator('button[title="高级筛选"]');
    const isVisible = await filterBtn.isVisible().catch(() => false);
    if (isVisible) {
      await filterBtn.click();
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * 设置复习次数筛选范围
   */
  async setReviewCountRange(min: number, max: number) {
    const minInput = this.page.locator('input[type="number"]').first();
    const maxInput = this.page.locator('input[type="number"]').nth(1);
    
    await minInput.fill(min.toString());
    await maxInput.fill(max.toString());
    await this.page.waitForTimeout(300);
  }

  /**
   * 设置下次复习日期范围
   */
  async setNextReviewDateRange(startDate: string, endDate: string) {
    const startInput = this.page.locator('input[type="date"]').first();
    const endInput = this.page.locator('input[type="date"]').nth(1);
    
    await startInput.fill(startDate);
    await endInput.fill(endDate);
    await this.page.waitForTimeout(300);
  }

  /**
   * 清空搜索 - 支持响应式布局
   */
  async clearSearch() {
    const searchInput = await this.getSearchInput();
    await searchInput.clear();
    await this.page.waitForTimeout(300);
  }

  /**
   * 获取当前卡片的问题文本
   */
  async getCurrentQuestionText(): Promise<string> {
    const questionLocator = this.page.locator('h3:has-text("问题")').locator('..').locator('div').nth(1);
    return await questionLocator.textContent() || '';
  }

  /**
   * 获取当前卡片的答案文本
   */
  async getCurrentAnswerText(): Promise<string> {
    const answerLocator = this.page.locator('h3:has-text("标准答案")').locator('..').locator('div').nth(1);
    return await answerLocator.textContent() || '';
  }

  /**
   * 获取完成界面的统计数据
   */
  async getFinishStats(): Promise<{ correctRate: string; totalCards: string }> {
    const correctRateText = await this.finishCorrectRate.textContent() || '0%';
    const totalCardsText = await this.finishTotalCards.textContent() || '0';
    return {
      correctRate: correctRateText,
      totalCards: totalCardsText
    };
  }

  /**
   * 等待卡片加载完成
   */
  async waitForCardsToLoad() {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForSelector('[class*="group relative rounded"], text=没有找到匹配的卡片', { timeout: 10000 });
  }

  /**
   * 获取可见卡片数量
   */
  async getVisibleCardCount(): Promise<number> {
    return await this.cardItem.count();
  }

  /**
   * 点击卡片预览
   */
  async clickCardPreview(index: number = 0) {
    const card = this.cardItem.nth(index);
    await card.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * 获取薄弱知识点列表
   */
  async getWeakPoints(): Promise<string[]> {
    const weakPoints = this.weakPointsSection.locator('[class*="rounded"]');
    const count = await weakPoints.count();
    const points: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await weakPoints.nth(i).textContent();
      if (text) points.push(text);
    }
    return points;
  }

  /**
   * 获取未来7天预测数据
   */
  async getPredictions(): Promise<{ date: string; count: number }[]> {
    const predictions: { date: string; count: number }[] = [];
    const predictionItems = this.predictionsSection.locator('[class*="flex items-center"]');
    const count = await predictionItems.count();
    
    for (let i = 0; i < count; i++) {
      const text = await predictionItems.nth(i).textContent();
      if (text) {
        predictions.push({
          date: text.split(':')[0] || '',
          count: parseInt(text.replace(/\D/g, '')) || 0
        });
      }
    }
    return predictions;
  }

  /**
   * 完成一张卡片的评分流程
   */
  async completeCardRating(quality: 'again' | 'hard' | 'good' | 'easy') {
    const showAnswerBtn = this.showAnswerButton;
    const hasShowAnswerBtn = await showAnswerBtn.isVisible().catch(() => false);
    
    if (hasShowAnswerBtn) {
      await this.clickShowAnswer();
    } else {
      const optionButtons = this.page.locator('button[class*="rounded-xl border"][class*="cursor-pointer"]');
      const hasOptions = await optionButtons.count() > 0;
      if (hasOptions) {
        await optionButtons.first().click();
      }
    }
    
    await this.page.waitForTimeout(300);
    
    switch (quality) {
      case 'again':
        await this.rateAgain();
        break;
      case 'hard':
        await this.rateHard();
        break;
      case 'good':
        await this.rateGood();
        break;
      case 'easy':
        await this.rateEasy();
        break;
    }
    
    await this.page.waitForTimeout(500);
  }

  /**
   * 获取当前卡片的下次复习时间提示
   */
  async getNextReviewHint(): Promise<string | null> {
    const hintLocator = this.page.locator('[class*="text-xs"][class*="text-"]').filter({ hasText: /天|小时|分钟/ });
    const count = await hintLocator.count();
    if (count > 0) {
      return await hintLocator.first().textContent();
    }
    return null;
  }

  /**
   * 检查是否为移动端视图
   */
  async isMobileView(): Promise<boolean> {
    const viewport = this.page.viewportSize();
    return viewport ? viewport.width < 768 : false;
  }

  /**
   * 获取适合当前设备的视图标签选择器
   */
  async getViewTabs(): Promise<Locator> {
    const isMobile = await this.isMobileView();
    return isMobile ? this.mobileViewTabs : this.viewTabs;
  }

  /**
   * 获取适合当前设备的搜索框选择器
   */
  async getSearchInput(): Promise<Locator> {
    const isMobile = await this.isMobileView();
    return isMobile ? this.mobileSearchInput : this.searchInput;
  }
}
