import { test, expect } from "./fixtures";
import { type Page } from "@playwright/test";
import { navigateAndWaitForAuth } from "./utils/auth";

class CalendarPageObject {
  constructor(private page: Page) {}

  async navigateToCalendar() {
    await navigateAndWaitForAuth(this.page, "/calendar");
  }

  async navigateToTasks() {
    await this.page.goto("/tasks");
    await this.page.waitForLoadState("load");
  }

  async getMonthViewButton() {
    return this.page
      .locator("button", { hasText: /^月$|^Month$/ })
      .first();
  }

  async getWeekViewButton() {
    return this.page
      .locator("button", { hasText: /^周$|^Week$/ })
      .first();
  }

  async getDayViewButton() {
    return this.page
      .locator("button", { hasText: /^日$|^Day$/ })
      .first();
  }

  async getScheduleViewButton() {
    return this.page
      .locator("button", { hasText: /^日程$|^Schedule$/ })
      .first();
  }

  async switchToMonthView() {
    const monthButton = await this.getMonthViewButton();
    await monthButton.click();
    await this.page.waitForTimeout(300);
  }

  async switchToWeekView() {
    const weekButton = await this.getWeekViewButton();
    await weekButton.click();
    await this.page.waitForTimeout(300);
  }

  async switchToDayView() {
    const dayButton = await this.getDayViewButton();
    await dayButton.click();
    await this.page.waitForTimeout(300);
  }

  async switchToScheduleView() {
    const scheduleButton = await this.getScheduleViewButton();
    await scheduleButton.click();
    await this.page.waitForTimeout(300);
  }

  async getShowSubtasksToggle() {
    return this.page
      .locator(
        'button:has-text("显示子任务"), button:has-text("Show Subtasks"), button:has-text("隐藏子任务"), button:has-text("Hide Subtasks")',
      )
      .first();
  }

  async toggleSubtasks(show: boolean) {
    const toggleButton = await this.getShowSubtasksToggle();
    const buttonText = (await toggleButton.textContent()) ?? "";

    if (show && (buttonText.includes("显示") || buttonText.includes("Show"))) {
      await toggleButton.click();
      await this.page.waitForTimeout(300);
    } else if (
      !show &&
      (buttonText.includes("隐藏") || buttonText.includes("Hide"))
    ) {
      await toggleButton.click();
      await this.page.waitForTimeout(300);
    }
  }

  async isSubtaskToggleActive(): Promise<boolean> {
    const toggleButton = await this.getShowSubtasksToggle();
    const className = (await toggleButton.getAttribute("class")) ?? "";
    return className.includes("bg-primary-600");
  }

  async getSubtaskStack() {
    return this.page.locator(
      '[data-testid="calendar-subtask-stack"], .calendar-subtask-stack',
    );
  }

  async getSubtaskItems() {
    return this.page.locator('[data-testid="subtask-item"], .subtask-item');
  }

  async getSubtaskCount(): Promise<number> {
    const subtasks = await this.getSubtaskItems();
    return subtasks.count();
  }

  async clickSubtask(subtaskTitle: string) {
    const subtaskItem = this.page.locator(`text="${subtaskTitle}"`).first();
    await subtaskItem.click();
    await this.page.waitForTimeout(300);
  }

  async getEventCard(eventTitle: string) {
    return this.page.locator(`text="${eventTitle}"`).first();
  }

  async clickEvent(eventTitle: string) {
    const eventCard = await this.getEventCard(eventTitle);
    await eventCard.click();
    await this.page.waitForTimeout(300);
  }

  async getSubtaskDetailModal() {
    return this.page.locator(
      '[data-testid="subtask-detail-modal"], .subtask-detail-modal',
    );
  }

  async closeModal() {
    const closeButton = this.page
      .locator('button[aria-label="关闭"], button:has-text("关闭")')
      .first();
    await expect(closeButton).toBeVisible({ timeout: 5000 });
    await closeButton.click();
    await this.page.waitForTimeout(300);
  }

  async navigateToDate(date: Date) {
    const today = new Date();
    const diffMonths =
      (date.getFullYear() - today.getFullYear()) * 12 +
      (date.getMonth() - today.getMonth());

    const prevButton = this.page
      .locator('button[aria-label="上一月"], button:has-text("‹")')
      .first();
    const nextButton = this.page
      .locator('button[aria-label="下一月"], button:has-text("›")')
      .first();

    for (let i = 0; i < Math.abs(diffMonths); i++) {
      if (diffMonths < 0) {
        await prevButton.click();
      } else {
        await nextButton.click();
      }
      await this.page.waitForTimeout(100);
    }
  }

