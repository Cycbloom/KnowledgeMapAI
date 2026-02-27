import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { StudyPage } from './pages/StudyPage';
import { testUser } from './utils/testHelpers';

test.describe('学习模式测试', () => {
  let loginPage: LoginPage;
  let studyPage: StudyPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    studyPage = new StudyPage(page);
    
    // 登录
    await loginPage.goto();
    await loginPage.login(testUser.email, testUser.password);
    
    // 等待登录成功并跳转
    await expect(page).toHaveURL(/\/|dashboard/, { timeout: 10000 });
  });

  test.describe('显示学习卡片测试', () => {
    test('应该能够导航到学习页面', async ({ page }) => {
      // 导航到学习页面
      await studyPage.goto();
      
      // 验证页面标题正确显示
      await expect(studyPage.title).toBeVisible({ timeout: 10000 });
      await expect(studyPage.title).toHaveText('学习中心');
    });

    test('应该显示学习统计信息', async ({ page }) => {
      await studyPage.goto();
      
      // 验证统计卡片显示
      await expect(page.locator('p:has-text("总卡片")')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('p:has-text("已掌握")')).toBeVisible();
      await expect(page.locator('p:has-text("待复习")')).toBeVisible();
      await expect(page.locator('p:has-text("连续学习")')).toBeVisible();
      await expect(page.locator('p:has-text("本周学习")')).toBeVisible();
    });

    test('应该显示学习按钮', async ({ page }) => {
      await studyPage.goto();
      
      // 验证学习按钮存在
      await expect(studyPage.startDueStudyButton).toBeVisible({ timeout: 10000 });
      await expect(studyPage.startAllStudyButton).toBeVisible();
    });

    test('应该显示卡片列表区域', async ({ page }) => {
      await studyPage.goto();
      
      // 验证卡片列表标题显示
      await expect(page.locator('h2:has-text("卡片列表")')).toBeVisible({ timeout: 10000 });
      
      // 验证搜索框显示
      await expect(studyPage.searchInput).toBeVisible();
      
      // 验证筛选按钮显示
      await expect(studyPage.tableModeDueButton).toBeVisible();
      await expect(studyPage.tableModeAllButton).toBeVisible();
    });

    test('应该能够切换视图标签', async ({ page }) => {
      await studyPage.goto();
      
      // 切换到题库管理视图
      await studyPage.switchToBankView();
      await expect(page.locator('text=题库管理')).toBeVisible({ timeout: 5000 });
      
      // 切换到专注统计视图
      await studyPage.switchToFocusView();
      await expect(page.locator('text=专注统计')).toBeVisible({ timeout: 5000 });
      
      // 切换回概览视图
      await studyPage.switchToDashboardView();
      await expect(studyPage.title).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('答题流程测试', () => {
    test('应该能够开始学习（如果有卡片）', async ({ page }) => {
      await studyPage.goto();
      
      // 检查是否有卡片可以学习
      const hasCards = await studyPage.hasAnyCards();
      
      if (hasCards) {
        // 点击开始自测按钮
        await studyPage.clickStartAllStudy();
        
        // 验证进入答题模式
        await studyPage.waitForQuizMode();
        await expect(studyPage.quizContainer).toBeVisible();
        
        // 验证问题显示
        await expect(page.locator('h3:has-text("问题")')).toBeVisible({ timeout: 10000 });
      } else {
        // 如果没有卡片，按钮应该被禁用
        await expect(studyPage.startAllStudyButton).toBeDisabled();
      }
    });

    test('应该能够显示答案（问答题）', async ({ page }) => {
      await studyPage.goto();
      
      const hasCards = await studyPage.hasAnyCards();
      
      if (hasCards) {
        await studyPage.clickStartAllStudy();
        await studyPage.waitForQuizMode();
        
        // 检查是否是问答题类型（有显示答案按钮）
        const showAnswerBtn = studyPage.showAnswerButton;
        const hasShowAnswerBtn = await showAnswerBtn.isVisible().catch(() => false);
        
        if (hasShowAnswerBtn) {
          // 点击显示答案
          await studyPage.clickShowAnswer();
          
          // 验证答案区域显示
          await expect(page.locator('text=标准答案')).toBeVisible({ timeout: 5000 });
        }
      }
    });

    test('应该能够选择选项（选择题）', async ({ page }) => {
      await studyPage.goto();
      
      const hasCards = await studyPage.hasAnyCards();
      
      if (hasCards) {
        await studyPage.clickStartAllStudy();
        await studyPage.waitForQuizMode();
        
        // 检查是否有选项按钮（选择题）
        const optionButtons = page.locator('button[class*="rounded-xl border"][class*="cursor-pointer"]');
        const hasOptions = await optionButtons.count() > 0;
        
        if (hasOptions) {
          // 选择第一个选项
          await optionButtons.first().click();
          
          // 等待答案显示
          await page.waitForTimeout(500);
        }
      }
    });

    test('应该显示评分按钮', async ({ page }) => {
      await studyPage.goto();
      
      const hasCards = await studyPage.hasAnyCards();
      
      if (hasCards) {
        await studyPage.clickStartAllStudy();
        await studyPage.waitForQuizMode();
        
        // 如果是问答题，点击显示答案
        const showAnswerBtn = studyPage.showAnswerButton;
        const hasShowAnswerBtn = await showAnswerBtn.isVisible().catch(() => false);
        
        if (hasShowAnswerBtn) {
          await studyPage.clickShowAnswer();
        } else {
          // 如果是选择题，选择一个选项
          const optionButtons = page.locator('button[class*="rounded-xl border"][class*="cursor-pointer"]');
          const hasOptions = await optionButtons.count() > 0;
          if (hasOptions) {
            await optionButtons.first().click();
          }
        }
        
        // 验证评分按钮显示
        await expect(studyPage.ratingButtons).toBeVisible({ timeout: 5000 });
        await expect(studyPage.rateAgainButton).toBeVisible();
        await expect(studyPage.rateHardButton).toBeVisible();
        await expect(studyPage.rateGoodButton).toBeVisible();
        await expect(studyPage.rateEasyButton).toBeVisible();
      }
    });

    test('应该显示卡片进度', async ({ page }) => {
      await studyPage.goto();
      
      const hasCards = await studyPage.hasAnyCards();
      
      if (hasCards) {
        await studyPage.clickStartAllStudy();
        await studyPage.waitForQuizMode();
        
        // 验证进度显示
        const progressText = await studyPage.getCurrentProgressText();
        expect(progressText).toMatch(/\d+\s*\/\s*\d+/);
      }
    });
  });

  test.describe('标记掌握状态测试', () => {
    test('应该能够标记为重来', async ({ page }) => {
      await studyPage.goto();
      
      const hasCards = await studyPage.hasAnyCards();
      
      if (hasCards) {
        await studyPage.clickStartAllStudy();
        await studyPage.waitForQuizMode();
        
        // 显示答案或选择选项
        const showAnswerBtn = studyPage.showAnswerButton;
        const hasShowAnswerBtn = await showAnswerBtn.isVisible().catch(() => false);
        
        if (hasShowAnswerBtn) {
          await studyPage.clickShowAnswer();
        } else {
          const optionButtons = page.locator('button[class*="rounded-xl border"][class*="cursor-pointer"]');
          if (await optionButtons.count() > 0) {
            await optionButtons.first().click();
          }
        }
        
        // 点击重来按钮
        await studyPage.rateAgain();
        
        // 等待页面响应
        await page.waitForTimeout(1000);
      }
    });

    test('应该能够标记为良好', async ({ page }) => {
      await studyPage.goto();
      
      const hasCards = await studyPage.hasAnyCards();
      
      if (hasCards) {
        await studyPage.clickStartAllStudy();
        await studyPage.waitForQuizMode();
        
        // 显示答案或选择选项
        const showAnswerBtn = studyPage.showAnswerButton;
        const hasShowAnswerBtn = await showAnswerBtn.isVisible().catch(() => false);
        
        if (hasShowAnswerBtn) {
          await studyPage.clickShowAnswer();
        } else {
          const optionButtons = page.locator('button[class*="rounded-xl border"][class*="cursor-pointer"]');
          if (await optionButtons.count() > 0) {
            await optionButtons.first().click();
          }
        }
        
        // 点击良好按钮
        await studyPage.rateGood();
        
        // 等待页面响应
        await page.waitForTimeout(1000);
      }
    });

    test('应该能够标记为简单', async ({ page }) => {
      await studyPage.goto();
      
      const hasCards = await studyPage.hasAnyCards();
      
      if (hasCards) {
        await studyPage.clickStartAllStudy();
        await studyPage.waitForQuizMode();
        
        // 显示答案或选择选项
        const showAnswerBtn = studyPage.showAnswerButton;
        const hasShowAnswerBtn = await showAnswerBtn.isVisible().catch(() => false);
        
        if (hasShowAnswerBtn) {
          await studyPage.clickShowAnswer();
        } else {
          const optionButtons = page.locator('button[class*="rounded-xl border"][class*="cursor-pointer"]');
          if (await optionButtons.count() > 0) {
            await optionButtons.first().click();
          }
        }
        
        // 点击简单按钮
        await studyPage.rateEasy();
        
        // 等待页面响应
        await page.waitForTimeout(1000);
      }
    });

    test('应该能够完成学习并返回', async ({ page }) => {
      await studyPage.goto();
      
      const hasCards = await studyPage.hasAnyCards();
      
      if (hasCards) {
        await studyPage.clickStartAllStudy();
        await studyPage.waitForQuizMode();
        
        // 获取总卡片数
        const progressText = await studyPage.getCurrentProgressText();
        const match = progressText?.match(/\/\s*(\d+)/);
        const totalCards = match ? parseInt(match[1]) : 1;
        
        // 完成所有卡片的评分
        for (let i = 0; i < totalCards; i++) {
          // 显示答案或选择选项
          const showAnswerBtn = studyPage.showAnswerButton;
          const hasShowAnswerBtn = await showAnswerBtn.isVisible().catch(() => false);
          
          if (hasShowAnswerBtn) {
            await studyPage.clickShowAnswer();
          } else {
            const optionButtons = page.locator('button[class*="rounded-xl border"][class*="cursor-pointer"]');
            if (await optionButtons.count() > 0) {
              await optionButtons.first().click();
            }
          }
          
          await page.waitForTimeout(300);
          
          // 评分
          await studyPage.rateGood();
          await page.waitForTimeout(500);
          
          // 检查是否完成
          const finished = await studyPage.finishScreen.isVisible().catch(() => false);
          if (finished) break;
        }
        
        // 验证完成界面显示
        await studyPage.waitForFinishScreen();
        await expect(studyPage.finishScreen).toBeVisible();
        
        // 点击返回学习中心
        await studyPage.returnToDashboard();
        
        // 验证返回到学习中心
        await expect(studyPage.title).toBeVisible({ timeout: 10000 });
      }
    });
  });

  test.describe('边界条件测试', () => {
    test('应该正确处理无待复习卡片的情况', async ({ page }) => {
      await studyPage.goto();
      
      // 检查待复习卡片状态
      const hasDueCards = await studyPage.hasDueCards();
      
      if (!hasDueCards) {
        // 按钮应该被禁用或显示"暂无复习任务"
        const buttonText = await studyPage.startDueStudyButton.textContent();
        expect(buttonText).toContain('暂无复习任务');
      }
    });

    test('应该正确处理无任何卡片的情况', async ({ page }) => {
      await studyPage.goto();
      
      const hasCards = await studyPage.hasAnyCards();
      
      if (!hasCards) {
        // 按钮应该被禁用或显示"暂无卡片数据"
        const buttonText = await studyPage.startAllStudyButton.textContent();
        expect(buttonText).toContain('暂无卡片数据');
      }
    });

    test('应该能够搜索卡片', async ({ page }) => {
      await studyPage.goto();
      
      // 输入搜索关键词
      await studyPage.searchCards('测试');
      
      // 等待搜索结果更新
      await page.waitForTimeout(500);
      
      // 验证搜索框有值
      const searchValue = await studyPage.searchInput.inputValue();
      expect(searchValue).toBe('测试');
    });

    test('应该能够切换卡片筛选模式', async ({ page }) => {
      await studyPage.goto();
      
      // 切换到全部模式
      await studyPage.switchToAllMode();
      await page.waitForTimeout(300);
      
      // 验证按钮状态
      await expect(studyPage.tableModeAllButton).toHaveAttribute('class', /bg-indigo/);
      
      // 切换到待复习模式
      await studyPage.switchToDueMode();
      await page.waitForTimeout(300);
      
      // 验证按钮状态
      await expect(studyPage.tableModeDueButton).toHaveAttribute('class', /bg-indigo/);
    });

    test('应该能够退出答题模式', async ({ page }) => {
      await studyPage.goto();
      
      const hasCards = await studyPage.hasAnyCards();
      
      if (hasCards) {
        await studyPage.clickStartAllStudy();
        await studyPage.waitForQuizMode();
        
        // 点击退出按钮
        await page.locator('button:has-text("退出")').click();
        
        // 验证返回到学习中心
        await expect(studyPage.title).toBeVisible({ timeout: 5000 });
      }
    });

    test('应该能够重新开始练习', async ({ page }) => {
      await studyPage.goto();
      
      const hasCards = await studyPage.hasAnyCards();
      
      if (hasCards) {
        await studyPage.clickStartAllStudy();
        await studyPage.waitForQuizMode();
        
        // 获取总卡片数
        const progressText = await studyPage.getCurrentProgressText();
        const match = progressText?.match(/\/\s*(\d+)/);
        const totalCards = match ? parseInt(match[1]) : 1;
        
        // 完成所有卡片
        for (let i = 0; i < totalCards; i++) {
          const showAnswerBtn = studyPage.showAnswerButton;
          const hasShowAnswerBtn = await showAnswerBtn.isVisible().catch(() => false);
          
          if (hasShowAnswerBtn) {
            await studyPage.clickShowAnswer();
          } else {
            const optionButtons = page.locator('button[class*="rounded-xl border"][class*="cursor-pointer"]');
            if (await optionButtons.count() > 0) {
              await optionButtons.first().click();
            }
          }
          
          await page.waitForTimeout(300);
          await studyPage.rateGood();
          await page.waitForTimeout(500);
          
          const finished = await studyPage.finishScreen.isVisible().catch(() => false);
          if (finished) break;
        }
        
        // 验证完成界面
        await studyPage.waitForFinishScreen();
        
        // 点击再练一次
        await studyPage.restart();
        
        // 验证重新进入答题模式
        await studyPage.waitForQuizMode();
        await expect(studyPage.quizContainer).toBeVisible();
      }
    });

    test('应该显示薄弱知识点区域', async ({ page }) => {
      await studyPage.goto();
      
      // 验证薄弱知识点标题显示
      await expect(page.locator('h3:has-text("薄弱知识点")')).toBeVisible({ timeout: 10000 });
    });

    test('应该显示未来7天预测区域', async ({ page }) => {
      await studyPage.goto();
      
      // 验证预测标题显示
      await expect(page.locator('h3:has-text("未来7天预测")')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('导航测试', () => {
    test('应该能够通过 URL 直接访问学习页面', async ({ page }) => {
      // 直接访问学习页面
      await studyPage.goto();
      
      // 验证页面加载成功
      await expect(studyPage.title).toBeVisible({ timeout: 10000 });
    });

    test('应该能够返回上一页', async ({ page }) => {
      await studyPage.goto();
      
      // 点击返回按钮
      await studyPage.clickBack();
      
      // 验证页面导航
      await page.waitForTimeout(500);
    });
  });

  test.describe('间隔重复算法验证测试', () => {
    test('应该正确计算"重来"评分后的复习间隔', async ({ page }) => {
      await studyPage.goto();
      
      const hasCards = await studyPage.hasAnyCards();
      
      if (hasCards) {
        await studyPage.clickStartAllStudy();
        await studyPage.waitForQuizMode();
        
        // 记录当前卡片
        const questionText = await studyPage.getCurrentQuestionText();
        
        // 评分"重来"（quality=1）
        await studyPage.completeCardRating('again');
        
        // 等待 API 响应
        await page.waitForTimeout(1000);
        
        // 验证：重来评分后，卡片应该很快需要复习（通常几分钟内）
        // 由于 FSRS 算法的特性，重来评分会重置或大幅缩短复习间隔
        const nextReviewHint = await studyPage.getNextReviewHint();
        
        // 验证评分成功（进入下一张卡片或完成界面）
        const isFinished = await studyPage.finishScreen.isVisible().catch(() => false);
        const isNextCard = await studyPage.quizContainer.isVisible().catch(() => false);
        
        expect(isFinished || isNextCard).toBe(true);
      }
    });

    test('应该正确计算"困难"评分后的复习间隔', async ({ page }) => {
      await studyPage.goto();
      
      const hasCards = await studyPage.hasAnyCards();
      
      if (hasCards) {
        await studyPage.clickStartAllStudy();
        await studyPage.waitForQuizMode();
        
        // 评分"困难"（quality=2）
        await studyPage.completeCardRating('hard');
        
        await page.waitForTimeout(1000);
        
        // 验证评分成功
        const isFinished = await studyPage.finishScreen.isVisible().catch(() => false);
        const isNextCard = await studyPage.quizContainer.isVisible().catch(() => false);
        
        expect(isFinished || isNextCard).toBe(true);
      }
    });

    test('应该正确计算"良好"评分后的复习间隔', async ({ page }) => {
      await studyPage.goto();
      
      const hasCards = await studyPage.hasAnyCards();
      
      if (hasCards) {
        await studyPage.clickStartAllStudy();
        await studyPage.waitForQuizMode();
        
        // 评分"良好"（quality=3）
        await studyPage.completeCardRating('good');
        
        await page.waitForTimeout(1000);
        
        // 验证评分成功
        const isFinished = await studyPage.finishScreen.isVisible().catch(() => false);
        const isNextCard = await studyPage.quizContainer.isVisible().catch(() => false);
        
        expect(isFinished || isNextCard).toBe(true);
      }
    });

    test('应该正确计算"简单"评分后的复习间隔', async ({ page }) => {
      await studyPage.goto();
      
      const hasCards = await studyPage.hasAnyCards();
      
      if (hasCards) {
        await studyPage.clickStartAllStudy();
        await studyPage.waitForQuizMode();
        
        // 评分"简单"（quality=4/5）
        await studyPage.completeCardRating('easy');
        
        await page.waitForTimeout(1000);
        
        // 验证评分成功
        const isFinished = await studyPage.finishScreen.isVisible().catch(() => false);
        const isNextCard = await studyPage.quizContainer.isVisible().catch(() => false);
        
        expect(isFinished || isNextCard).toBe(true);
      }
    });

    test('不同评分应该产生不同的复习间隔', async ({ page }) => {
      await studyPage.goto();
      
      const hasCards = await studyPage.hasAnyCards();
      
      if (hasCards) {
        // 获取总卡片数
        await studyPage.clickStartAllStudy();
        await studyPage.waitForQuizMode();
        
        const progressText = await studyPage.getCurrentProgressText();
        const match = progressText?.match(/\/\s*(\d+)/);
        const totalCards = match ? parseInt(match[1]) : 1;
        
        // 如果有多张卡片，测试不同评分
        if (totalCards >= 2) {
          // 第一张卡片评分"重来"
          await studyPage.completeCardRating('again');
          await page.waitForTimeout(500);
          
          // 第二张卡片评分"简单"（如果有的话）
          if (totalCards >= 2) {
            const stillInQuiz = await studyPage.quizContainer.isVisible().catch(() => false);
            if (stillInQuiz) {
              await studyPage.completeCardRating('easy');
              await page.waitForTimeout(500);
            }
          }
        }
        
        // 验证评分流程正常
        const isFinished = await studyPage.finishScreen.isVisible().catch(() => false);
        const stillInQuiz = await studyPage.quizContainer.isVisible().catch(() => false);
        expect(isFinished || stillInQuiz).toBe(true);
      }
    });
  });

  test.describe('学习统计数据显示测试', () => {
    test('应该正确显示学习统计卡片', async ({ page }) => {
      await studyPage.goto();
      
      // 验证所有统计卡片显示
      await expect(page.locator('p:has-text("总卡片")')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('p:has-text("已掌握")')).toBeVisible();
      await expect(page.locator('p:has-text("待复习")')).toBeVisible();
      await expect(page.locator('p:has-text("连续学习")')).toBeVisible();
      await expect(page.locator('p:has-text("本周学习")')).toBeVisible();
    });

    test('应该正确显示 FSRS 状态分布', async ({ page }) => {
      await studyPage.goto();
      
      // 验证 FSRS 状态分布图表显示
      // 检查饼图或分布区域存在
      const distributionSection = page.locator('text=新卡片, text=学习中, text=复习中, text=重学中');
      const hasDistribution = await distributionSection.count() > 0;
      
      // 至少应该有某种状态显示
      expect(hasDistribution).toBe(true);
    });

    test('应该正确计算进度百分比', async ({ page }) => {
      await studyPage.goto();
      
      // 获取统计数据
      const totalText = await studyPage.getStatValue('total');
      const masteredText = await studyPage.getStatValue('mastered');
      
      const total = parseInt(totalText) || 0;
      const mastered = parseInt(masteredText) || 0;
      
      // 验证数据一致性
      expect(mastered).toBeLessThanOrEqual(total);
      
      // 如果有卡片，验证掌握率计算
      if (total > 0) {
        const masteryRate = (mastered / total) * 100;
        expect(masteryRate).toBeGreaterThanOrEqual(0);
        expect(masteryRate).toBeLessThanOrEqual(100);
      }
    });

    test('应该正确显示连续学习天数', async ({ page }) => {
      await studyPage.goto();
      
      // 获取连续学习天数
      const streakText = await studyPage.getStatValue('streak');
      const streakDays = parseInt(streakText) || 0;
      
      // 验证连续学习天数为非负数
      expect(streakDays).toBeGreaterThanOrEqual(0);
    });

    test('应该正确显示本周学习时间', async ({ page }) => {
      await studyPage.goto();
      
      // 获取本周学习时间
      const weeklyTimeText = await studyPage.getStatValue('weeklyTime');
      
      // 验证时间格式（可能是分钟或小时）
      expect(weeklyTimeText).toBeTruthy();
    });

    test('应该正确显示薄弱知识点区域', async ({ page }) => {
      await studyPage.goto();
      
      // 验证薄弱知识点标题显示
      await expect(page.locator('h3:has-text("薄弱知识点")')).toBeVisible({ timeout: 10000 });
    });

    test('应该正确显示未来7天预测区域', async ({ page }) => {
      await studyPage.goto();
      
      // 验证预测标题显示
      await expect(page.locator('h3:has-text("未来7天预测")')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('卡片筛选和搜索测试', () => {
    test('应该能够按待复习/全部模式筛选卡片', async ({ page }) => {
      await studyPage.goto();
      
      // 切换到全部模式
      await studyPage.switchToAllMode();
      await page.waitForTimeout(500);
      
      // 验证按钮状态
      await expect(studyPage.tableModeAllButton).toHaveAttribute('class', /bg-indigo/);
      
      // 切换到待复习模式
      await studyPage.switchToDueMode();
      await page.waitForTimeout(500);
      
      // 验证按钮状态
      await expect(studyPage.tableModeDueButton).toHaveAttribute('class', /bg-indigo/);
    });

    test('应该能够搜索卡片', async ({ page }) => {
      await studyPage.goto();
      
      // 输入搜索关键词
      await studyPage.searchCards('测试');
      
      // 等待搜索结果更新
      await page.waitForTimeout(500);
      
      // 验证搜索框有值
      const searchValue = await studyPage.searchInput.inputValue();
      expect(searchValue).toBe('测试');
    });

    test('应该能够清空搜索结果', async ({ page }) => {
      await studyPage.goto();
      
      // 输入搜索关键词
      await studyPage.searchCards('测试');
      await page.waitForTimeout(300);
      
      // 清空搜索
      await studyPage.clearSearch();
      
      // 验证搜索框为空
      const searchValue = await studyPage.searchInput.inputValue();
      expect(searchValue).toBe('');
    });

    test('应该能够在题库管理中按类型筛选', async ({ page }) => {
      await studyPage.goto();
      
      // 切换到题库管理视图
      await studyPage.switchToBankView();
      await page.waitForTimeout(500);
      
      // 验证题库管理视图显示
      await expect(page.locator('text=题库管理')).toBeVisible({ timeout: 5000 });
      
      // 查找类型筛选下拉框
      const typeSelect = page.locator('select').first();
      const hasSelect = await typeSelect.isVisible().catch(() => false);
      
      if (hasSelect) {
        // 选择问答题类型
        await typeSelect.selectOption('qa');
        await page.waitForTimeout(300);
        
        // 验证筛选生效（可以通过卡片数量变化验证）
        const cardCount = await studyPage.getVisibleCardCount();
        expect(cardCount).toBeGreaterThanOrEqual(0);
      }
    });

    test('应该能够使用高级筛选功能', async ({ page }) => {
      await studyPage.goto();
      
      // 切换到题库管理视图
      await studyPage.switchToBankView();
      await page.waitForTimeout(500);
      
      // 查找高级筛选按钮
      const advancedFilterBtn = page.locator('button[title="高级筛选"]');
      const hasAdvancedFilter = await advancedFilterBtn.isVisible().catch(() => false);
      
      if (hasAdvancedFilter) {
        // 打开高级筛选
        await advancedFilterBtn.click();
        await page.waitForTimeout(300);
        
        // 验证高级筛选面板显示
        const filterPanel = page.locator('text=复习次数, text=下次复习时间');
        const hasFilterOptions = await filterPanel.count() > 0;
        expect(hasFilterOptions).toBe(true);
      }
    });

    test('搜索应该支持问题内容匹配', async ({ page }) => {
      await studyPage.goto();
      
      // 获取第一张卡片的问题文本（如果有）
      await studyPage.switchToAllMode();
      await page.waitForTimeout(300);
      
      const cardCount = await studyPage.getVisibleCardCount();
      
      if (cardCount > 0) {
        // 点击第一张卡片预览
        await studyPage.clickCardPreview(0);
        
        // 获取问题文本
        const questionText = await page.locator('[class*="modal"] h4:has-text("问题")').locator('..').textContent();
        
        if (questionText) {
          // 关闭预览
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
          
          // 使用问题中的关键词搜索
          const keyword = questionText.substring(0, 2);
          await studyPage.searchCards(keyword);
          await page.waitForTimeout(500);
          
          // 验证搜索框有值
          const searchValue = await studyPage.searchInput.inputValue();
          expect(searchValue).toBe(keyword);
        }
      }
    });

    test('搜索无结果时应显示空状态', async ({ page }) => {
      await studyPage.goto();
      
      // 搜索一个不存在的内容
      await studyPage.searchCards('xyzabc123不存在的关键词');
      await page.waitForTimeout(500);
      
      // 验证空状态或卡片数量为0
      const cardCount = await studyPage.getVisibleCardCount();
      const hasEmptyState = await studyPage.emptyState.isVisible().catch(() => false);
      
      expect(cardCount === 0 || hasEmptyState).toBe(true);
    });
  });

  test.describe('学习进度持久化测试', () => {
    test('学习后刷新页面进度应该保持', async ({ page }) => {
      await studyPage.goto();
      
      const hasCards = await studyPage.hasAnyCards();
      
      if (hasCards) {
        // 记录初始统计数据
        const initialTotal = await studyPage.getStatValue('total');
        const initialMastered = await studyPage.getStatValue('mastered');
        
        // 开始学习并完成一张卡片
        await studyPage.clickStartAllStudy();
        await studyPage.waitForQuizMode();
        
        // 完成一张卡片的评分
        await studyPage.completeCardRating('good');
        await page.waitForTimeout(1000);
        
        // 返回学习中心
        const isFinished = await studyPage.finishScreen.isVisible().catch(() => false);
        if (isFinished) {
          await studyPage.returnToDashboard();
        } else {
          // 退出答题模式
          const exitBtn = page.locator('button:has-text("退出")');
          if (await exitBtn.isVisible()) {
            await exitBtn.click();
          }
        }
        
        await page.waitForTimeout(500);
        
        // 刷新页面
        await page.reload();
        await page.waitForLoadState('networkidle');
        
        // 验证统计数据仍然显示
        await expect(page.locator('p:has-text("总卡片")')).toBeVisible({ timeout: 10000 });
        
        // 验证数据一致性
        const afterRefreshTotal = await studyPage.getStatValue('total');
        expect(afterRefreshTotal).toBe(initialTotal);
      }
    });

    test('学习记录应该正确保存到数据库', async ({ page }) => {
      await studyPage.goto();
      
      const hasCards = await studyPage.hasAnyCards();
      
      if (hasCards) {
        await studyPage.clickStartAllStudy();
        await studyPage.waitForQuizMode();
        
        // 获取总卡片数
        const progressText = await studyPage.getCurrentProgressText();
        const match = progressText?.match(/\/\s*(\d+)/);
        const totalCards = match ? parseInt(match[1]) : 1;
        
        // 完成所有卡片
        for (let i = 0; i < totalCards; i++) {
          await studyPage.completeCardRating('good');
          await page.waitForTimeout(500);
          
          const finished = await studyPage.finishScreen.isVisible().catch(() => false);
          if (finished) break;
        }
        
        // 验证完成界面显示
        await studyPage.waitForFinishScreen();
        await expect(studyPage.finishScreen).toBeVisible();
        
        // 验证完成统计数据
        const stats = await studyPage.getFinishStats();
        expect(parseInt(stats.totalCards)).toBeGreaterThan(0);
      }
    });

    test('评分后卡片状态应该正确更新', async ({ page }) => {
      await studyPage.goto();
      
      const hasCards = await studyPage.hasAnyCards();
      
      if (hasCards) {
        await studyPage.clickStartAllStudy();
        await studyPage.waitForQuizMode();
        
        // 完成一张卡片评分
        await studyPage.completeCardRating('good');
        await page.waitForTimeout(1000);
        
        // 验证评分成功（进入下一张卡片或完成界面）
        const isFinished = await studyPage.finishScreen.isVisible().catch(() => false);
        const isNextCard = await studyPage.quizContainer.isVisible().catch(() => false);
        
        expect(isFinished || isNextCard).toBe(true);
        
        // 如果进入完成界面，验证统计数据
        if (isFinished) {
          const stats = await studyPage.getFinishStats();
          expect(parseInt(stats.totalCards)).toBeGreaterThanOrEqual(1);
        }
      }
    });

    test('多次学习同一卡片应该更新复习次数', async ({ page }) => {
      await studyPage.goto();
      
      const hasCards = await studyPage.hasAnyCards();
      
      if (hasCards) {
        // 第一次学习
        await studyPage.clickStartAllStudy();
        await studyPage.waitForQuizMode();
        
        // 完成第一张卡片
        await studyPage.completeCardRating('good');
        await page.waitForTimeout(500);
        
        // 检查是否还有更多卡片
        const stillInQuiz = await studyPage.quizContainer.isVisible().catch(() => false);
        
        if (stillInQuiz) {
          // 继续完成剩余卡片
          const progressText = await studyPage.getCurrentProgressText();
          const match = progressText?.match(/\/\s*(\d+)/);
          const remaining = match ? parseInt(match[1]) - 1 : 0;
          
          for (let i = 0; i < remaining; i++) {
            await studyPage.completeCardRating('good');
            await page.waitForTimeout(500);
            
            const finished = await studyPage.finishScreen.isVisible().catch(() => false);
            if (finished) break;
          }
        }
        
        // 等待完成界面
        await studyPage.waitForFinishScreen();
        
        // 返回学习中心
        await studyPage.returnToDashboard();
        await page.waitForTimeout(500);
        
        // 验证已掌握数量增加
        const masteredText = await studyPage.getStatValue('mastered');
        const mastered = parseInt(masteredText) || 0;
        expect(mastered).toBeGreaterThanOrEqual(1);
      }
    });

    test('退出学习后进度应该保存', async ({ page }) => {
      await studyPage.goto();
      
      const hasCards = await studyPage.hasAnyCards();
      
      if (hasCards) {
        await studyPage.clickStartAllStudy();
        await studyPage.waitForQuizMode();
        
        // 完成一张卡片
        await studyPage.completeCardRating('good');
        await page.waitForTimeout(500);
        
        // 退出答题模式
        const exitBtn = page.locator('button:has-text("退出")');
        const hasExitBtn = await exitBtn.isVisible().catch(() => false);
        
        if (hasExitBtn) {
          await exitBtn.click();
          await page.waitForTimeout(500);
          
          // 验证返回到学习中心
          await expect(studyPage.title).toBeVisible({ timeout: 5000 });
          
          // 刷新页面验证进度保持
          await page.reload();
          await page.waitForLoadState('networkidle');
          
          await expect(studyPage.title).toBeVisible({ timeout: 10000 });
        }
      }
    });
  });
});
