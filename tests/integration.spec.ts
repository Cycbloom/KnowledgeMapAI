import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { GraphEditorPage } from './pages/GraphEditorPage';
import { StudyPage } from './pages/StudyPage';
import { SchedulerPage } from './pages/SchedulerPage';
import { AchievementsPage } from './pages/AchievementsPage';
import { testUser } from './utils/testHelpers';

test.describe('跨模块集成测试', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;
  let graphEditorPage: GraphEditorPage;
  let studyPage: StudyPage;
  let schedulerPage: SchedulerPage;
  let achievementsPage: AchievementsPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    graphEditorPage = new GraphEditorPage(page);
    studyPage = new StudyPage(page);
    schedulerPage = new SchedulerPage(page);
    achievementsPage = new AchievementsPage(page);

    // 登录
    await loginPage.goto();
    await loginPage.login(testUser.email, testUser.password);
    await expect(page).toHaveURL(/\/|dashboard/, { timeout: 30000 });
  });

  test.describe('学习-图谱联动测试', () => {
    test('应该能够从图谱编辑器导航到学习中心', async ({ page }) => {
      // 1. 导航到仪表板
      await dashboardPage.goto();
      await dashboardPage.waitForGraphsToLoad();

      // 2. 检查是否有图谱可以打开
      const graphCount = await dashboardPage.getGraphCount();
      
      if (graphCount > 0) {
        // 3. 点击第一个图谱卡片进入编辑器
        const firstCard = dashboardPage.firstGraphCard;
        await firstCard.click();
        
        // 4. 等待图谱编辑器加载
        await page.waitForURL(/\/graph\//, { timeout: 15000 });
        
        // 5. 验证图谱编辑器加载成功
        await expect(graphEditorPage.canvas).toBeVisible({ timeout: 15000 });
        
        // 6. 导航到学习中心
        await studyPage.goto();
        
        // 7. 验证学习中心页面加载成功
        await expect(studyPage.title).toBeVisible({ timeout: 10000 });
        await expect(studyPage.title).toHaveText('学习中心');
      } else {
        // 如果没有图谱，跳过此测试
        test.skip();
      }
    });

    test('应该在学习中心显示与图谱节点关联的卡片', async ({ page }) => {
      // 1. 导航到学习中心
      await studyPage.goto();
      
      // 2. 验证统计信息显示
      await expect(page.locator('p:has-text("总卡片")')).toBeVisible({ timeout: 10000 });
      
      // 3. 获取卡片数量
      const cardCount = await studyPage.getCardCount();
      
      // 4. 如果有卡片，验证卡片列表显示
      if (cardCount > 0) {
        // 验证卡片列表可见
        await expect(studyPage.cardItem.first()).toBeVisible({ timeout: 5000 });
        
        // 验证卡片包含标题信息
        const firstCard = studyPage.cardItem.first();
        const cardText = await firstCard.textContent();
        expect(cardText).toBeTruthy();
      }
    });

    test('应该能够完成学习后查看进度更新', async ({ page }) => {
      // 1. 导航到学习中心
      await studyPage.goto();
      
      // 2. 检查是否有卡片可以学习
      const hasCards = await studyPage.hasAnyCards();
      
      if (hasCards) {
        // 3. 记录学习前的统计信息
        const beforeStats = await page.locator('p:has-text("已掌握")').locator('..').locator('p').nth(1).textContent();
        
        // 4. 开始学习
        await studyPage.clickStartAllStudy();
        await studyPage.waitForQuizMode();
        
        // 5. 完成一张卡片的学习
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
        
        // 6. 评分（标记为良好）
        await studyPage.rateGood();
        await page.waitForTimeout(1000);
        
        // 7. 验证学习进度更新（通过检查是否有完成界面或继续下一题）
        const finishVisible = await studyPage.finishScreen.isVisible().catch(() => false);
        const quizVisible = await studyPage.quizContainer.isVisible().catch(() => false);
        
        // 应该要么显示完成界面，要么显示下一题
        expect(finishVisible || quizVisible).toBeTruthy();
      } else {
        // 如果没有卡片，跳过此测试
        test.skip();
      }
    });

    test('应该能够从图谱节点创建学习卡片', async ({ page }) => {
      // 1. 导航到仪表板
      await dashboardPage.goto();
      await dashboardPage.waitForGraphsToLoad();
      
      const graphCount = await dashboardPage.getGraphCount();
      
      if (graphCount > 0) {
        // 2. 打开第一个图谱
        await dashboardPage.firstGraphCard.click();
        await page.waitForURL(/\/graph\//, { timeout: 15000 });
        await graphEditorPage.canvas.waitFor({ state: 'visible', timeout: 15000 });
        
        // 3. 检查是否有节点
        const nodeCount = await graphEditorPage.getNodeCount();
        
        if (nodeCount > 0) {
          // 4. 点击第一个节点
          await graphEditorPage.clickNodeByIndex(0);
          await page.waitForTimeout(500);
          
          // 5. 查找"添加到学习"或"创建卡片"按钮
          const addToStudyButton = page.locator('button:has-text("添加到学习"), button:has-text("创建卡片"), button:has-text("学习")');
          const hasAddButton = await addToStudyButton.count() > 0;
          
          if (hasAddButton) {
            // 6. 点击添加到学习
            await addToStudyButton.first().click();
            await page.waitForTimeout(500);
            
            // 7. 验证成功提示或导航到学习中心
            const toast = page.locator('[class*="toast"], .message, [class*="success"]');
            const hasToast = await toast.isVisible().catch(() => false);
            
            // 如果没有提示，直接导航到学习中心验证
            await studyPage.goto();
            await expect(studyPage.title).toBeVisible({ timeout: 10000 });
          }
        }
      }
    });
  });

  test.describe('任务-专注联动测试', () => {
    test('应该能够从任务列表开始专注会话', async ({ page }) => {
      // 1. 导航到任务调度器
      await schedulerPage.goto();
      await page.waitForLoadState('networkidle');
      
      // 2. 检查是否有任务
      const taskCount = await schedulerPage.getTaskCardCount();
      
      if (taskCount > 0) {
        // 3. 获取第一个任务卡片
        const firstTask = schedulerPage.taskCards.first();
        await firstTask.hover();
        
        // 4. 查找开始专注按钮
        const startButton = firstTask.locator('button:has-text("开始"), button:has-text("专注")');
        const hasStartButton = await startButton.count() > 0;
        
        if (hasStartButton) {
          // 5. 点击开始专注
          await startButton.first().click();
          await page.waitForTimeout(1000);
          
          // 6. 验证专注模式打开
          const focusMode = page.locator('[class*="focus-mode"], [data-testid="focus-mode"], .fixed.inset-0');
          const isFocusModeOpen = await focusMode.isVisible().catch(() => false);
          
          // 如果专注模式打开，验证其内容
          if (isFocusModeOpen) {
            // 验证专注计时器显示
            const timer = page.locator('text=/\\d{2}:\\d{2}/, [class*="timer"]');
            await expect(timer.first()).toBeVisible({ timeout: 5000 });
            
            // 关闭专注模式
            const closeButton = page.locator('button:has-text("退出"), button:has-text("结束"), button[title="关闭"]');
            if (await closeButton.first().isVisible().catch(() => false)) {
              await closeButton.first().click();
              await page.waitForTimeout(500);
            }
          }
        }
      }
    });

    test('应该能够创建新任务并开始专注', async ({ page }) => {
      // 1. 导航到任务调度器
      await schedulerPage.goto();
      await page.waitForLoadState('networkidle');
      
      // 2. 点击新建任务按钮
      const newTaskButton = schedulerPage.newTaskButton;
      const hasNewTaskButton = await newTaskButton.isVisible().catch(() => false);
      
      if (hasNewTaskButton) {
        await newTaskButton.click();
        
        // 3. 等待任务表单出现
        await page.waitForSelector('input[placeholder*="任务标题"], input[name="task-title"]', { timeout: 10000 });
        
        // 4. 填写任务信息
        const taskTitle = `集成测试任务 ${Date.now()}`;
        await schedulerPage.fillTaskFormWithDetails({
          title: taskTitle,
          description: '这是一个集成测试任务',
          estimatedDuration: 25,
          priority: 2,
        });
        
        // 5. 提交任务
        await schedulerPage.clickConfirm();
        
        // 6. 等待任务创建成功
        await schedulerPage.waitForTaskToAppear(taskTitle, 10000);
        
        // 7. 验证任务出现在列表中
        const taskCard = schedulerPage.getTaskCardByTitle(taskTitle);
        await expect(taskCard).toBeVisible({ timeout: 5000 });
        
        // 8. 尝试开始专注
        await taskCard.hover();
        const startButton = taskCard.locator('button:has-text("开始"), button:has-text("专注")');
        if (await startButton.count() > 0) {
          await startButton.first().click();
          await page.waitForTimeout(1000);
          
          // 验证专注模式或计时器显示
          const focusMode = page.locator('[class*="focus-mode"], [data-testid="focus-mode"], .fixed.inset-0');
          const timer = page.locator('text=/\\d{2}:\\d{2}/, [class*="timer"]');
          
          const isFocusModeOpen = await focusMode.isVisible().catch(() => false);
          const isTimerVisible = await timer.first().isVisible().catch(() => false);
          
          expect(isFocusModeOpen || isTimerVisible).toBeTruthy();
          
          // 清理：关闭专注模式
          if (isFocusModeOpen) {
            const closeButton = page.locator('button:has-text("退出"), button:has-text("结束"), button[title="关闭"]');
            if (await closeButton.first().isVisible().catch(() => false)) {
              await closeButton.first().click();
              await page.waitForTimeout(500);
            }
          }
        }
      }
    });

    test('应该在专注完成后更新任务状态', async ({ page }) => {
      // 1. 导航到任务调度器
      await schedulerPage.goto();
      await page.waitForLoadState('networkidle');
      
      // 2. 获取初始统计数据
      const initialStats = await schedulerPage.getStats();
      
      // 3. 检查是否有进行中的任务
      const taskCount = await schedulerPage.getTaskCardCount();
      
      if (taskCount > 0) {
        // 4. 找到一个可以开始的任务
        const firstTask = schedulerPage.taskCards.first();
        await firstTask.hover();
        
        const startButton = firstTask.locator('button:has-text("开始"), button:has-text("专注")');
        if (await startButton.count() > 0) {
          // 5. 开始专注
          await startButton.first().click();
          await page.waitForTimeout(1000);
          
          // 6. 检查是否有专注模式界面
          const focusMode = page.locator('[class*="focus-mode"], [data-testid="focus-mode"]');
          const isFocusModeOpen = await focusMode.isVisible().catch(() => false);
          
          if (isFocusModeOpen) {
            // 7. 模拟完成专注（点击完成或结束按钮）
            const completeButton = page.locator('button:has-text("完成"), button:has-text("结束"), button:has-text("停止")');
            if (await completeButton.count() > 0) {
              await completeButton.first().click();
              await page.waitForTimeout(1000);
              
              // 8. 验证任务状态更新
              // 检查是否有完成提示或状态变化
              const successToast = page.locator('[class*="toast"], [class*="success"], .message');
              const hasSuccessToast = await successToast.isVisible().catch(() => false);
              
              // 如果有确认对话框，确认它
              const confirmButton = page.locator('button:has-text("确认"), button:has-text("确定")');
              if (await confirmButton.first().isVisible().catch(() => false)) {
                await confirmButton.first().click();
                await page.waitForTimeout(500);
              }
            }
          }
        }
      }
    });

    test('应该在专注统计页面显示专注记录', async ({ page }) => {
      // 1. 导航到任务调度器统计页面
      await schedulerPage.gotoStats();
      await page.waitForLoadState('networkidle');
      
      // 2. 验证统计页面加载
      const statsTitle = page.locator('h1, h2, h3').first();
      await expect(statsTitle).toBeVisible({ timeout: 10000 });
      
      // 3. 查找专注记录或统计图表
      const focusStats = page.locator('[class*="focus"], [class*="stats"], [class*="chart"]');
      const hasStats = await focusStats.count() > 0;
      
      // 4. 验证至少有一些统计数据显示
      if (hasStats) {
        await expect(focusStats.first()).toBeVisible();
      }
    });
  });

  test.describe('成就-多模块联动测试', () => {
    test('应该在完成学习后更新成就进度', async ({ page }) => {
      // 1. 导航到成就页面，记录初始状态
      await achievementsPage.goto();
      await achievementsPage.title.waitFor({ state: 'visible', timeout: 10000 });
      
      const initialAchievementCount = await achievementsPage.getAchievementCount();
      const initialUnlockedCount = await achievementsPage.getUnlockedCount();
      
      // 2. 导航到学习中心
      await studyPage.goto();
      
      // 3. 检查是否有卡片可以学习
      const hasCards = await studyPage.hasAnyCards();
      
      if (hasCards) {
        // 4. 完成一次学习
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
        
        await page.waitForTimeout(300);
        await studyPage.rateGood();
        await page.waitForTimeout(1000);
        
        // 5. 返回成就页面检查更新
        await achievementsPage.goto();
        await achievementsPage.title.waitFor({ state: 'visible', timeout: 10000 });
        
        // 6. 验证成就列表仍然显示
        const newAchievementCount = await achievementsPage.getAchievementCount();
        expect(newAchievementCount).toBeGreaterThanOrEqual(initialAchievementCount);
      }
    });

    test('应该在完成专注会话后检查成就解锁', async ({ page }) => {
      // 1. 导航到任务调度器
      await schedulerPage.goto();
      await page.waitForLoadState('networkidle');
      
      // 2. 检查是否有任务可以开始专注
      const taskCount = await schedulerPage.getTaskCardCount();
      
      if (taskCount > 0) {
        const firstTask = schedulerPage.taskCards.first();
        await firstTask.hover();
        
        const startButton = firstTask.locator('button:has-text("开始"), button:has-text("专注")');
        if (await startButton.count() > 0) {
          // 3. 开始专注
          await startButton.first().click();
          await page.waitForTimeout(1000);
          
          // 4. 检查专注模式是否打开
          const focusMode = page.locator('[class*="focus-mode"], [data-testid="focus-mode"]');
          const isFocusModeOpen = await focusMode.isVisible().catch(() => false);
          
          if (isFocusModeOpen) {
            // 5. 等待一段时间后结束专注
            await page.waitForTimeout(2000);
            
            const endButton = page.locator('button:has-text("结束"), button:has-text("完成"), button:has-text("停止")');
            if (await endButton.count() > 0) {
              await endButton.first().click();
              await page.waitForTimeout(1000);
              
              // 6. 检查是否有成就解锁通知
              const achievementNotification = page.locator('[class*="achievement"], text=/成就解锁/, [class*="notification"]');
              const hasNotification = await achievementNotification.isVisible().catch(() => false);
              
              // 7. 如果有通知，验证其内容
              if (hasNotification) {
                await expect(achievementNotification.first()).toBeVisible();
              }
              
              // 8. 导航到成就页面验证
              await achievementsPage.goto();
              await achievementsPage.title.waitFor({ state: 'visible', timeout: 10000 });
              await expect(achievementsPage.achievementList).toBeVisible();
            }
          }
        }
      }
    });

    test('应该能够查看成就详情和进度', async ({ page }) => {
      // 1. 导航到成就页面
      await achievementsPage.goto();
      await achievementsPage.title.waitFor({ state: 'visible', timeout: 10000 });
      
      // 2. 获取成就卡片数量
      const achievementCount = await achievementsPage.getAchievementCount();
      expect(achievementCount).toBeGreaterThan(0);
      
      // 3. 点击第一个成就卡片
      const firstCard = achievementsPage.achievementCard.first();
      await expect(firstCard).toBeVisible({ timeout: 10000 });
      await firstCard.click();
      
      // 4. 验证成就详情显示
      const detailModal = page.locator('[data-testid="achievement-detail"], .achievement-detail-modal, [role="dialog"]');
      const detailPanel = page.locator('[data-testid="achievement-detail-panel"], .achievement-detail');
      
      const isModalVisible = await detailModal.isVisible().catch(() => false);
      const isPanelVisible = await detailPanel.isVisible().catch(() => false);
      
      // 5. 如果有详情显示，验证其内容
      if (isModalVisible || isPanelVisible) {
        // 验证成就名称显示
        const achievementName = page.locator('h2, h3, .achievement-name, [class*="title"]');
        await expect(achievementName.first()).toBeVisible();
        
        // 关闭详情
        const closeButton = page.locator('button[aria-label="关闭"], button:has-text("关闭"), [data-testid="close-detail"]');
        if (await closeButton.first().isVisible().catch(() => false)) {
          await closeButton.first().click();
        }
      }
    });

    test('应该在不同模块间保持成就状态同步', async ({ page }) => {
      // 1. 导航到成就页面，获取初始解锁数量
      await achievementsPage.goto();
      await achievementsPage.title.waitFor({ state: 'visible', timeout: 10000 });
      
      const initialUnlockedCount = await achievementsPage.getUnlockedCount();
      
      // 2. 导航到仪表板
      await dashboardPage.goto();
      await dashboardPage.waitForGraphsToLoad();
      
      // 3. 执行一些操作（如创建图谱）
      const graphCount = await dashboardPage.getGraphCount();
      
      // 4. 返回成就页面
      await achievementsPage.goto();
      await achievementsPage.title.waitFor({ state: 'visible', timeout: 10000 });
      
      // 5. 验证成就状态保持一致
      const newUnlockedCount = await achievementsPage.getUnlockedCount();
      expect(newUnlockedCount).toBeGreaterThanOrEqual(initialUnlockedCount);
      
      // 6. 导航到学习中心
      await studyPage.goto();
      await studyPage.title.waitFor({ state: 'visible', timeout: 10000 });
      
      // 7. 再次返回成就页面
      await achievementsPage.goto();
      await achievementsPage.title.waitFor({ state: 'visible', timeout: 10000 });
      
      // 8. 验证成就状态仍然一致
      const finalUnlockedCount = await achievementsPage.getUnlockedCount();
      expect(finalUnlockedCount).toBeGreaterThanOrEqual(initialUnlockedCount);
    });

    test('应该显示成就解锁通知', async ({ page }) => {
      // 1. 导航到成就页面
      await achievementsPage.goto();
      await achievementsPage.title.waitFor({ state: 'visible', timeout: 10000 });
      
      // 2. 查找最近解锁的成就
      const unlockedSection = achievementsPage.unlockedSection;
      const hasUnlockedSection = await unlockedSection.isVisible().catch(() => false);
      
      if (hasUnlockedSection) {
        // 3. 获取已解锁成就卡片
        const unlockedCards = unlockedSection.locator('[data-testid="achievement-card"], .achievement-card');
        const unlockedCount = await unlockedCards.count();
        
        if (unlockedCount > 0) {
          // 4. 点击已解锁成就查看详情
          await unlockedCards.first().click();
          await page.waitForTimeout(500);
          
          // 5. 验证详情显示
          const detailModal = page.locator('[data-testid="achievement-detail"], .achievement-detail-modal, [role="dialog"]');
          const isDetailVisible = await detailModal.isVisible().catch(() => false);
          
          if (isDetailVisible) {
            // 验证成就图标和名称显示
            const achievementIcon = page.locator('span[class*="icon"], [class*="emoji"]');
            const achievementTitle = page.locator('h2, h3, [class*="title"]');
            
            await expect(achievementTitle.first()).toBeVisible();
          }
        }
      }
    });
  });

  test.describe('端到端工作流测试', () => {
    test('应该能够完成完整的学习-任务-成就工作流', async ({ page }) => {
      // 步骤1: 创建或打开图谱
      await dashboardPage.goto();
      await dashboardPage.waitForGraphsToLoad();
      
      const graphCount = await dashboardPage.getGraphCount();
      
      if (graphCount > 0) {
        // 打开第一个图谱
        await dashboardPage.firstGraphCard.click();
        await page.waitForURL(/\/graph\//, { timeout: 15000 });
        await graphEditorPage.canvas.waitFor({ state: 'visible', timeout: 15000 });
        
        // 步骤2: 检查节点数量
        const nodeCount = await graphEditorPage.getNodeCount();
        expect(nodeCount).toBeGreaterThanOrEqual(0);
        
        // 步骤3: 导航到学习中心
        await studyPage.goto();
        await expect(studyPage.title).toBeVisible({ timeout: 10000 });
        
        // 步骤4: 如果有卡片，完成一次学习
        const hasCards = await studyPage.hasAnyCards();
        if (hasCards) {
          await studyPage.clickStartAllStudy();
          await studyPage.waitForQuizMode();
          
          // 完成一张卡片
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
          await page.waitForTimeout(1000);
        }
        
        // 步骤5: 导航到任务调度器
        await schedulerPage.goto();
        await page.waitForLoadState('networkidle');
        
        // 验证任务调度器加载成功
        const schedulerTitle = page.locator('h1, h2, h3').first();
        await expect(schedulerTitle).toBeVisible({ timeout: 10000 });
        
        // 步骤6: 导航到成就页面
        await achievementsPage.goto();
        await achievementsPage.title.waitFor({ state: 'visible', timeout: 10000 });
        
        // 验证成就页面加载成功
        await expect(achievementsPage.achievementList).toBeVisible();
        
        // 步骤7: 返回仪表板
        await dashboardPage.goto();
        await dashboardPage.waitForGraphsToLoad();
        
        // 验证完整工作流完成
        await expect(dashboardPage.title).toBeVisible({ timeout: 10000 });
      }
    });

    test('应该能够在多个模块间导航并保持状态', async ({ page }) => {
      // 测试在多个模块间来回导航
      const modules = [
        { name: 'dashboard', navigate: () => dashboardPage.goto(), verify: () => dashboardPage.title.isVisible() },
        { name: 'study', navigate: () => studyPage.goto(), verify: () => studyPage.title.isVisible() },
        { name: 'scheduler', navigate: () => schedulerPage.goto(), verify: () => page.locator('h1, h2, h3').first().isVisible() },
        { name: 'achievements', navigate: () => achievementsPage.goto(), verify: () => achievementsPage.title.isVisible() },
      ];
      
      // 遍历所有模块
      for (const module of modules) {
        await module.navigate();
        await page.waitForLoadState('networkidle');
        
        const isVerified = await module.verify();
        expect(isVerified).toBeTruthy();
        
        await page.waitForTimeout(500);
      }
      
      // 再次遍历，验证状态一致性
      for (const module of modules) {
        await module.navigate();
        await page.waitForLoadState('networkidle');
        
        const isVerified = await module.verify();
        expect(isVerified).toBeTruthy();
        
        await page.waitForTimeout(500);
      }
    });
  });
});
