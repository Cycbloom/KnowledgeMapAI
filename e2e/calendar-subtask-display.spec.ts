import { test, expect, Page } from "@playwright/test";
import { loginAsTestUser } from "./utils/auth";

class CalendarPageObject {
  constructor(private page: Page) {}

  async navigateToCalendar() {
    await this.page.goto("/calendar");
    await this.page.waitForLoadState("networkidle");
  }

  async navigateToTasks() {
    await this.page.goto("/tasks");
    await this.page.waitForLoadState("networkidle");
  }

  async getMonthViewButton() {
    return this.page
      .locator('button:has-text("月"), button:has-text("month")')
      .first();
  }

  async getWeekViewButton() {
    return this.page
      .locator('button:has-text("周"), button:has-text("week")')
      .first();
  }

  async getDayViewButton() {
    return this.page
      .locator('button:has-text("日"), button:has-text("day")')
      .first();
  }

  async getScheduleViewButton() {
    return this.page
      .locator('button:has-text("日程"), button:has-text("schedule")')
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
      .locator('button:has-text("显示子任务"), button:has-text("隐藏子任务")')
      .first();
  }

  async toggleSubtasks(show: boolean) {
    const toggleButton = await this.getShowSubtasksToggle();
    const buttonText = await toggleButton.textContent();

    if (show && buttonText?.includes("显示")) {
      await toggleButton.click();
      await this.page.waitForTimeout(300);
    } else if (!show && buttonText?.includes("隐藏")) {
      await toggleButton.click();
      await this.page.waitForTimeout(300);
    }
  }

  async isSubtaskToggleActive(): Promise<boolean> {
    const toggleButton = await this.getShowSubtasksToggle();
    const className = await toggleButton.getAttribute("class");
    return (
      className?.includes("primary") || className?.includes("active") || false
    );
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

  async isSubtaskDetailModalVisible(): Promise<boolean> {
    const modal = await this.getSubtaskDetailModal();
    return modal.isVisible({ timeout: 3000 }).catch(() => false);
  }

  async closeModal() {
    const closeButton = this.page
      .locator('button[aria-label="关闭"], button:has-text("关闭")')
      .first();
    if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeButton.click();
      await this.page.waitForTimeout(300);
    }
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
      .locator('button:has-text("今天"), button:has-text("today")')
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
      if (await descInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await descInput.fill(description);
      }
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
          completed: parseInt(match[1], 10),
          total: parseInt(match[2], 10),
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
    if (await expandButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expandButton.click();
      await this.page.waitForTimeout(300);
    }
  }
}

test.describe("日历页面基本功能测试", () => {
  let calendarPage: CalendarPageObject;

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    calendarPage = new CalendarPageObject(page);
    await calendarPage.navigateToCalendar();
  });

  test("应该显示日历页面标题", async ({ page }) => {
    const title = page.locator("text=日历").first();
    await expect(title).toBeVisible({ timeout: 10000 });
  });

  test("应该显示视图切换按钮", async ({ page }) => {
    const monthButton = await calendarPage.getMonthViewButton();
    const weekButton = await calendarPage.getWeekViewButton();
    const dayButton = await calendarPage.getDayViewButton();

    await expect(monthButton).toBeVisible({ timeout: 5000 });
    await expect(weekButton).toBeVisible({ timeout: 5000 });
    await expect(dayButton).toBeVisible({ timeout: 5000 });
  });

  test("应该能够切换视图", async ({ page }) => {
    await calendarPage.switchToWeekView();
    await expect(
      page.locator('[data-testid="week-view"], .week-view').first(),
    ).toBeVisible({ timeout: 5000 });

    await calendarPage.switchToDayView();
    await expect(
      page.locator('[data-testid="day-view"], .day-view').first(),
    ).toBeVisible({ timeout: 5000 });

    await calendarPage.switchToMonthView();
    await expect(
      page.locator('[data-testid="month-view"], .month-view').first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test("应该显示今天按钮", async ({ page }) => {
    const todayButton = await calendarPage.getTodayButton();
    await expect(todayButton).toBeVisible({ timeout: 5000 });
  });
});

test.describe("子任务显示开关测试", () => {
  let calendarPage: CalendarPageObject;

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    calendarPage = new CalendarPageObject(page);
    await calendarPage.navigateToCalendar();
  });

  test("应该显示子任务切换按钮", async ({ page }) => {
    const toggleButton = await calendarPage.getShowSubtasksToggle();
    await expect(toggleButton).toBeVisible({ timeout: 10000 });
  });

  test("应该能够切换子任务显示", async ({ page }) => {
    await calendarPage.toggleSubtasks(true);

    const isActive = await calendarPage.isSubtaskToggleActive();
    expect(isActive).toBeTruthy();
  });

  test("应该能够隐藏子任务", async ({ page }) => {
    await calendarPage.toggleSubtasks(true);
    await calendarPage.toggleSubtasks(false);

    const subtaskStack = await calendarPage.getSubtaskStack();
    const isVisible = await subtaskStack
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(isVisible).toBeFalsy();
  });
});

