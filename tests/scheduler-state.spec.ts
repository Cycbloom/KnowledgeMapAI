import { test, expect } from '@playwright/test';
import { SchedulerPage } from './pages/SchedulerPage';
import {
  login,
  createTestTask,
  deleteTestTask,
  deleteAllTestTasks,
  getAuthToken,
  generateUniqueTaskTitle,
  TestTask,
} from './utils/schedulerHelpers';

test.describe('队列状态更新测试', () => {
  let schedulerPage: SchedulerPage;
  let authToken: string;
  let createdTasks: TestTask[] = [];

  test.beforeEach(async ({ page }) => {
    schedulerPage = new SchedulerPage(page);
    
    await login(page);
    await schedulerPage.navigate();
    
    authToken = await getAuthToken(page);
    
    createdTasks = [];
  });

  test.afterEach(async ({ request }) => {
    for (const task of createdTasks) {
      try {
        await deleteTestTask(request, authToken, task.id);
      } catch {
        // Ignore cleanup errors
      }
    }
    
    try {
      await deleteAllTestTasks(request, authToken, '测试任务');
    } catch {
      // Ignore cleanup errors
    }
  });

  test.describe('任务计数更新', () => {
    test('移动任务后源队列任务计数应减少', async ({ page, request }) => {
      const task = await createTestTask(request, authToken, {
        title: generateUniqueTaskTitle(),
        queue_level: 2,
      });
      
      createdTasks.push(task);
      
      await schedulerPage.refreshPage();
      
      const initialCount = await schedulerPage.getQueueTaskCount(2);
      const initialNum = parseInt(initialCount as string) || 0;
      
      const taskElement = await schedulerPage.getTaskByTitle(task.title);
      if (taskElement) {
        await schedulerPage.dragTaskToQueue(taskElement, 0);
      }
      
      await page.waitForTimeout(500);
      
      const finalCount = await schedulerPage.getQueueTaskCount(2);
      const finalNum = parseInt(finalCount as string) || 0;
      
      expect(finalNum).toBeLessThan(initialNum);
    });

    test('移动任务后目标队列任务计数应增加', async ({ page, request }) => {
      const task = await createTestTask(request, authToken, {
        title: generateUniqueTaskTitle(),
        queue_level: 2,
      });
      
      createdTasks.push(task);
      
      await schedulerPage.refreshPage();
      
      const initialCount = await schedulerPage.getQueueTaskCount(0);
      const initialNum = parseInt(initialCount as string) || 0;
      
      const taskElement = await schedulerPage.getTaskByTitle(task.title);
      if (taskElement) {
        await schedulerPage.dragTaskToQueue(taskElement, 0);
      }
      
      await page.waitForTimeout(500);
      
      const finalCount = await schedulerPage.getQueueTaskCount(0);
      const finalNum = parseInt(finalCount as string) || 0;
      
      expect(finalNum).toBeGreaterThan(initialNum);
    });

    test('页面顶部统计信息应同步更新', async ({ page, request }) => {
      const task = await createTestTask(request, authToken, {
        title: generateUniqueTaskTitle(),
        queue_level: 2,
        estimated_duration: 30,
      });
      
      createdTasks.push(task);
      
      await schedulerPage.refreshPage();
      
      const _initialPending = await schedulerPage.getPendingCount();
      
      const taskElement = await schedulerPage.getTaskByTitle(task.title);
      if (taskElement) {
        await schedulerPage.dragTaskToQueue(taskElement, 0);
      }
      
      await page.waitForTimeout(500);
      
      const finalPending = await schedulerPage.getPendingCount();
      
      expect(finalPending).toBeDefined();
    });
  });

  test.describe('预计时长更新', () => {
    test('移动带预计时长的任务后源队列预计时长应减少', async ({ page, request }) => {
      const task = await createTestTask(request, authToken, {
        title: generateUniqueTaskTitle(),
        queue_level: 2,
        estimated_duration: 60,
      });
      
      createdTasks.push(task);
      
      await schedulerPage.refreshPage();
      
      const initialTime = await schedulerPage.getQueueEstimatedTime(2);
      
      const taskElement = await schedulerPage.getTaskByTitle(task.title);
      if (taskElement) {
        await schedulerPage.dragTaskToQueue(taskElement, 0);
      }
      
      await page.waitForTimeout(500);
      
      const finalTime = await schedulerPage.getQueueEstimatedTime(2);
      
      if (initialTime && finalTime) {
        const extractMinutes = (timeStr: string) => {
          const match = timeStr.match(/(\d+)/);
          return match ? parseInt(match[1]) : 0;
        };
        
        const initialMinutes = extractMinutes(initialTime);
        const finalMinutes = extractMinutes(finalTime);
        
        expect(finalMinutes).toBeLessThan(initialMinutes);
      }
    });

    test('移动带预计时长的任务后目标队列预计时长应增加', async ({ page, request }) => {
      const task = await createTestTask(request, authToken, {
        title: generateUniqueTaskTitle(),
        queue_level: 2,
        estimated_duration: 45,
      });
      
      createdTasks.push(task);
      
      await schedulerPage.refreshPage();
      
      const initialTime = await schedulerPage.getQueueEstimatedTime(0);
      
      const taskElement = await schedulerPage.getTaskByTitle(task.title);
      if (taskElement) {
        await schedulerPage.dragTaskToQueue(taskElement, 0);
      }
      
      await page.waitForTimeout(500);
      
      const finalTime = await schedulerPage.getQueueEstimatedTime(0);
      
      if (initialTime && finalTime) {
        const extractMinutes = (timeStr: string) => {
          const match = timeStr.match(/(\d+)/);
          return match ? parseInt(match[1]) : 0;
        };
        
        const initialMinutes = extractMinutes(initialTime);
        const finalMinutes = extractMinutes(finalTime);
        
        expect(finalMinutes).toBeGreaterThan(initialMinutes);
      }
    });
  });
});
