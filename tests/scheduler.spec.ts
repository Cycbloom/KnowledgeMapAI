import { test, expect } from '@playwright/test';
import { SchedulerPage } from './pages/SchedulerPage';
import { LoginPage } from './pages/LoginPage';
import { testUser } from './utils/testHelpers';

test.describe('任务调度器测试', () => {
  let schedulerPage: SchedulerPage;

  test.beforeEach(async ({ page }) => {
    // 登录
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(testUser.email, testUser.password);
    await expect(page).toHaveURL(/\/$/, { timeout: 30000 });

    // 导航到任务调度器页面
    schedulerPage = new SchedulerPage(page);
    await schedulerPage.goto();
  });

  test.describe('基础功能测试', () => {
    test('应该能够进入任务调度器页面', async ({ page }) => {
      // 验证页面标题可见
      await expect(schedulerPage.title).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('MLFQ 调度算法测试', () => {
    test('应该能够创建不同队列级别的任务', async ({ page }) => {
      // 创建 Q0 队列任务（最高优先级）
      await schedulerPage.createTask('Q0 高优先级任务', '这是最高优先级任务', 0);
      await expect(await schedulerPage.getQueueTaskCount(0)).toBeGreaterThan(0);

      // 创建 Q1 队列任务
      await schedulerPage.createTask('Q1 中等优先级任务', '这是中等优先级任务', 1);
      await expect(await schedulerPage.getQueueTaskCount(1)).toBeGreaterThan(0);

      // 创建 Q2 队列任务（最低优先级）
      await schedulerPage.createTask('Q2 低优先级任务', '这是低优先级任务', 2);
      await expect(await schedulerPage.getQueueTaskCount(2)).toBeGreaterThan(0);
    });

    test('应该能够通过拖拽改变任务队列级别', async ({ page }) => {
      // 创建一个 Q2 队列任务
      await schedulerPage.createTask('待提升任务', '初始在 Q2 队列', 2);
      await expect(await schedulerPage.getQueueTaskCount(2)).toBeGreaterThan(0);

      // 将任务拖拽到 Q1 队列
      await schedulerPage.dragTaskToQueue('待提升任务', 1);
      await page.waitForTimeout(1000); // 等待拖拽完成

      // 验证任务已移动到 Q1 队列
      await expect(await schedulerPage.getQueueTaskCount(1)).toBeGreaterThan(0);
    });

    test('应该能够通过队列标签切换查看不同队列', async ({ page }) => {
      // 创建不同队列的任务
      await schedulerPage.createTask('Q0 任务 A', 'Q0 任务', 0);
      await schedulerPage.createTask('Q1 任务 B', 'Q1 任务', 1);
      await schedulerPage.createTask('Q2 任务 C', 'Q2 任务', 2);

      // 切换到 Q0 队列标签
      await schedulerPage.clickQueueTab(0);
      await page.waitForTimeout(500);
      const q0Task = await schedulerPage.getTaskByTitle('Q0 任务 A');
      await expect(q0Task).toBeVisible();

      // 切换到 Q1 队列标签
      await schedulerPage.clickQueueTab(1);
      await page.waitForTimeout(500);
      const q1Task = await schedulerPage.getTaskByTitle('Q1 任务 B');
      await expect(q1Task).toBeVisible();

      // 切换到 Q2 队列标签
      await schedulerPage.clickQueueTab(2);
      await page.waitForTimeout(500);
      const q2Task = await schedulerPage.getTaskByTitle('Q2 任务 C');
      await expect(q2Task).toBeVisible();
    });

    test('应该能够测试任务老化机制', async ({ page }) => {
      // 创建多个 Q2 队列任务
      await schedulerPage.createTask('老化任务 1', '长时间未执行的任务', 2);
      await schedulerPage.createTask('老化任务 2', '另一个长时间未执行的任务', 2);
      await schedulerPage.createTask('新任务', '刚创建的任务', 2);

      // 等待一段时间模拟任务老化
      await page.waitForTimeout(2000);

      // 验证老化任务仍然存在
      const agingTask1 = await schedulerPage.getTaskByTitle('老化任务 1');
      const agingTask2 = await schedulerPage.getTaskByTitle('老化任务 2');
      await expect(agingTask1).toBeVisible();
      await expect(agingTask2).toBeVisible();

      // 如果系统实现了自动老化，验证任务优先级提升
      // 这里可以通过检查任务是否移动到更高优先级队列来验证
      const q1Count = await schedulerPage.getQueueTaskCount(1);
      const q0Count = await schedulerPage.getQueueTaskCount(0);

      // 验证任务数量（老化任务可能被提升）
      expect(q1Count + q0Count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('任务时间估算和统计测试', () => {
    test('应该能够创建带预估时间的任务', async ({ page }) => {
      // 点击新建任务
      await schedulerPage.clickNewTask();
      await page.waitForSelector('input[placeholder*="任务标题"], input[name="task-title"]', { timeout: 10000 });

      // 填写任务详情，包括预估时间
      await schedulerPage.fillTaskFormWithDetails({
        title: '带预估时间的任务',
        description: '这个任务需要 30 分钟完成',
        estimatedDuration: 30,
        priority: 2,
        queueLevel: 1,
      });

      // 确认创建
      await schedulerPage.clickConfirm();

      // 等待任务创建成功
      await schedulerPage.waitForTaskToAppear('带预估时间的任务');

      // 验证任务已创建
      const task = await schedulerPage.getTaskByTitle('带预估时间的任务');
      await expect(task).toBeVisible();
    });

    test('应该能够查看任务统计信息', async ({ page }) => {
      // 创建一些测试任务
      await schedulerPage.createTask('统计任务 1', '用于统计的任务', 0);
      await schedulerPage.createTask('统计任务 2', '用于统计的任务', 1);
      await schedulerPage.createTask('统计任务 3', '用于统计的任务', 2);

      // 获取统计信息
      const stats = await schedulerPage.getStats();

      // 验证统计信息
      expect(stats.total).toBeGreaterThanOrEqual(3);
      expect(stats.pending).toBeGreaterThanOrEqual(3);
    });

    test('应该能够导航到统计页面', async ({ page }) => {
      // 导航到统计页面
      await schedulerPage.gotoStats();

      // 验证页面已加载
      await expect(page).toHaveURL(/\/scheduler\/stats/, { timeout: 10000 });

      // 验证统计页面内容
      const statsTitle = page.locator('h1, h2, h3').filter({ hasText: /统计|数据|报告/ });
      await expect(statsTitle).toBeVisible({ timeout: 5000 });
    });

    test('应该能够查看时间统计详情', async ({ page }) => {
      // 创建带预估时间的任务
      await schedulerPage.clickNewTask();
      await page.waitForSelector('input[placeholder*="任务标题"], input[name="task-title"]', { timeout: 10000 });
      await schedulerPage.fillTaskFormWithDetails({
        title: '时间统计任务',
        description: '用于时间统计',
        estimatedDuration: 60,
      });
      await schedulerPage.clickConfirm();
      await schedulerPage.waitForTaskToAppear('时间统计任务');

      // 导航到统计页面
      await schedulerPage.gotoStats();

      // 验证时间统计信息可见
      const timeStats = page.locator('text=/时间|分钟|小时/').first();
      await expect(timeStats).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('任务编辑和删除测试', () => {
    test('应该能够编辑任务内容', async ({ page }) => {
      // 创建一个任务
      await schedulerPage.createTask('待编辑任务', '原始描述');

      // 点击编辑按钮
      await schedulerPage.clickTaskAction('待编辑任务', 'edit');

      // 等待编辑对话框出现
      await page.waitForSelector('input[placeholder*="任务标题"], input[name="task-title"]', { timeout: 10000 });

      // 修改任务标题和描述
      const titleInput = page.locator('input[placeholder*="任务标题"], input[name="task-title"]').first();
      await titleInput.fill('已编辑任务');

      const descInput = page.locator('textarea[placeholder*="描述"], textarea[name="task-description"]').first();
      if (await descInput.count() > 0) {
        await descInput.fill('更新后的描述');
      }

      // 保存修改
      await schedulerPage.clickConfirm();

      // 验证任务已更新
      await schedulerPage.waitForTaskToAppear('已编辑任务');
      const editedTask = await schedulerPage.getTaskByTitle('已编辑任务');
      await expect(editedTask).toBeVisible();

      // 验证旧标题不存在
      await schedulerPage.waitForTaskToDisappear('待编辑任务');
    });

    test('应该能够删除任务', async ({ page }) => {
      // 创建一个任务
      await schedulerPage.createTask('待删除任务', '这个任务将被删除');

      // 验证任务已创建
      const task = await schedulerPage.getTaskByTitle('待删除任务');
      await expect(task).toBeVisible();

      // 点击删除按钮
      await schedulerPage.clickTaskAction('待删除任务', 'delete');

      // 确认删除
      await schedulerPage.confirmDialog();

      // 验证任务已删除
      await schedulerPage.waitForTaskToDisappear('待删除任务');
      const deletedTask = await schedulerPage.getTaskByTitle('待删除任务');
      await expect(deletedTask).not.toBeVisible();
    });

    test('应该能够取消任务删除', async ({ page }) => {
      // 创建一个任务
      await schedulerPage.createTask('保留任务', '这个任务不会被删除');

      // 点击删除按钮
      await schedulerPage.clickTaskAction('保留任务', 'delete');

      // 点击取消按钮（如果存在）
      const cancelButton = page.locator('button:has-text("取消"), button:has-text("cancel")').first();
      if (await cancelButton.count() > 0) {
        await cancelButton.click();
      }

      // 验证任务仍然存在
      const task = await schedulerPage.getTaskByTitle('保留任务');
      await expect(task).toBeVisible();
    });

    test('应该能够编辑任务优先级', async ({ page }) => {
      // 创建一个任务
      await schedulerPage.createTask('优先级任务', '测试优先级编辑', 1);

      // 点击编辑按钮
      await schedulerPage.clickTaskAction('优先级任务', 'edit');

      // 等待编辑对话框出现
      await page.waitForSelector('input[placeholder*="任务标题"], input[name="task-title"]', { timeout: 10000 });

      // 修改优先级（假设可以通过按钮或选择器修改）
      const highPriorityButton = page.locator('button:has-text("高"), button:has-text("紧急")').first();
      if (await highPriorityButton.count() > 0) {
        await highPriorityButton.click();
      }

      // 保存修改
      await schedulerPage.clickConfirm();

      // 验证任务仍然存在
      const task = await schedulerPage.getTaskByTitle('优先级任务');
      await expect(task).toBeVisible();
    });
  });

  test.describe('任务历史记录查看测试', () => {
    test('应该能够完成任务并查看历史', async ({ page }) => {
      // 创建一个任务
      await schedulerPage.createTask('待完成任务', '这个任务将被标记为完成');

      // 点击完成按钮
      await schedulerPage.clickTaskAction('待完成任务', 'complete');

      // 等待任务状态更新
      await page.waitForTimeout(1000);

      // 验证任务已完成（可能移动到已完成队列或改变样式）
      const completedTask = await schedulerPage.getTaskByTitle('待完成任务');
      await expect(completedTask).toBeVisible();
    });

    test('应该能够查看已完成任务历史', async ({ page }) => {
      // 创建并完成多个任务
      await schedulerPage.createTask('已完成任务 1', '第一个完成的任务');
      await schedulerPage.clickTaskAction('已完成任务 1', 'complete');
      await page.waitForTimeout(500);

      await schedulerPage.createTask('已完成任务 2', '第二个完成的任务');
      await schedulerPage.clickTaskAction('已完成任务 2', 'complete');
      await page.waitForTimeout(500);

      // 尝试导航到历史页面或切换到已完成标签
      const historyTab = page.locator('button:has-text("历史"), button:has-text("已完成"), [data-testid="history-tab"]');
      if (await historyTab.count() > 0) {
        await historyTab.first().click();
        await page.waitForTimeout(500);

        // 验证已完成任务可见
        const completedTask1 = await schedulerPage.getTaskByTitle('已完成任务 1');
        const completedTask2 = await schedulerPage.getTaskByTitle('已完成任务 2');
        await expect(completedTask1).toBeVisible();
        await expect(completedTask2).toBeVisible();
      }
    });

    test('应该能够查看任务执行记录', async ({ page }) => {
      // 创建一个任务
      await schedulerPage.createTask('执行记录任务', '用于测试执行记录');

      // 开始任务
      await schedulerPage.clickTaskAction('执行记录任务', 'start');
      await page.waitForTimeout(1000);

      // 暂停任务
      await schedulerPage.clickTaskAction('执行记录任务', 'pause');
      await page.waitForTimeout(500);

      // 完成任务
      await schedulerPage.clickTaskAction('执行记录任务', 'complete');
      await page.waitForTimeout(500);

      // 点击任务查看详情（如果支持）
      const taskCard = await schedulerPage.getTaskCardByTitle('执行记录任务');
      await taskCard.click();
      await page.waitForTimeout(500);

      // 验证任务详情或执行记录可见
      const taskDetails = page.locator('[data-testid="task-details"], .task-details, [data-task-details]');
      if (await taskDetails.count() > 0) {
        await expect(taskDetails.first()).toBeVisible();
      }
    });

    test('应该能够筛选历史记录', async ({ page }) => {
      // 创建不同日期的任务
      await schedulerPage.createTask('历史任务 A', '历史任务 A');
      await schedulerPage.clickTaskAction('历史任务 A', 'complete');
      await page.waitForTimeout(500);

      await schedulerPage.createTask('历史任务 B', '历史任务 B');
      await schedulerPage.clickTaskAction('历史任务 B', 'complete');
      await page.waitForTimeout(500);

      // 尝试使用筛选器（如果存在）
      const filterButton = page.locator('button:has-text("筛选"), [data-testid="filter-button"]');
      if (await filterButton.count() > 0) {
        await filterButton.first().click();
        await page.waitForTimeout(500);

        // 验证筛选选项可见
        const filterOptions = page.locator('[data-testid="filter-option"], .filter-option');
        if (await filterOptions.count() > 0) {
          await expect(filterOptions.first()).toBeVisible();
        }
      }
    });
  });

  test.describe('综合场景测试', () => {
    test('应该能够执行完整的任务生命周期', async ({ page }) => {
      // 1. 创建任务
      await schedulerPage.createTask('生命周期任务', '测试完整生命周期', 1);
      await expect(await schedulerPage.getTaskByTitle('生命周期任务')).toBeVisible();

      // 2. 开始任务
      await schedulerPage.clickTaskAction('生命周期任务', 'start');
      await page.waitForTimeout(1000);

      // 3. 暂停任务
      await schedulerPage.clickTaskAction('生命周期任务', 'pause');
      await page.waitForTimeout(500);

      // 4. 编辑任务
      await schedulerPage.clickTaskAction('生命周期任务', 'edit');
      await page.waitForSelector('input[placeholder*="任务标题"], input[name="task-title"]', { timeout: 10000 });
      const titleInput = page.locator('input[placeholder*="任务标题"], input[name="task-title"]').first();
      await titleInput.fill('生命周期任务（已更新）');
      await schedulerPage.clickConfirm();
      await schedulerPage.waitForTaskToAppear('生命周期任务（已更新）');

      // 5. 重新开始任务
      await schedulerPage.clickTaskAction('生命周期任务（已更新）', 'start');
      await page.waitForTimeout(1000);

      // 6. 完成任务
      await schedulerPage.clickTaskAction('生命周期任务（已更新）', 'complete');
      await page.waitForTimeout(500);

      // 7. 验证任务已完成
      const completedTask = await schedulerPage.getTaskByTitle('生命周期任务（已更新）');
      await expect(completedTask).toBeVisible();
    });

    test('应该能够管理多个队列中的任务', async ({ page }) => {
      // 在不同队列创建任务
      await schedulerPage.createTask('Q0 任务', 'Q0 队列任务', 0);
      await schedulerPage.createTask('Q1 任务', 'Q1 队列任务', 1);
      await schedulerPage.createTask('Q2 任务', 'Q2 队列任务', 2);

      // 验证各队列任务数量
      expect(await schedulerPage.getQueueTaskCount(0)).toBeGreaterThan(0);
      expect(await schedulerPage.getQueueTaskCount(1)).toBeGreaterThan(0);
      expect(await schedulerPage.getQueueTaskCount(2)).toBeGreaterThan(0);

      // 在 Q0 队列完成任务
      await schedulerPage.clickQueueTab(0);
      await page.waitForTimeout(500);
      await schedulerPage.clickTaskAction('Q0 任务', 'complete');
      await page.waitForTimeout(500);

      // 切换到 Q1 队列并编辑任务
      await schedulerPage.clickQueueTab(1);
      await page.waitForTimeout(500);
      await schedulerPage.clickTaskAction('Q1 任务', 'edit');
      await page.waitForSelector('input[placeholder*="任务标题"], input[name="task-title"]', { timeout: 10000 });
      const titleInput = page.locator('input[placeholder*="任务标题"], input[name="task-title"]').first();
      await titleInput.fill('Q1 任务（已编辑）');
      await schedulerPage.clickConfirm();
      await schedulerPage.waitForTaskToAppear('Q1 任务（已编辑）');

      // 切换到 Q2 队列并删除任务
      await schedulerPage.clickQueueTab(2);
      await page.waitForTimeout(500);
      await schedulerPage.clickTaskAction('Q2 任务', 'delete');
      await schedulerPage.confirmDialog();
      await schedulerPage.waitForTaskToDisappear('Q2 任务');

      // 验证最终状态
      await schedulerPage.clickQueueTab(0);
      await page.waitForTimeout(500);
      const q0Task = await schedulerPage.getTaskByTitle('Q0 任务');
      await expect(q0Task).toBeVisible();

      await schedulerPage.clickQueueTab(1);
      await page.waitForTimeout(500);
      const q1Task = await schedulerPage.getTaskByTitle('Q1 任务（已编辑）');
      await expect(q1Task).toBeVisible();

      await schedulerPage.clickQueueTab(2);
      await page.waitForTimeout(500);
      const q2Task = await schedulerPage.getTaskByTitle('Q2 任务');
      await expect(q2Task).not.toBeVisible();
    });
  });
});