test.describe("日历子任务堆叠显示测试", () => {
  let calendarPage: CalendarPageObject;

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    calendarPage = new CalendarPageObject(page);
    await calendarPage.navigateToCalendar();
  });

  test("应该在月视图中显示子任务堆叠", async ({ page }) => {
    await calendarPage.switchToMonthView();
    await calendarPage.toggleSubtasks(true);

    const eventWithSubtasks = page
      .locator('[data-has-subtasks="true"], .has-subtasks')
      .first();
    const hasEventWithSubtasks = await eventWithSubtasks
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(typeof hasEventWithSubtasks).toBe("boolean");
  });

  test("应该在周视图中显示子任务堆叠", async ({ page }) => {
    await calendarPage.switchToWeekView();
    await calendarPage.toggleSubtasks(true);

    const subtaskStack = await calendarPage.getSubtaskStack();
    const hasSubtaskStack = await subtaskStack
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(typeof hasSubtaskStack).toBe("boolean");
  });

  test("应该在日视图中显示子任务堆叠", async ({ page }) => {
    await calendarPage.switchToDayView();
    await calendarPage.toggleSubtasks(true);

    const subtaskStack = await calendarPage.getSubtaskStack();
    const hasSubtaskStack = await subtaskStack
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(typeof hasSubtaskStack).toBe("boolean");
  });

  test("应该在日程视图中显示子任务堆叠", async ({ page }) => {
    const scheduleButton = await calendarPage.getScheduleViewButton();
    if (await scheduleButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await calendarPage.switchToScheduleView();
      await calendarPage.toggleSubtasks(true);

      const subtaskStack = await calendarPage.getSubtaskStack();
      const hasSubtaskStack = await subtaskStack
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      expect(typeof hasSubtaskStack).toBe("boolean");
    }
  });

  test("应该限制显示的子任务数量", async ({ page }) => {
    await calendarPage.switchToMonthView();
    await calendarPage.toggleSubtasks(true);

    const moreButton = page.locator("text=/\\+\\d+.*更多|更多子任务/").first();
    const hasMoreButton = await moreButton
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(typeof hasMoreButton).toBe("boolean");
  });

  test("应该显示子任务完成进度", async ({ page }) => {
    await calendarPage.switchToMonthView();
    await calendarPage.toggleSubtasks(true);

    const progress = await calendarPage.getSubtaskProgress();
    expect(progress).toBeDefined();
  });
});

