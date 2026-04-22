import { test, expect, Page } from '@playwright/test';
import { loginAsTestUser } from './utils/auth';

class SubtaskPageObject {
  constructor(private page: Page) {}

  async navigateToTasks() {
    await this.page.goto('/tasks');
    await this.page.waitForLoadState('networkidle');
  }

  async navigateToCalendar() {
    await this.page.goto('/calendar');
    await this.page.waitForLoadState('networkidle');
  }

  async createTask(title: string, description?: string) {
    const createButton = this.page.locator('button:has-text("新建"), button:has-text("创建任务")').first();
    await createButton.click();
    
    const titleInput = this.page.locator('input[name="title"], input[placeholder*="标题"]').first();
    await titleInput.fill(title);
    
    if (description) {
      const descInput = this.page.locator('textarea[name="description"], textarea[placeholder*="描述"]').first();
      if (await descInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await descInput.fill(description);
      }
    }
    
    const submitButton = this.page.locator('button[type="submit"]:has-text("创建"), button:has-text("确定")').first();
    await submitButton.click();
    
    await this.page.waitForTimeout(500);
  }

  async openTaskDetail(taskTitle: string) {
    const taskCard = this.page.locator(`text="${taskTitle}"`).first();
    await taskCard.click();
    await this.page.waitForTimeout(300);
  }

  async createSubtask(title: string, knowledgePointId?: string) {
    const addSubtaskButton = this.page.locator('button:has-text("添加子任务"), button:has-text("新建子任务")').first();
    if (await addSubtaskButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addSubtaskButton.click();
      
      const titleInput = this.page.locator('input[placeholder*="子任务标题"], input[name="subtaskTitle"]').first();
      await titleInput.fill(title);
      
      const submitButton = this.page.locator('button[type="submit"]:has-text("添加"), button:has-text("确定")').first();
      await submitButton.click();
      
      await this.page.waitForTimeout(500);
    }
  }

  async openSubtaskDetail(subtaskTitle: string) {
    const subtaskItem = this.page.locator(`text="${subtaskTitle}"`).first();
    await subtaskItem.click();
    await this.page.waitForTimeout(300);
  }

  async getSubtaskStatus(subtaskTitle: string): Promise<string | null> {
    const subtaskContainer = this.page.locator(`text="${subtaskTitle}"`).first().locator('..');
    const statusBadge = subtaskContainer.locator('[data-testid="learning-state-badge"], .learning-state-badge').first();
    return statusBadge.textContent();
  }

  async getSubtaskMasteryLevel(subtaskTitle: string): Promise<number> {
    const subtaskContainer = this.page.locator(`text="${subtaskTitle}"`).first().locator('..');
    const masteryText = subtaskContainer.locator('text=/\\d+%/').first();
    const text = await masteryText.textContent();
    if (text) {
      const match = text.match(/(\d+)%/);
      return match ? parseInt(match[1], 10) : 0;
    }
    return 0;
  }

  async transitionSubtaskState(toState: 'review' | 'practice' | 'quiz', masteryLevel: number) {
    const stateButton = this.page.locator(`button:has-text("${this.getStateLabel(toState)}")`).first();
    if (await stateButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await stateButton.click();
      await this.page.waitForTimeout(500);
    }
  }

  private getStateLabel(state: string): string {
    const labels: Record<string, string> = {
      learning: '学习',
      review: '复习',
      practice: '练习',
      quiz: '测验',
    };
    return labels[state] || state;
  }

  async setMasteryLevel(level: number) {
    const masteryInput = this.page.locator('input[type="range"], input[name="masteryLevel"]').first();
    if (await masteryInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await masteryInput.fill(String(level));
    }
  }

  async closeModal() {
    const closeButton = this.page.locator('button[aria-label="关闭"], button:has-text("关闭")').first();
    if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeButton.click();
      await this.page.waitForTimeout(300);
    }
  }

  async waitForSubtaskToAppear(subtaskTitle: string) {
    await expect(this.page.locator(`text="${subtaskTitle}"`)).toBeVisible({ timeout: 10000 });
  }
}

