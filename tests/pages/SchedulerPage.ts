import { Page, Locator, expect } from '@playwright/test';

interface TaskInfo {
  id: string;
  title: string;
  queueLevel: number;
}

export class SchedulerPage {
  readonly page: Page;
  readonly schedulerUrl: string;
  
  readonly queueContainers: Locator;
  readonly queue0: Locator;
  readonly queue1: Locator;
  readonly queue2: Locator;
  readonly taskCards: Locator;
  readonly newTaskButton: Locator;
  readonly refreshButton: Locator;
  readonly settingsButton: Locator;
  readonly headerStats: Locator;
  readonly pendingCount: Locator;
  readonly inProgressCount: Locator;
  readonly completedCount: Locator;
  readonly totalEstimatedTime: Locator;

  constructor(page: Page) {
    this.page = page;
    this.schedulerUrl = '/scheduler';
    
    this.queueContainers = page.locator('[class*="flex"][class*="gap-6"] > div');
    this.queue0 = page.locator('[id="queue-0"], [data-queue="0"]').first();
    this.queue1 = page.locator('[id="queue-1"], [data-queue="1"]').first();
    this.queue2 = page.locator('[id="queue-2"], [data-queue="2"]').first();
    this.taskCards = page.locator('[class*="cursor-grab"]');
    this.newTaskButton = page.getByRole('button', { name: /新建任务|添加任务/ });
    this.refreshButton = page.locator('button').filter({ hasText: '' }).getByRole('button').nth(1);
    this.settingsButton = page.locator('button').filter({ has: page.locator('svg') }).nth(2);
    this.headerStats = page.locator('[class*="flex"][class*="gap-6"][class*="mt-4"]');
    this.pendingCount = this.headerStats.locator('text=/待处理/').locator('..').locator('span').last();
    this.inProgressCount = this.headerStats.locator('text=/进行中/').locator('..').locator('span').last();
    this.completedCount = this.headerStats.locator('text=/已完成/').locator('..').locator('span').last();
    this.totalEstimatedTime = this.headerStats.locator('text=/预计时长/').locator('..').locator('span').last();
  }

  async navigate() {
    await this.page.goto(this.schedulerUrl);
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForSelector('text=任务调度器', { timeout: 15000 });
    await this.page.waitForTimeout(2000);
  }

  getQueueByLevel(level: number): Locator {
    const queueMap: Record<number, Locator> = {
      0: this.queue0,
      1: this.queue1,
      2: this.queue2,
    };
    return queueMap[level] || this.queue2;
  }

  async getQueueContainer(level: number): Promise<Locator> {
    const queueTitles = ['紧急队列', '重要队列', '待办队列'];
    const title = queueTitles[level] || '待办队列';
    return this.page.locator('div').filter({ hasText: new RegExp(title) }).first();
  }

  async getTasksInQueue(level: number): Promise<Locator[]> {
    const container = await this.getQueueContainer(level);
    return container.locator('[class*="cursor-grab"]').all();
  }

  async getTaskCountInQueue(level: number): Promise<number> {
    const tasks = await this.getTasksInQueue(level);
    return tasks.length;
  }

  async getTaskByTitle(title: string): Promise<Locator | null> {
    const taskCard = this.page.locator('[class*="cursor-grab"]').filter({ hasText: title }).first();
    const count = await taskCard.count();
    return count > 0 ? taskCard : null;
  }

  async getTaskInfo(taskElement: Locator): Promise<TaskInfo | null> {
    try {
      const title = await taskElement.locator('h4').textContent();
      const badgeText = await taskElement.locator('span').filter({ hasText: /^Q[0-2]$/ }).textContent();
      const queueLevel = badgeText ? parseInt(badgeText.replace('Q', '')) : 2;
      
      const id = await taskElement.getAttribute('data-id') || '';
      
      return {
        id,
        title: title || '',
        queueLevel,
      };
    } catch {
      return null;
    }
  }

  async dragTaskToQueue(
    sourceTask: Locator,
    targetQueueLevel: number
  ): Promise<void> {
    const targetContainer = await this.getQueueContainer(targetQueueLevel);
    
    await sourceTask.hover();
    await this.page.mouse.down();
    
    await targetContainer.hover();
    await this.page.waitForTimeout(100);
    
    await this.page.mouse.up();
    await this.page.waitForTimeout(300);
  }

  async dragTaskToPosition(
    sourceTask: Locator,
    targetQueueLevel: number,
    targetIndex: number
  ): Promise<void> {
    const tasks = await this.getTasksInQueue(targetQueueLevel);
    
    if (targetIndex >= tasks.length) {
      await this.dragTaskToQueue(sourceTask, targetQueueLevel);
      return;
    }
    
    const targetTask = tasks[targetIndex];
    const sourceBox = await sourceTask.boundingBox();
    const targetBox = await targetTask.boundingBox();
    
    if (!sourceBox || !targetBox) {
      throw new Error('Could not get bounding boxes for drag operation');
    }
    
    await this.page.mouse.move(
      sourceBox.x + sourceBox.width / 2,
      sourceBox.y + sourceBox.height / 2
    );
    await this.page.mouse.down();
    
    await this.page.mouse.move(
      targetBox.x + targetBox.width / 2,
      targetBox.y + targetBox.height / 2
    );
    await this.page.waitForTimeout(100);
    
    await this.page.mouse.up();
    await this.page.waitForTimeout(300);
  }

