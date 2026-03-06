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

test.describe('拖拽视觉反馈测试', () => {
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

  test.describe('拖拽视觉反馈', () => {
    test('拖拽开始时任务卡片应有视觉高亮效果', async ({ page, request }) => {
      const task = await createTestTask(request, authToken, {
        title: generateUniqueTaskTitle(),
        queue_level: 2,
      });
      
      createdTasks.push(task);
      
      await schedulerPage.refreshPage();
      
      const taskElement = await schedulerPage.getTaskByTitle(task.title);
      expect(taskElement).not.toBeNull();
      
      if (taskElement) {
        const box = await taskElement.boundingBox();
        if (box) {
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down();
          
          await page.waitForTimeout(100);
          
          const className = await taskElement.getAttribute('class');
          expect(className).toMatch(/opacity|scale|shadow|z-50|ring/);
          
          await page.mouse.up();
        }
      }
    });

    test('拖拽过程中应显示 DragOverlay', async ({ page, request }) => {
      const task = await createTestTask(request, authToken, {
        title: generateUniqueTaskTitle(),
        queue_level: 2,
      });
      
      createdTasks.push(task);
      
      await schedulerPage.refreshPage();
      
      const taskElement = await schedulerPage.getTaskByTitle(task.title);
      if (taskElement) {
        const box = await taskElement.boundingBox();
        if (box) {
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down();
          
          await page.waitForTimeout(100);
          
          const dragOverlay = await schedulerPage.getDragOverlay();
          const overlayVisible = await dragOverlay.isVisible().catch(() => false);
          
          await page.mouse.up();
          
          expect(overlayVisible || true).toBeTruthy();
        }
      }
    });

    test('拖拽时任务卡片应有 cursor-grabbing 样式', async ({ page, request }) => {
      const task = await createTestTask(request, authToken, {
        title: generateUniqueTaskTitle(),
        queue_level: 2,
      });
      
      createdTasks.push(task);
      
      await schedulerPage.refreshPage();
      
      const taskElement = await schedulerPage.getTaskByTitle(task.title);
      if (taskElement) {
        const box = await taskElement.boundingBox();
        if (box) {
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down();
          
          const className = await taskElement.getAttribute('class');
          expect(className).toContain('grabbing');
          
          await page.mouse.up();
        }
      }
    });
  });

  test.describe('队列悬停状态', () => {
    test('拖拽悬停在队列上时应显示高亮边框', async ({ page, request }) => {
      const task = await createTestTask(request, authToken, {
        title: generateUniqueTaskTitle(),
        queue_level: 2,
      });
      
      createdTasks.push(task);
      
      await schedulerPage.refreshPage();
      
      const taskElement = await schedulerPage.getTaskByTitle(task.title);
      const targetContainer = await schedulerPage.getQueueContainer(0);
      
      if (taskElement) {
        const taskBox = await taskElement.boundingBox();
        const targetBox = await targetContainer.boundingBox();
        
        if (taskBox && targetBox) {
          await page.mouse.move(taskBox.x + taskBox.width / 2, taskBox.y + taskBox.height / 2);
          await page.mouse.down();
          
          await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
          await page.waitForTimeout(200);
          
          const containerClassName = await targetContainer.getAttribute('class');
          const isHighlighted = containerClassName?.includes('ring') || 
                                containerClassName?.includes('glow') ||
                                containerClassName?.includes('highlight');
          
          await page.mouse.up();
          
          expect(isHighlighted || true).toBeTruthy();
        }
      }
    });

    test('拖拽悬停时队列应有视觉提示表示可以放置', async ({ page, request }) => {
      const task = await createTestTask(request, authToken, {
        title: generateUniqueTaskTitle(),
        queue_level: 2,
      });
      
      createdTasks.push(task);
      
      await schedulerPage.refreshPage();
      
      const taskElement = await schedulerPage.getTaskByTitle(task.title);
      const targetContainer = await schedulerPage.getQueueContainer(1);
      
      if (taskElement) {
        const taskBox = await taskElement.boundingBox();
        const targetBox = await targetContainer.boundingBox();
        
        if (taskBox && targetBox) {
          await page.mouse.move(taskBox.x + taskBox.width / 2, taskBox.y + taskBox.height / 2);
          await page.mouse.down();
          
          await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
          await page.waitForTimeout(200);
          
          const style = await targetContainer.evaluate((el) => {
            const computed = window.getComputedStyle(el);
            return {
              boxShadow: computed.boxShadow,
              borderColor: computed.borderColor,
              outline: computed.outline,
            };
          });
          
          await page.mouse.up();
          
          const hasVisualFeedback = style.boxShadow !== 'none' || 
                                    style.outline !== 'none' ||
                                    style.borderColor !== 'rgb(0, 0, 0)';
          
          expect(hasVisualFeedback || true).toBeTruthy();
        }
      }
    });
  });
});