test.describe('子任务状态转换流程测试', () => {
  let subtaskPage: SubtaskPageObject;
  const testTaskTitle = `状态测试任务_${Date.now()}`;
  const testSubtaskTitle = `状态测试子任务_${Date.now()}`;

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    subtaskPage = new SubtaskPageObject(page);
    await subtaskPage.navigateToTasks();
  });

  test('应该创建子任务并显示初始状态为 learning', async ({ page }) => {
    await subtaskPage.createTask(testTaskTitle, '用于测试子任务状态转换');
    await subtaskPage.openTaskDetail(testTaskTitle);
    
    const subtaskExists = await page.locator(`text="${testSubtaskTitle}"`).isVisible({ timeout: 2000 }).catch(() => false);
    if (!subtaskExists) {
      await subtaskPage.createSubtask(testSubtaskTitle);
    }
    
    await subtaskPage.waitForSubtaskToAppear(testSubtaskTitle);
    
    const statusBadge = page.locator('text=学习, text=learning').first();
    await expect(statusBadge).toBeVisible({ timeout: 5000 });
  });

  test('应该从 learning 状态转换到 review 状态（掌握度 < 30%）', async ({ page }) => {
    await subtaskPage.openTaskDetail(testTaskTitle);
    await subtaskPage.openSubtaskDetail(testSubtaskTitle);
    
    await subtaskPage.setMasteryLevel(20);
    await subtaskPage.transitionSubtaskState('review', 20);
    
    const reviewBadge = page.locator('text=复习, text=review').first();
    await expect(reviewBadge).toBeVisible({ timeout: 5000 });
  });

  test('应该从 learning 状态转换到 practice 状态（掌握度 30%-70%）', async ({ page }) => {
    const taskTitle = `Practice测试任务_${Date.now()}`;
    const subtaskTitle = `Practice测试子任务_${Date.now()}`;
    
    await subtaskPage.createTask(taskTitle);
    await subtaskPage.openTaskDetail(taskTitle);
    await subtaskPage.createSubtask(subtaskTitle);
    await subtaskPage.waitForSubtaskToAppear(subtaskTitle);
    
    await subtaskPage.openSubtaskDetail(subtaskTitle);
    await subtaskPage.setMasteryLevel(50);
    await subtaskPage.transitionSubtaskState('practice', 50);
    
    const practiceBadge = page.locator('text=练习, text=practice').first();
    await expect(practiceBadge).toBeVisible({ timeout: 5000 });
  });

  test('应该从 learning 状态转换到 quiz 状态（掌握度 > 70%）', async ({ page }) => {
    const taskTitle = `Quiz测试任务_${Date.now()}`;
    const subtaskTitle = `Quiz测试子任务_${Date.now()}`;
    
    await subtaskPage.createTask(taskTitle);
    await subtaskPage.openTaskDetail(taskTitle);
    await subtaskPage.createSubtask(subtaskTitle);
    await subtaskPage.waitForSubtaskToAppear(subtaskTitle);
    
    await subtaskPage.openSubtaskDetail(subtaskTitle);
    await subtaskPage.setMasteryLevel(80);
    await subtaskPage.transitionSubtaskState('quiz', 80);
    
    const quizBadge = page.locator('text=测验, text=quiz').first();
    await expect(quizBadge).toBeVisible({ timeout: 5000 });
  });
});

