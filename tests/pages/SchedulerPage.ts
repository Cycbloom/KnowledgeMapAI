import { Locator, Page } from '@playwright/test';

export class SchedulerPage {
  readonly page: Page;
  readonly title: Locator;
  readonly newTaskButton: Locator;
  readonly taskList: Locator;
  readonly queueTabs: Locator;
  readonly startFocusButton: Locator;
  readonly sidebar: Locator;
  readonly taskInput: Locator;
  readonly taskTitleInput: Locator;
  readonly taskDescriptionInput: Locator;
  readonly cancelButton: Locator;
  readonly confirmButton: Locator;
  readonly settingsButton: Locator;
  readonly statsLink: Locator;
  readonly taskCards: Locator;
  readonly queueColumns: Locator;

  constructor(page: Page) {
    this.page = page;
    this.title = page.locator('h1, h2, h3, h4, h5, h6');
    this.newTaskButton = page.locator('button:has-text("新建任务"), button:has-text("添加任务")');
    this.taskList = page.locator('[data-testid="task-list"], [data-scheduler-task]');
    this.queueTabs = page.locator('[data-testid="queue-tab"]');
    this.startFocusButton = page.locator('button:has-text("开始专注"), button:has-text("开始")');
    this.sidebar = page.locator('nav');
    this.taskInput = page.locator('input[placeholder*="输入任务标题..."]');
    this.taskTitleInput = page.locator('input[name="task-title"]');
    this.taskDescriptionInput = page.locator('textarea[name="task-description"]');
    this.cancelButton = page.locator('button:has-text("取消"), button:has-text("cancel")');
    this.confirmButton = page.locator('button:has-text("确认"), button:has-text("创建")');
    this.settingsButton = page.locator('button:has-text("设置"), [data-testid="settings-button"]');
    this.statsLink = page.locator('a:has-text("统计"), a[href*="stats"], [data-testid="stats-link"]');
    this.taskCards = page.locator('[data-task-card], .task-card, [draggable="true"]');
    this.queueColumns = page.locator('[data-queue], .queue-column, [data-testid^="queue-"]');
  }

  async goto() {
    await this.page.goto('/scheduler');
    await this.page.waitForLoadState('networkidle');
  }

  async gotoStats() {
    await this.page.goto('/scheduler/stats');
    await this.page.waitForLoadState('networkidle');
  }

  async clickNewTask() {
    await this.newTaskButton.click();
  }

  async getTaskCount() {
    return await this.taskList.count();
  }

  async getTaskCardCount() {
    return await this.taskCards.count();
  }

  async clickQueueTab(index: number) {
    const tabs = await this.queueTabs.all();
    if (tabs[index]) {
      await tabs[index].click();
    }
  }

  async clickStartFocus() {
    await this.startFocusButton.click();
  }

  async fillTaskForm(title: string, description: string) {
    await this.taskTitleInput.fill(title);
    await this.taskDescriptionInput.fill(description);
  }

  async fillTaskFormWithDetails(options: {
    title: string;
    description?: string;
    estimatedDuration?: number;
    priority?: number;
    queueLevel?: number;
    tags?: string[];
  }) {
    // 填写标题
    const titleInput = this.page.locator('input[placeholder*="任务标题"], input[name="task-title"]').first();
    await titleInput.fill(options.title);

    // 填写描述
    if (options.description) {
      const descInput = this.page.locator('textarea[placeholder*="描述"], textarea[name="task-description"]').first();
      await descInput.fill(options.description);
    }

    // 设置预估时长
    if (options.estimatedDuration) {
      const durationSelect = this.page.locator('select, [data-testid="duration-select"]').first();
      if (await durationSelect.count() > 0) {
        await durationSelect.selectOption(options.estimatedDuration.toString());
      }
    }

    // 设置优先级
    if (options.priority) {
      const priorityButtons = this.page.locator(`button:has-text("低"), button:has-text("中"), button:has-text("高"), button:has-text("紧急")`);
      const labels = ['低', '中', '高', '紧急'];
      const targetLabel = labels[options.priority - 1];
      if (targetLabel) {
        await priorityButtons.locator(`button:has-text("${targetLabel}")`).click();
      }
    }

    // 设置队列级别
    if (options.queueLevel !== undefined) {
      const queueButtons = this.page.locator('button:has-text("Q0"), button:has-text("Q1"), button:has-text("Q2")');
      const queueLabel = `Q${options.queueLevel}`;
      await queueButtons.locator(`button:has-text("${queueLabel}")`).click();
    }

    // 添加标签
    if (options.tags && options.tags.length > 0) {
      for (const tag of options.tags) {
        const tagInput = this.page.locator('input[placeholder*="标签"], input[placeholder*="tag"]').first();
        if (await tagInput.count() > 0) {
          await tagInput.fill(tag);
          await this.page.keyboard.press('Enter');
        }
      }
    }
  }

  async clickConfirm() {
    await this.confirmButton.click();
  }