  async getTodayButton() {
    return this.page
      .locator('button:has-text("今天"), button:has-text("Today")')
      .first();
  }

  async clickTodayButton() {
    const todayButton = await this.getTodayButton();
    await todayButton.click();
    await this.page.waitForTimeout(300);
  }

  async createTask(title: string, description?: string) {
    const createButton = this.page
      .locator('button:has-text("添加任务"), button:has-text("新建")')
      .first();
    await createButton.click();

    const titleInput = this.page
      .locator('input[name="title"], input[placeholder*="标题"]')
      .first();
    await titleInput.fill(title);

    if (description) {
      const descInput = this.page
        .locator('textarea[name="description"], textarea[placeholder*="描述"]')
        .first();
      await expect(descInput).toBeVisible({ timeout: 5000 });
      await descInput.fill(description);
    }

    const submitButton = this.page
      .locator(
        'button[type="submit"]:has-text("创建"), button:has-text("确定")',
      )
      .first();
    await submitButton.click();

    await this.page.waitForTimeout(500);
  }

  async getSubtaskProgress(): Promise<{
    completed: number;
    total: number;
  } | null> {
    const progressText = this.page.locator("text=/\\d+\\/\\d+/").first();
    const text = await progressText.textContent();
    if (text) {
      const match = text.match(/(\d+)\/(\d+)/);
      if (match) {
        return {
          completed: parseInt(match[1] ?? "", 10),
          total: parseInt(match[2] ?? "", 10),
        };
      }
    }
    return null;
  }

  async getSubtaskMasteryBadge(): Promise<string | null> {
    const masteryBadge = this.page
      .locator('[data-testid="mastery-badge"], .mastery-badge')
      .first();
    return masteryBadge.textContent();
  }

  async getLearningStateBadge(): Promise<string | null> {
    const stateBadge = this.page
      .locator('[data-testid="learning-state-badge"], .learning-state-badge')
      .first();
    return stateBadge.textContent();
  }

  async expandSubtaskStack() {
    const expandButton = this.page
      .locator('button:has-text("更多"), button:has-text("+")')
      .first();
    await expect(expandButton).toBeVisible({ timeout: 5000 });
    await expandButton.click();
    await this.page.waitForTimeout(300);
  }
}

test.describe("日历页面基本功能测试", () => {
  let calendarPage: CalendarPageObject;

  test.beforeEach(async ({ authenticatedPage: page }) => {
    calendarPage = new CalendarPageObject(page);
    await calendarPage.navigateToCalendar();
  });

  test("应该显示日历页面标题", async ({ authenticatedPage: page }) => {
    const title = page
      .locator("h1", { hasText: /日历|Calendar/ })
      .first();
    await expect(title).toBeVisible({ timeout: 10000 });
  });

  test("应该显示视图切换按钮", async () => {
    const monthButton = await calendarPage.getMonthViewButton();
    const weekButton = await calendarPage.getWeekViewButton();
    const dayButton = await calendarPage.getDayViewButton();

    await expect(monthButton).toBeVisible({ timeout: 5000 });
    await expect(weekButton).toBeVisible({ timeout: 5000 });
    await expect(dayButton).toBeVisible({ timeout: 5000 });
  });

  test("应该能够切换视图", async () => {
    await calendarPage.switchToWeekView();
    const weekButton = await calendarPage.getWeekViewButton();
    await expect(weekButton).toHaveClass(/bg-primary-600/);

    await calendarPage.switchToDayView();
    const dayButton = await calendarPage.getDayViewButton();
    await expect(dayButton).toHaveClass(/bg-primary-600/);

    await calendarPage.switchToMonthView();
    const monthButton = await calendarPage.getMonthViewButton();
    await expect(monthButton).toHaveClass(/bg-primary-600/);
  });

  test("应该显示今天按钮", async () => {
    const todayButton = await calendarPage.getTodayButton();
    await expect(todayButton).toBeVisible({ timeout: 5000 });
  });
});