  async reorderTaskInQueue(
    sourceIndex: number,
    targetIndex: number,
    queueLevel: number
  ): Promise<void> {
    const tasks = await this.getTasksInQueue(queueLevel);
    
    if (sourceIndex >= tasks.length || targetIndex >= tasks.length) {
      throw new Error('Invalid source or target index');
    }
    
    const sourceTask = tasks[sourceIndex];
    const targetTask = tasks[targetIndex];
    
    const sourceBox = await sourceTask.boundingBox();
    const targetBox = await targetTask.boundingBox();
    
    if (!sourceBox || !targetBox) {
      throw new Error('Could not get bounding boxes for drag operation');
    }
    
    await this.page.mouse.move(
      sourceBox.x + sourceBox.width / 2,
      sourceBox.y + sourceBox.height / 2
    );
    await this.page.mouse.down();
    
    await this.page.mouse.move(
      targetBox.x + targetBox.width / 2,
      targetBox.y + targetBox.height / 2
    );
    await this.page.waitForTimeout(100);
    
    await this.page.mouse.up();
    await this.page.waitForTimeout(300);
  }

  async cancelDrag(sourceTask: Locator): Promise<void> {
    const sourceBox = await sourceTask.boundingBox();
    
    if (!sourceBox) {
      throw new Error('Could not get bounding box for drag operation');
    }
    
    await this.page.mouse.move(
      sourceBox.x + sourceBox.width / 2,
      sourceBox.y + sourceBox.height / 2
    );
    await this.page.mouse.down();
    
    await this.page.mouse.move(0, 0);
    await this.page.waitForTimeout(100);
    
    await this.page.mouse.up();
    await this.page.waitForTimeout(300);
  }

  async isQueueHighlighted(level: number): Promise<boolean> {
    const container = await this.getQueueContainer(level);
    const className = await container.getAttribute('class');
    return className?.includes('ring-2') || className?.includes('ring-offset') || false;
  }

  async isTaskDragging(task: Locator): Promise<boolean> {
    const className = await task.getAttribute('class');
    return className?.includes('dragging') || className?.includes('opacity-90') || false;
  }

  async getDragOverlay(): Promise<Locator> {
    return this.page.locator('[class*="DragOverlay"], [class*="opacity-90"]').first();
  }

  async getQueueTaskCount(level: number): Promise<string> {
    const container = await this.getQueueContainer(level);
    const countText = await container.locator('text=/任务:/').textContent();
    const match = countText?.match(/任务:\s*(\d+)/);
    return match ? match[1] : '0';
  }

  async getQueueEstimatedTime(level: number): Promise<string | null> {
    const container = await this.getQueueContainer(level);
    const timeText = await container.locator('text=/预计:/').textContent();
    return timeText || null;
  }

  async getPendingCount(): Promise<string> {
    return await this.pendingCount.textContent() || '0';
  }

  async getInProgressCount(): Promise<string> {
    return await this.inProgressCount.textContent() || '0';
  }

  async getCompletedCount(): Promise<string> {
    return await this.completedCount.textContent() || '0';
  }

  async refreshPage(): Promise<void> {
    await this.page.reload({ waitUntil: 'networkidle' });
    await this.page.waitForSelector('text=任务调度器', { timeout: 10000 });
  }

  async clickRefreshButton(): Promise<void> {
    const refreshBtn = this.page.locator('button').filter({ has: this.page.locator('svg') }).nth(1);
    await refreshBtn.click();
    await this.page.waitForTimeout(500);
  }

  async waitForApiCall(method: string, urlPattern: string): Promise<void> {
    await this.page.waitForRequest(
      (request) => request.method() === method && request.url().includes(urlPattern)
    );
  }

  async assertTaskInQueue(taskTitle: string, queueLevel: number): Promise<void> {
    const container = await this.getQueueContainer(queueLevel);
    const task = container.locator(`text="${taskTitle}"`);
    await expect(task).toBeVisible({ timeout: 5000 });
  }

  async assertTaskNotInQueue(taskTitle: string, queueLevel: number): Promise<void> {
    const container = await this.getQueueContainer(queueLevel);
    const task = container.locator(`text="${taskTitle}"`);
    await expect(task).not.toBeVisible({ timeout: 5000 });
  }

  async getTaskOrderInQueue(queueLevel: number): Promise<string[]> {
    const tasks = await this.getTasksInQueue(queueLevel);
    const titles: string[] = [];
    
    for (const task of tasks) {
      const title = await task.locator('h4').textContent();
      if (title) {
        titles.push(title.trim());
      }
    }
    
    return titles;
  }
}