  async clickCancel() {
    await this.cancelButton.click();
  }

  async toggleTheme() {
    const themeButton = this.page.locator('button[title*="主题"], button[title*="theme"], [data-testid="theme-toggle"]');
    await themeButton.click();
  }

  async createTask(title: string, description?: string, queueLevel?: number) {
    await this.clickNewTask();
    await this.page.waitForSelector('input[placeholder*="任务标题"], input[name="task-title"]', { timeout: 10000 });
    
    const titleInput = this.page.locator('input[placeholder*="任务标题"], input[name="task-title"]').first();
    await titleInput.fill(title);

    if (description) {
      const descInput = this.page.locator('textarea[placeholder*="描述"], textarea[name="task-description"]').first();
      await descInput.fill(description);
    }

    if (queueLevel !== undefined) {
      const queueButton = this.page.locator(`button:has-text("Q${queueLevel}")`).first();
      if (await queueButton.count() > 0) {
        await queueButton.click();
      }
    }

    const submitButton = this.page.locator('button:has-text("确认"), button:has-text("创建"), button[type="submit"]').first();
    await submitButton.click();

    // 等待任务创建成功
    await this.page.waitForSelector(`text="${title}"`, { timeout: 10000 });
  }

  async getTaskByTitle(title: string) {
    return this.page.locator(`text="${title}"`).first();
  }

  async getTaskCardByTitle(title: string) {
    return this.page.locator(`.task-card:has-text("${title}"), [data-task-card]:has-text("${title}")`).first();
  }

  async clickTaskAction(title: string, action: 'edit' | 'delete' | 'start' | 'pause' | 'complete') {
    const taskCard = await this.getTaskCardByTitle(title);
    await taskCard.hover();

    const actionButtons: Record<string, string[]> = {
      edit: ['button:has-text("编辑")', 'button[title="编辑"]'],
      delete: ['button:has-text("删除")', 'button[title="删除"]'],
      start: ['button:has-text("开始")', 'button[title="开始"]'],
      pause: ['button:has-text("暂停")', 'button[title="暂停"]'],
      complete: ['button:has-text("完成")', 'button[title="完成"]'],
    };

    for (const selector of actionButtons[action]) {
      const button = taskCard.locator(selector);
      if (await button.count() > 0) {
        await button.click();
        return;
      }
    }
  }

  async getQueueTaskCount(queueLevel: number) {
    const queueSelector = `[data-queue="q${queueLevel}"], [data-queue-level="${queueLevel}"], [data-testid="queue-q${queueLevel}"]`;
    const queue = this.page.locator(queueSelector).first();
    if (await queue.count() === 0) {
      return 0;
    }
    const tasks = queue.locator('.task-card, [data-task-card], [draggable="true"]');
    return await tasks.count();
  }

  async dragTaskToQueue(taskTitle: string, targetQueueLevel: number) {
    const task = await this.getTaskCardByTitle(taskTitle);
    const targetQueue = this.page.locator(
      `[data-queue="q${targetQueueLevel}"], [data-queue-level="${targetQueueLevel}"], [data-testid="queue-q${targetQueueLevel}"]`
    ).first();

    if (await targetQueue.count() > 0) {
      await task.dragTo(targetQueue);
    }
  }

  async openSettings() {
    await this.settingsButton.click();
  }

  async getStats() {
    const stats = {
      total: 0,
      pending: 0,
      inProgress: 0,
      completed: 0,
      totalEstimated: 0,
    };

    // 尝试从页面获取统计数据
    const pendingBadge = this.page.locator('text=/待处理.*\\d+/');
    const inProgressBadge = this.page.locator('text=/进行中.*\\d+/');
    const completedBadge = this.page.locator('text=/已完成.*\\d+/');

    if (await pendingBadge.count() > 0) {
      const text = await pendingBadge.textContent();
      const match = text?.match(/\d+/);
      if (match) stats.pending = parseInt(match[0]);
    }

    if (await inProgressBadge.count() > 0) {
      const text = await inProgressBadge.textContent();
      const match = text?.match(/\d+/);
      if (match) stats.inProgress = parseInt(match[0]);
    }

    if (await completedBadge.count() > 0) {
      const text = await completedBadge.textContent();
      const match = text?.match(/\d+/);
      if (match) stats.completed = parseInt(match[0]);
    }

    stats.total = stats.pending + stats.inProgress + stats.completed;
    return stats;
  }

  async waitForTaskToAppear(title: string, timeout = 10000) {
    await this.page.waitForSelector(`text="${title}"`, { timeout });
  }

  async waitForTaskToDisappear(title: string, timeout = 5000) {
    await this.page.waitForSelector(`text="${title}"`, { state: 'hidden', timeout });
  }

  async confirmDialog() {
    const confirmButton = this.page.locator('button:has-text("确认"), button:has-text("确定")').first();
    if (await confirmButton.count() > 0) {
      await confirmButton.click();
    }
  }
}