test.describe("子任务显示开关测试", () => {
  let calendarPage: CalendarPageObject;

  test.beforeEach(async ({ authenticatedPage: page }) => {
    calendarPage = new CalendarPageObject(page);
    await calendarPage.navigateToCalendar();
  });

  test("应该显示子任务切换按钮", async () => {
    const toggleButton = await calendarPage.getShowSubtasksToggle();
    await expect(toggleButton).toBeVisible({ timeout: 10000 });
  });

  test("应该能够切换子任务显示", async () => {
    const toggleButton = await calendarPage.getShowSubtasksToggle();
    await expect(toggleButton).toBeVisible({ timeout: 5000 });

    await expect(toggleButton).toContainText(/显示子任务|Show Subtasks/);

    await calendarPage.toggleSubtasks(true);

    const updatedButton = await calendarPage.getShowSubtasksToggle();
    await expect(updatedButton).toContainText(/隐藏子任务|Hide Subtasks/);
    expect(await calendarPage.isSubtaskToggleActive()).toBe(true);
  });

  test.skip("应该能够隐藏子任务", async () => {
    // TODO: 通过 API 创建带子任务事件后取消 skip
  });
});

test.describe("日历子任务堆叠显示测试", () => {
  let calendarPage: CalendarPageObject;

  test.beforeEach(async ({ authenticatedPage: page }) => {
    calendarPage = new CalendarPageObject(page);
    await calendarPage.navigateToCalendar();
  });

  test.skip("应该在月视图中显示子任务堆叠", async () => {
    // TODO: 通过 API 创建带子任务事件后取消 skip
  });

  test.skip("应该在周视图中显示子任务堆叠", async () => {
    // TODO: 通过 API 创建带子任务事件后取消 skip
  });

  test.skip("应该在日视图中显示子任务堆叠", async () => {
    // TODO: 通过 API 创建带子任务事件后取消 skip
  });

  test.skip("应该在日程视图中显示子任务堆叠", async () => {
    // TODO: 通过 API 创建带子任务事件后取消 skip
  });

  test.skip("应该限制显示的子任务数量", async () => {
    // TODO: 通过 API 创建带子任务事件后取消 skip
  });

  test.skip("应该显示子任务完成进度", async () => {
    // TODO: 通过 API 创建带子任务事件后取消 skip
  });
});

test.describe("子任务详情查看测试", () => {
  let calendarPage: CalendarPageObject;

  test.beforeEach(async ({ authenticatedPage: page }) => {
    calendarPage = new CalendarPageObject(page);
    await calendarPage.navigateToCalendar();
  });
});

test.describe("子任务状态显示测试", () => {
  let calendarPage: CalendarPageObject;

  test.beforeEach(async ({ authenticatedPage: page }) => {
    calendarPage = new CalendarPageObject(page);
    await calendarPage.navigateToCalendar();
  });

  test.skip("应该显示子任务的学习状态徽章", async () => {
    // TODO: 通过 API 创建带子任务事件后取消 skip
  });

  test.skip("应该显示子任务的掌握度百分比", async () => {
    // TODO: 通过 API 创建带子任务事件后取消 skip
  });

  test.skip("应该根据状态显示不同颜色", async () => {
    // TODO: 通过 API 创建带子任务事件后取消 skip
  });
});

test.describe("日历事件与子任务关联测试", () => {
  let calendarPage: CalendarPageObject;

  test.beforeEach(async ({ authenticatedPage: page }) => {
    calendarPage = new CalendarPageObject(page);
    await calendarPage.navigateToCalendar();
  });

  test.skip("应该显示有子任务的事件标识", async () => {
    // TODO: 通过 API 创建带子任务事件后取消 skip
  });

  test.skip("应该在事件卡片上显示子任务数量", async () => {
    // TODO: 通过 API 创建带子任务事件后取消 skip
  });

  test.skip("应该点击事件时显示关联的子任务", async () => {
    // TODO: 通过 API 创建带子任务事件后取消 skip
  });
});

test.describe("移动端日历子任务显示测试", () => {
  let calendarPage: CalendarPageObject;

  test.beforeEach(async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    calendarPage = new CalendarPageObject(page);
    await calendarPage.navigateToCalendar();
  });

  test("应该在移动端显示子任务切换按钮", async () => {
    const toggleButton = await calendarPage.getShowSubtasksToggle();
    await expect(toggleButton).toBeVisible({ timeout: 10000 });
  });
});