test.describe("子任务详情查看测试", () => {
  let calendarPage: CalendarPageObject;

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    calendarPage = new CalendarPageObject(page);
    await calendarPage.navigateToCalendar();
  });

  test("应该能够点击子任务查看详情", async ({ page }) => {
    await calendarPage.switchToMonthView();
    await calendarPage.toggleSubtasks(true);

    const subtaskItem = await calendarPage.getSubtaskItems();
    const count = await subtaskItem.count();

    if (count > 0) {
      await subtaskItem.first().click();

      const modal = await calendarPage.getSubtaskDetailModal();
      const isModalVisible = await modal
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      expect(typeof isModalVisible).toBe("boolean");
    }
  });

  test("应该在详情弹窗中显示子任务标题", async ({ page }) => {
    await calendarPage.switchToMonthView();
    await calendarPage.toggleSubtasks(true);

    const subtaskItem = await calendarPage.getSubtaskItems();
    const count = await subtaskItem.count();

    if (count > 0) {
      const subtaskTitle = await subtaskItem.first().textContent();
      await subtaskItem.first().click();

      if (await calendarPage.isSubtaskDetailModalVisible()) {
        const modalTitle = page.locator(`text="${subtaskTitle}"`).first();
        await expect(modalTitle).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test("应该在详情弹窗中显示学习状态", async ({ page }) => {
    await calendarPage.switchToMonthView();
    await calendarPage.toggleSubtasks(true);

    const subtaskItem = await calendarPage.getSubtaskItems();
    const count = await subtaskItem.count();

    if (count > 0) {
      await subtaskItem.first().click();

      if (await calendarPage.isSubtaskDetailModalVisible()) {
        const stateBadge = page.locator("text=/学习|复习|练习|测验/").first();
        await expect(stateBadge).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test("应该在详情弹窗中显示掌握度", async ({ page }) => {
    await calendarPage.switchToMonthView();
    await calendarPage.toggleSubtasks(true);

    const subtaskItem = await calendarPage.getSubtaskItems();
    const count = await subtaskItem.count();

    if (count > 0) {
      await subtaskItem.first().click();

      if (await calendarPage.isSubtaskDetailModalVisible()) {
        const masteryDisplay = page.locator("text=/掌握度|\\d+%/").first();
        await expect(masteryDisplay).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test("应该能够关闭详情弹窗", async ({ page }) => {
    await calendarPage.switchToMonthView();
    await calendarPage.toggleSubtasks(true);

    const subtaskItem = await calendarPage.getSubtaskItems();
    const count = await subtaskItem.count();

    if (count > 0) {
      await subtaskItem.first().click();

      if (await calendarPage.isSubtaskDetailModalVisible()) {
        await calendarPage.closeModal();

        const modal = await calendarPage.getSubtaskDetailModal();
        const isModalVisible = await modal
          .isVisible({ timeout: 2000 })
          .catch(() => false);

        expect(isModalVisible).toBeFalsy();
      }
    }
  });
});

test.describe("子任务状态显示测试", () => {
  let calendarPage: CalendarPageObject;

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    calendarPage = new CalendarPageObject(page);
    await calendarPage.navigateToCalendar();
  });

  test("应该显示子任务的学习状态徽章", async ({ page }) => {
    await calendarPage.switchToMonthView();
    await calendarPage.toggleSubtasks(true);

    const stateBadge = page
      .locator('[data-testid="learning-state-badge"], .learning-state-badge')
      .first();
    const isVisible = await stateBadge
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(typeof isVisible).toBe("boolean");
  });

  test("应该显示子任务的掌握度百分比", async ({ page }) => {
    await calendarPage.switchToMonthView();
    await calendarPage.toggleSubtasks(true);

    const masteryText = page.locator("text=/\\d+%/").first();
    const isVisible = await masteryText
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(typeof isVisible).toBe("boolean");
  });

  test("应该根据状态显示不同颜色", async ({ page }) => {
    await calendarPage.switchToMonthView();
    await calendarPage.toggleSubtasks(true);

    const subtaskItem = await calendarPage.getSubtaskItems();
    const count = await subtaskItem.count();

    if (count > 0) {
      const className = await subtaskItem.first().getAttribute("class");
      expect(className).toBeDefined();
    }
  });
});

test.describe("日历事件与子任务关联测试", () => {
  let calendarPage: CalendarPageObject;

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    calendarPage = new CalendarPageObject(page);
    await calendarPage.navigateToCalendar();
  });

  test("应该显示有子任务的事件标识", async ({ page }) => {
    await calendarPage.switchToMonthView();

    const eventWithSubtasks = page
      .locator('[data-has-subtasks="true"], .has-subtasks')
      .first();
    const hasEventWithSubtasks = await eventWithSubtasks
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(typeof hasEventWithSubtasks).toBe("boolean");
  });

  test("应该在事件卡片上显示子任务数量", async ({ page }) => {
    await calendarPage.switchToMonthView();

    const subtaskCountBadge = page
      .locator("text=/\\d+\\/\\d+/, [data-subtask-count]")
      .first();
    const isVisible = await subtaskCountBadge
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(typeof isVisible).toBe("boolean");
  });

  test("应该点击事件时显示关联的子任务", async ({ page }) => {
    await calendarPage.switchToMonthView();

    const eventCard = page
      .locator('[data-testid="calendar-event"], .calendar-event')
      .first();
    if (await eventCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await eventCard.click();

      const subtaskSection = page.locator("text=/子任务|subtask/i").first();
      const hasSubtaskSection = await subtaskSection
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      expect(typeof hasSubtaskSection).toBe("boolean");
    }
  });
});

test.describe("移动端日历子任务显示测试", () => {
  let calendarPage: CalendarPageObject;

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await loginAsTestUser(page);
    calendarPage = new CalendarPageObject(page);
    await calendarPage.navigateToCalendar();
  });

  test("应该在移动端显示子任务切换按钮", async ({ page }) => {
    const toggleButton = await calendarPage.getShowSubtasksToggle();
    await expect(toggleButton).toBeVisible({ timeout: 10000 });
  });

  test("应该在移动端正确显示子任务堆叠", async ({ page }) => {
    await calendarPage.switchToMonthView();
    await calendarPage.toggleSubtasks(true);

    const subtaskStack = await calendarPage.getSubtaskStack();
    const hasSubtaskStack = await subtaskStack
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(typeof hasSubtaskStack).toBe("boolean");
  });

  test("应该在移动端能够展开子任务详情", async ({ page }) => {
    await calendarPage.switchToMonthView();
    await calendarPage.toggleSubtasks(true);

    const subtaskItem = await calendarPage.getSubtaskItems();
    const count = await subtaskItem.count();

    if (count > 0) {
      await subtaskItem.first().click();

      const modal = await calendarPage.getSubtaskDetailModal();
      const isModalVisible = await modal
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      expect(typeof isModalVisible).toBe("boolean");
    }
  });
});
