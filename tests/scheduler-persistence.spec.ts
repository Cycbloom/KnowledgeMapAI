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

test.describe('数据持久化测试', () => {
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

  test.describe('页面刷新后数据保持', () => {
    test('跨队列移动后刷新页面任务应在正确队列', async ({ page, request }) => {
      const task = await createTestTask(request, authToken, {
        title: generateUniqueTaskTitle(),
        queue_level: 2,
      });
      
      createdTasks.push(task);
      
      await schedulerPage.refreshPage();
      
      const taskElement = await schedulerPage.getTaskByTitle(task.title);
      if (taskElement) {
        await schedulerPage.dragTaskToQueue(taskElement, 0);
      }
      
      await page.waitForTimeout(500);
      
      await schedulerPage.assertTaskInQueue(task.title, 0);
      
      await schedulerPage.refreshPage();
      
      await schedulerPage.assertTaskInQueue(task.title, 0);
      await schedulerPage.assertTaskNotInQueue(task.title, 2);
    });

    test('队列内排序后刷新页面顺序应保持', async ({ page, request }) => {
      const task1 = await createTestTask(request, authToken, {
        title: generateUniqueTaskTitle(),
        queue_level: 1,
      });
      const task2 = await createTestTask(request, authToken, {
        title: generateUniqueTaskTitle(),
        queue_level: 1,
      });
      const task3 = await createTestTask(request, authToken, {
        title: generateUniqueTaskTitle(),
        queue_level: 1,
      });
      
      createdTasks.push(task1, task2, task3);
      
      await schedulerPage.refreshPage();
      
      const firstTask = await schedulerPage.getTaskByTitle(task1.title);
      if (firstTask) {
        await schedulerPage.reorderTaskInQueue(0, 2, 1);
      }
      
      await page.waitForTimeout(500);
      
      const _orderBeforeRefresh = await schedulerPage.getTaskOrderInQueue(1);
      
      await schedulerPage.refreshPage();
      
      const orderAfterRefresh = await schedulerPage.getTaskOrderInQueue(1);
      
      const task1Index = orderAfterRefresh.indexOf(task1.title);
      const task2Index = orderAfterRefresh.indexOf(task2.title);
      const task3Index = orderAfterRefresh.indexOf(task3.title);
      
      expect(task1Index).toBeGreaterThan(task2Index);
      expect(task1Index).toBeGreaterThan(task3Index);
    });

    test('多次操作后刷新页面所有状态应正确', async ({ page, request }) => {
      const task1 = await createTestTask(request, authToken, {
        title: generateUniqueTaskTitle(),
        queue_level: 0,
      });
      const task2 = await createTestTask(request, authToken, {
        title: generateUniqueTaskTitle(),
        queue_level: 2,
      });
      
      createdTasks.push(task1, task2);
      
      await schedulerPage.refreshPage();
      
      const task1Element = await schedulerPage.getTaskByTitle(task1.title);
      if (task1Element) {
        await schedulerPage.dragTaskToQueue(task1Element, 2);
      }
      
      await page.waitForTimeout(500);
      
      const task2Element = await schedulerPage.getTaskByTitle(task2.title);
      if (task2Element) {
        await schedulerPage.dragTaskToQueue(task2Element, 0);
      }
      
      await page.waitForTimeout(500);
      
      await schedulerPage.refreshPage();
      
      await schedulerPage.assertTaskInQueue(task1.title, 2);
      await schedulerPage.assertTaskInQueue(task2.title, 0);
    });
  });

  test.describe('多次连续拖拽', () => {
    test('连续拖拽多个任务应全部正确保存', async ({ page, request }) => {
      const tasks = await Promise.all([
        createTestTask(request, authToken, { title: generateUniqueTaskTitle(), queue_level: 2 }),
        createTestTask(request, authToken, { title: generateUniqueTaskTitle(), queue_level: 2 }),
        createTestTask(request, authToken, { title: generateUniqueTaskTitle(), queue_level: 2 }),
      ]);
      
      createdTasks.push(...tasks);
      
      await schedulerPage.refreshPage();
      
      const task0Element = await schedulerPage.getTaskByTitle(tasks[0].title);
      if (task0Element) {
        await schedulerPage.dragTaskToQueue(task0Element, 0);
      }
      await page.waitForTimeout(500);
      
      const task1Element = await schedulerPage.getTaskByTitle(tasks[1].title);
      if (task1Element) {
        await schedulerPage.dragTaskToQueue(task1Element, 1);
      }
      await page.waitForTimeout(500);
      
      const task2Element = await schedulerPage.getTaskByTitle(tasks[2].title);
      if (task2Element) {
        await schedulerPage.dragTaskToQueue(task2Element, 0);
      }
      await page.waitForTimeout(500);
      
      await schedulerPage.refreshPage();
      
      await schedulerPage.assertTaskInQueue(tasks[0].title, 0);
      await schedulerPage.assertTaskInQueue(tasks[1].title, 1);
      await schedulerPage.assertTaskInQueue(tasks[2].title, 0);
    });

    test('同一任务连续移动多次应正确保存最终位置', async ({ page, request }) => {
      const task = await createTestTask(request, authToken, {
        title: generateUniqueTaskTitle(),
        queue_level: 2,
      });
      
      createdTasks.push(task);
      
      await schedulerPage.refreshPage();
      
      let taskElement = await schedulerPage.getTaskByTitle(task.title);
      if (taskElement) {
        await schedulerPage.dragTaskToQueue(taskElement, 0);
      }
      await page.waitForTimeout(500);
      
      taskElement = await schedulerPage.getTaskByTitle(task.title);
      if (taskElement) {
        await schedulerPage.dragTaskToQueue(taskElement, 1);
      }
      await page.waitForTimeout(500);
      
      taskElement = await schedulerPage.getTaskByTitle(task.title);
      if (taskElement) {
        await schedulerPage.dragTaskToQueue(taskElement, 2);
      }
      await page.waitForTimeout(500);
      
      await schedulerPage.refreshPage();
      
      await schedulerPage.assertTaskInQueue(task.title, 2);
    });

    test('快速连续拖拽不应丢失数据', async ({ page, request }) => {
      const tasks = await Promise.all([
        createTestTask(request, authToken, { title: generateUniqueTaskTitle(), queue_level: 0 }),
        createTestTask(request, authToken, { title: generateUniqueTaskTitle(), queue_level: 1 }),
        createTestTask(request, authToken, { title: generateUniqueTaskTitle(), queue_level: 2 }),
      ]);
      
      createdTasks.push(...tasks);
      
      await schedulerPage.refreshPage();
      
      const dragPromises: Promise<void>[] = [];
      
      for (let i = 0; i < tasks.length; i++) {
        const taskElement = await schedulerPage.getTaskByTitle(tasks[i].title);
        if (taskElement) {
          const targetQueue = (i + 1) % 3;
          dragPromises.push(
            schedulerPage.dragTaskToQueue(taskElement, targetQueue).then(() => 
              page.waitForTimeout(200)
            )
          );
        }
      }
      
      await Promise.all(dragPromises);
      
      await page.waitForTimeout(1000);
      
      await schedulerPage.refreshPage();
      
      let foundCount = 0;
      for (const task of tasks) {
        for (let q = 0; q <= 2; q++) {
          try {
            await schedulerPage.assertTaskInQueue(task.title, q);
            foundCount++;
            break;
          } catch {
            // Task not in this queue, try next
          }
        }
      }
      
      expect(foundCount).toBe(tasks.length);
    });
  });
});
