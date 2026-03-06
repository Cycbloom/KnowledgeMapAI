import { test, expect } from "@playwright/test";
import { SchedulerPage } from "./pages/SchedulerPage";
import {
  login,
  createTestTask,
  deleteTestTask,
  deleteAllTestTasks,
  getAuthToken,
  generateUniqueTaskTitle,
  TestTask,
} from "./utils/schedulerHelpers";

test.describe("任务调度器拖拽功能测试", () => {
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
      await deleteAllTestTasks(request, authToken, "测试任务");
    } catch {
      // Ignore cleanup errors
    }
  });

  test.describe("同一队列内任务排序", () => {
    test("应该能够在同一队列内重新排序任务", async ({ page, request }) => {
      const task1 = await createTestTask(request, authToken, {
        title: generateUniqueTaskTitle(),
        queue_level: 2,
      });
      const task2 = await createTestTask(request, authToken, {
        title: generateUniqueTaskTitle(),
        queue_level: 2,
      });
      const task3 = await createTestTask(request, authToken, {
        title: generateUniqueTaskTitle(),
        queue_level: 2,
      });

      createdTasks.push(task1, task2, task3);

      await schedulerPage.refreshPage();

      const initialOrder = await schedulerPage.getTaskOrderInQueue(2);
      expect(initialOrder.length).toBeGreaterThanOrEqual(3);

      const firstTask = await schedulerPage.getTaskByTitle(task1.title);
      expect(firstTask).not.toBeNull();

      if (firstTask) {
        await schedulerPage.reorderTaskInQueue(0, 2, 2);
      }

      await page.waitForTimeout(500);

      const newOrder = await schedulerPage.getTaskOrderInQueue(2);
      expect(newOrder).not.toEqual(initialOrder);
    });

    test("任务排序后刷新页面应保持顺序", async ({ page, request }) => {
      const task1 = await createTestTask(request, authToken, {
        title: generateUniqueTaskTitle(),
        queue_level: 1,
      });
      const task2 = await createTestTask(request, authToken, {
        title: generateUniqueTaskTitle(),
        queue_level: 1,
      });

      createdTasks.push(task1, task2);

      await schedulerPage.refreshPage();

      const firstTask = await schedulerPage.getTaskByTitle(task1.title);
      if (firstTask) {
        await schedulerPage.reorderTaskInQueue(0, 1, 1);
      }

      await page.waitForTimeout(500);

      const orderBeforeRefresh = await schedulerPage.getTaskOrderInQueue(1);

      await schedulerPage.refreshPage();

      const orderAfterRefresh = await schedulerPage.getTaskOrderInQueue(1);
      expect(orderAfterRefresh).toEqual(orderBeforeRefresh);
    });
  });

  test.describe("跨队列移动任务", () => {
    test("应该能够将任务从一个队列移动到另一个队列", async ({
      page,
      request,
    }) => {
      const task = await createTestTask(request, authToken, {
        title: generateUniqueTaskTitle(),
        queue_level: 2,
      });

      createdTasks.push(task);

      await schedulerPage.refreshPage();

      await schedulerPage.assertTaskInQueue(task.title, 2);

      const taskElement = await schedulerPage.getTaskByTitle(task.title);
      expect(taskElement).not.toBeNull();

      if (taskElement) {
        await schedulerPage.dragTaskToQueue(taskElement, 0);
      }

      await page.waitForTimeout(500);

      await schedulerPage.assertTaskInQueue(task.title, 0);
      await schedulerPage.assertTaskNotInQueue(task.title, 2);
    });

    test("跨队列移动后刷新页面任务应在目标队列", async ({ page, request }) => {
      const task = await createTestTask(request, authToken, {
        title: generateUniqueTaskTitle(),
        queue_level: 0,
      });

      createdTasks.push(task);

      await schedulerPage.refreshPage();

      const taskElement = await schedulerPage.getTaskByTitle(task.title);
      if (taskElement) {
        await schedulerPage.dragTaskToQueue(taskElement, 1);
      }

      await page.waitForTimeout(500);

      await schedulerPage.refreshPage();

      await schedulerPage.assertTaskInQueue(task.title, 1);
    });

    test("应该能够将任务移动到更高优先级的队列", async ({ page, request }) => {
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
    });

    test("应该能够将任务移动到更低优先级的队列", async ({ page, request }) => {
      const task = await createTestTask(request, authToken, {
        title: generateUniqueTaskTitle(),
        queue_level: 0,
      });

      createdTasks.push(task);

      await schedulerPage.refreshPage();

      const taskElement = await schedulerPage.getTaskByTitle(task.title);
      if (taskElement) {
        await schedulerPage.dragTaskToQueue(taskElement, 2);
      }

      await page.waitForTimeout(500);

      await schedulerPage.assertTaskInQueue(task.title, 2);
    });
  });

  test.describe("拖拽到空队列", () => {
    test("应该能够将任务拖拽到空队列", async ({ page, request }) => {
      const tasks = await Promise.all([
        createTestTask(request, authToken, {
          title: generateUniqueTaskTitle(),
          queue_level: 2,
        }),
        createTestTask(request, authToken, {
          title: generateUniqueTaskTitle(),
          queue_level: 2,
        }),
        createTestTask(request, authToken, {
          title: generateUniqueTaskTitle(),
          queue_level: 2,
        }),
      ]);

      createdTasks.push(...tasks);

      await schedulerPage.refreshPage();

      const taskElement = await schedulerPage.getTaskByTitle(tasks[0].title);
      if (taskElement) {
        await schedulerPage.dragTaskToQueue(taskElement, 0);
      }

      await page.waitForTimeout(500);

      await schedulerPage.assertTaskInQueue(tasks[0].title, 0);
    });
  });

  test.describe("拖拽取消操作", () => {
    test("取消拖拽后任务应返回原位置", async ({ page, request }) => {
      const task = await createTestTask(request, authToken, {
        title: generateUniqueTaskTitle(),
        queue_level: 2,
      });

      createdTasks.push(task);

      await schedulerPage.refreshPage();

      const initialOrder = await schedulerPage.getTaskOrderInQueue(2);

      const taskElement = await schedulerPage.getTaskByTitle(task.title);
      if (taskElement) {
        await schedulerPage.cancelDrag(taskElement);
      }

      await page.waitForTimeout(300);

      const finalOrder = await schedulerPage.getTaskOrderInQueue(2);
      expect(finalOrder).toEqual(initialOrder);
    });
  });
});