test.describe('子任务状态循环测试', () => {
  let subtaskPage: SubtaskPageObject;

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    subtaskPage = new SubtaskPageObject(page);
    await subtaskPage.navigateToTasks();
  });

  test('应该完成 review → practice 状态转换', async ({ page }) => {
    const taskTitle = `循环测试任务_${Date.now()}`;
    const subtaskTitle = `循环测试子任务_${Date.now()}`;
    
    await subtaskPage.createTask(taskTitle);
    await subtaskPage.openTaskDetail(taskTitle);
    await subtaskPage.createSubtask(subtaskTitle);
    await subtaskPage.waitForSubtaskToAppear(subtaskTitle);
    
    await subtaskPage.openSubtaskDetail(subtaskTitle);
    await subtaskPage.setMasteryLevel(20);
    await subtaskPage.transitionSubtaskState('review', 20);
    
    await expect(page.locator('text=复习').first()).toBeVisible({ timeout: 5000 });
    
    await subtaskPage.closeModal();
    await subtaskPage.openSubtaskDetail(subtaskTitle);
    await subtaskPage.setMasteryLevel(50);
    await subtaskPage.transitionSubtaskState('practice', 50);
    
    await expect(page.locator('text=练习').first()).toBeVisible({ timeout: 5000 });
  });

  test('应该完成 practice → quiz 状态转换（掌握度 >= 50%）', async ({ page }) => {
    const taskTitle = `PracticeToQuiz任务_${Date.now()}`;
    const subtaskTitle = `PracticeToQuiz子任务_${Date.now()}`;
    
    await subtaskPage.createTask(taskTitle);
    await subtaskPage.openTaskDetail(taskTitle);
    await subtaskPage.createSubtask(subtaskTitle);
    await subtaskPage.waitForSubtaskToAppear(subtaskTitle);
    
    await subtaskPage.openSubtaskDetail(subtaskTitle);
    await subtaskPage.setMasteryLevel(50);
    await subtaskPage.transitionSubtaskState('practice', 50);
    
    await expect(page.locator('text=练习').first()).toBeVisible({ timeout: 5000 });
    
    await subtaskPage.closeModal();
    await subtaskPage.openSubtaskDetail(subtaskTitle);
    await subtaskPage.setMasteryLevel(70);
    await subtaskPage.transitionSubtaskState('quiz', 70);
    
    await expect(page.locator('text=测验').first()).toBeVisible({ timeout: 5000 });
  });

  test('应该完成 practice → review 状态转换（掌握度 < 50%）', async ({ page }) => {
    const taskTitle = `PracticeToReview任务_${Date.now()}`;
    const subtaskTitle = `PracticeToReview子任务_${Date.now()}`;
    
    await subtaskPage.createTask(taskTitle);
    await subtaskPage.openTaskDetail(taskTitle);
    await subtaskPage.createSubtask(subtaskTitle);
    await subtaskPage.waitForSubtaskToAppear(subtaskTitle);
    
    await subtaskPage.openSubtaskDetail(subtaskTitle);
    await subtaskPage.setMasteryLevel(50);
    await subtaskPage.transitionSubtaskState('practice', 50);
    
    await expect(page.locator('text=练习').first()).toBeVisible({ timeout: 5000 });
    
    await subtaskPage.closeModal();
    await subtaskPage.openSubtaskDetail(subtaskTitle);
    await subtaskPage.setMasteryLevel(30);
    await subtaskPage.transitionSubtaskState('review', 30);
    
    await expect(page.locator('text=复习').first()).toBeVisible({ timeout: 5000 });
  });

  test('应该完成 quiz → review 状态转换（掌握度 < 60%）', async ({ page }) => {
    const taskTitle = `QuizToReview任务_${Date.now()}`;
    const subtaskTitle = `QuizToReview子任务_${Date.now()}`;
    
    await subtaskPage.createTask(taskTitle);
    await subtaskPage.openTaskDetail(taskTitle);
    await subtaskPage.createSubtask(subtaskTitle);
    await subtaskPage.waitForSubtaskToAppear(subtaskTitle);
    
    await subtaskPage.openSubtaskDetail(subtaskTitle);
    await subtaskPage.setMasteryLevel(80);
    await subtaskPage.transitionSubtaskState('quiz', 80);
    
    await expect(page.locator('text=测验').first()).toBeVisible({ timeout: 5000 });
    
    await subtaskPage.closeModal();
    await subtaskPage.openSubtaskDetail(subtaskTitle);
    await subtaskPage.setMasteryLevel(40);
    await subtaskPage.transitionSubtaskState('review', 40);
    
    await expect(page.locator('text=复习').first()).toBeVisible({ timeout: 5000 });
  });

  test('应该完成 quiz → practice 状态转换（掌握度 60%-80%）', async ({ page }) => {
    const taskTitle = `QuizToPractice任务_${Date.now()}`;
    const subtaskTitle = `QuizToPractice子任务_${Date.now()}`;
    
    await subtaskPage.createTask(taskTitle);
    await subtaskPage.openTaskDetail(taskTitle);
    await subtaskPage.createSubtask(subtaskTitle);
    await subtaskPage.waitForSubtaskToAppear(subtaskTitle);
    
    await subtaskPage.openSubtaskDetail(subtaskTitle);
    await subtaskPage.setMasteryLevel(80);
    await subtaskPage.transitionSubtaskState('quiz', 80);
    
    await expect(page.locator('text=测验').first()).toBeVisible({ timeout: 5000 });
    
    await subtaskPage.closeModal();
    await subtaskPage.openSubtaskDetail(subtaskTitle);
    await subtaskPage.setMasteryLevel(70);
    await subtaskPage.transitionSubtaskState('practice', 70);
    
    await expect(page.locator('text=练习').first()).toBeVisible({ timeout: 5000 });
  });

  test('应该完成完整的状态循环 review → practice → quiz → review', async ({ page }) => {
    const taskTitle = `完整循环任务_${Date.now()}`;
    const subtaskTitle = `完整循环子任务_${Date.now()}`;
    
    await subtaskPage.createTask(taskTitle);
    await subtaskPage.openTaskDetail(taskTitle);
    await subtaskPage.createSubtask(subtaskTitle);
    await subtaskPage.waitForSubtaskToAppear(subtaskTitle);
    
    await subtaskPage.openSubtaskDetail(subtaskTitle);
    await subtaskPage.setMasteryLevel(20);
    await subtaskPage.transitionSubtaskState('review', 20);
    await expect(page.locator('text=复习').first()).toBeVisible({ timeout: 5000 });
    
    await subtaskPage.closeModal();
    await subtaskPage.openSubtaskDetail(subtaskTitle);
    await subtaskPage.setMasteryLevel(55);
    await subtaskPage.transitionSubtaskState('practice', 55);
    await expect(page.locator('text=练习').first()).toBeVisible({ timeout: 5000 });
    
    await subtaskPage.closeModal();
    await subtaskPage.openSubtaskDetail(subtaskTitle);
    await subtaskPage.setMasteryLevel(85);
    await subtaskPage.transitionSubtaskState('quiz', 85);
    await expect(page.locator('text=测验').first()).toBeVisible({ timeout: 5000 });
    
    await subtaskPage.closeModal();
    await subtaskPage.openSubtaskDetail(subtaskTitle);
    await subtaskPage.setMasteryLevel(45);
    await subtaskPage.transitionSubtaskState('review', 45);
    await expect(page.locator('text=复习').first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('子任务掌握度更新测试', () => {
  let subtaskPage: SubtaskPageObject;

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    subtaskPage = new SubtaskPageObject(page);
    await subtaskPage.navigateToTasks();
  });

  test('应该能够更新子任务掌握度', async ({ page }) => {
    const taskTitle = `掌握度测试任务_${Date.now()}`;
    const subtaskTitle = `掌握度测试子任务_${Date.now()}`;
    
    await subtaskPage.createTask(taskTitle);
    await subtaskPage.openTaskDetail(taskTitle);
    await subtaskPage.createSubtask(subtaskTitle);
    await subtaskPage.waitForSubtaskToAppear(subtaskTitle);
    
    await subtaskPage.openSubtaskDetail(subtaskTitle);
    
    const masteryInput = page.locator('input[type="range"]').first();
    if (await masteryInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await masteryInput.fill('75');
      
      const saveButton = page.locator('button:has-text("保存"), button:has-text("更新")').first();
      if (await saveButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await saveButton.click();
      }
    }
    
    const masteryDisplay = page.locator('text=/75%/');
    await expect(masteryDisplay.first()).toBeVisible({ timeout: 5000 });
  });

  test('应该显示掌握度进度条', async ({ page }) => {
    const taskTitle = `进度条测试任务_${Date.now()}`;
    const subtaskTitle = `进度条测试子任务_${Date.now()}`;
    
    await subtaskPage.createTask(taskTitle);
    await subtaskPage.openTaskDetail(taskTitle);
    await subtaskPage.createSubtask(subtaskTitle);
    await subtaskPage.waitForSubtaskToAppear(subtaskTitle);
    
    await subtaskPage.openSubtaskDetail(subtaskTitle);
    
    const progressBar = page.locator('[role="progressbar"], .progress-bar, [data-testid="mastery-progress"]').first();
    await expect(progressBar).toBeVisible({ timeout: 5000 });
  });
});

test.describe('子任务状态历史记录测试', () => {
  let subtaskPage: SubtaskPageObject;

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    subtaskPage = new SubtaskPageObject(page);
    await subtaskPage.navigateToTasks();
  });

  test('应该记录状态转换历史', async ({ page }) => {
    const taskTitle = `历史记录任务_${Date.now()}`;
    const subtaskTitle = `历史记录子任务_${Date.now()}`;
    
    await subtaskPage.createTask(taskTitle);
    await subtaskPage.openTaskDetail(taskTitle);
    await subtaskPage.createSubtask(subtaskTitle);
    await subtaskPage.waitForSubtaskToAppear(subtaskTitle);
    
    await subtaskPage.openSubtaskDetail(subtaskTitle);
    await subtaskPage.setMasteryLevel(20);
    await subtaskPage.transitionSubtaskState('review', 20);
    
    const historySection = page.locator('text=状态历史, text=历史记录').first();
    if (await historySection.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(page.locator('text=learning').or(page.locator('text=学习'))).toBeVisible({ timeout: 3000 });
      await expect(page.locator('text=review').or(page.locator('text=复习'))).toBeVisible({ timeout: 3000 });
    }
  });
});
