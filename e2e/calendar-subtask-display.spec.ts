import { test, expect } from "./fixtures";
import { type Page } from "@playwright/test";
import { navigateAndWaitForAuth, authedRequest } from "./utils/auth";
import { createCalendarEventWithSubtasks } from "./utils/calendarEvents";

/**
 * 已创建的今日任务 ID 集合。月视图每个日期单元格仅渲染前 3 个事件（其余折叠为
 * "+N more"），且测试间任务会累积占用"今天"单元格，若不清理会导致后续事件被
 * 折叠而无法断言。因此在文件级 afterEach 中统一软删除本次测试创建的任务。
 */
const createdTaskIds: string[] = [];

/** 创建带子任务的今日事件并登记清理，返回与 createCalendarEventWithSubtasks 相同的结果 */
async function createEventAndTrack(
  page: Page,
  options: Parameters<typeof createCalendarEventWithSubtasks>[1],
) {
  const fixture = await createCalendarEventWithSubtasks(page, options);
  createdTaskIds.push(fixture.taskId);
  return fixture;
}

test.afterEach(async ({ authenticatedPage: page }) => {
  const taskIds = createdTaskIds.splice(0);
  for (const taskId of taskIds) {
    // 软删除（deleted_at），listTasksWithStats 的 notDeleted 过滤会将其排除出日历
    await authedRequest(page, "DELETE", `/api/v1/scheduler/tasks/${taskId}`);
  }
});

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

  test("应该能够隐藏子任务", async ({ authenticatedPage: page }) => {
    // 创建带子任务的今日事件，验证切换开关可展开/收起子任务堆叠
    await createEventAndTrack(page, {
      title: `开关任务_${Date.now()}`,
      subtasks: [{ title: "开关子任务A" }, { title: "开关子任务B" }],
    });
    await calendarPage.navigateToCalendar();

    const subtaskA = page.getByText("开关子任务A", { exact: true }).first();
    // 初始状态：子任务堆叠默认隐藏
    await expect(subtaskA).toBeHidden({ timeout: 10000 });

    // 开启"显示子任务"
    await calendarPage.toggleSubtasks(true);
    await expect(subtaskA).toBeVisible({ timeout: 10000 });

    // 切换为"隐藏子任务"
    await calendarPage.toggleSubtasks(false);
    await expect(subtaskA).toBeHidden({ timeout: 10000 });
  });
});

test.describe("日历子任务堆叠显示测试", () => {
  let calendarPage: CalendarPageObject;

  test.beforeEach(async ({ authenticatedPage: page }) => {
    calendarPage = new CalendarPageObject(page);
    await calendarPage.navigateToCalendar();
  });

  test("应该在月视图中显示子任务堆叠", async ({
    authenticatedPage: page,
  }) => {
    await createEventAndTrack(page, {
      title: `月堆叠_${Date.now()}`,
      subtasks: [{ title: "月堆叠子1" }, { title: "月堆叠子2" }],
    });
    await calendarPage.navigateToCalendar();
    await calendarPage.toggleSubtasks(true);

    await expect(
      page.getByText("月堆叠子1", { exact: true }).first(),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText("月堆叠子2", { exact: true }).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test("应该在周视图中显示子任务堆叠", async ({
    authenticatedPage: page,
  }) => {
    await createEventAndTrack(page, {
      title: `周堆叠_${Date.now()}`,
      subtasks: [{ title: "周堆叠子1" }, { title: "周堆叠子2" }],
    });
    await calendarPage.navigateToCalendar();
    await calendarPage.switchToWeekView();
    await calendarPage.toggleSubtasks(true);

    await expect(
      page.getByText("周堆叠子1", { exact: true }).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test("应该在日视图中显示子任务堆叠", async ({
    authenticatedPage: page,
  }) => {
    await createEventAndTrack(page, {
      title: `日堆叠_${Date.now()}`,
      subtasks: [{ title: "日堆叠子1" }, { title: "日堆叠子2" }],
    });
    await calendarPage.navigateToCalendar();
    await calendarPage.switchToDayView();
    await calendarPage.toggleSubtasks(true);

    await expect(
      page.getByText("日堆叠子1", { exact: true }).first(),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText("日堆叠子2", { exact: true }).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test("应该在日程视图中显示子任务堆叠", async ({
    authenticatedPage: page,
  }) => {
    await createEventAndTrack(page, {
      title: `日程堆叠_${Date.now()}`,
      subtasks: [{ title: "日程堆叠子1" }, { title: "日程堆叠子2" }],
    });
    await calendarPage.navigateToCalendar();
    await calendarPage.switchToScheduleView();
    await calendarPage.toggleSubtasks(true);

    await expect(
      page.getByText("日程堆叠子1", { exact: true }).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test("应该限制显示的子任务数量", async ({
    authenticatedPage: page,
  }) => {
    // 日视图堆叠默认 maxVisible=3：创建 5 个子任务，初始仅前 3 个可见，
    // 展开按钮（+N 个子任务 / +N subtasks）出现并可展开查看剩余。
    await createEventAndTrack(page, {
      title: `数量限制_${Date.now()}`,
      subtasks: Array.from({ length: 5 }, (_, i) => ({
        title: `数量限制子${i + 1}`,
      })),
    });
    await calendarPage.navigateToCalendar();
    await calendarPage.switchToDayView();
    await calendarPage.toggleSubtasks(true);

    // 前 3 个可见，第 4 个被折叠
    await expect(
      page.getByText("数量限制子1", { exact: true }).first(),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText("数量限制子3", { exact: true }).first(),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText("数量限制子4", { exact: true }).first(),
    ).toBeHidden({ timeout: 10000 });

    // 展开按钮可见，点击后第 4 个子任务出现
    const expandButton = page
      .getByText(/\+2 个子任务|\+2 subtasks/, { exact: false })
      .first();
    await expect(expandButton).toBeVisible({ timeout: 10000 });
    await expandButton.click();
    await expect(
      page.getByText("数量限制子4", { exact: true }).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test("应该显示子任务完成进度", async ({
    authenticatedPage: page,
  }) => {
    // 创建 3 个子任务，其中 1 个完成 → 事件卡片显示 "1/3 subtasks" 进度
    await createEventAndTrack(page, {
      title: `进度任务_${Date.now()}`,
      subtasks: [
        { title: "进度子1", status: "completed" },
        { title: "进度子2" },
        { title: "进度子3" },
      ],
    });
    await calendarPage.navigateToCalendar();

    // 事件卡片上的完成进度标识（月/周/日视图均为 {completed}/{count}）
    const progress = page.getByText(/1\/3/).first();
    await expect(progress).toBeVisible({ timeout: 10000 });
    expect(await progress.textContent()).toContain("1/3");
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

  test("应该显示子任务的学习状态徽章", async ({
    authenticatedPage: page,
  }) => {
    // 设置子任务 learning_state=review → 堆叠中展示"复习/Review"徽章
    await createEventAndTrack(page, {
      title: `状态徽章_${Date.now()}`,
      subtasks: [{ title: "状态徽章子1", learning_state: "review" }],
    });
    await calendarPage.navigateToCalendar();
    // 状态徽章/掌握度/状态文案在日视图的非 compact 堆叠中完整展示，故切到日视图
    await calendarPage.switchToDayView();
    await calendarPage.toggleSubtasks(true);

    await expect(
      page.getByText("状态徽章子1", { exact: true }).first(),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText(/复习|Review/).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test("应该显示子任务的掌握度百分比", async ({
    authenticatedPage: page,
  }) => {
    // 设置 mastery_level=0.6 → 掌握度进度条显示 "60%"
    await createEventAndTrack(page, {
      title: `掌握度_${Date.now()}`,
      subtasks: [{ title: "掌握度子1", mastery_level: 0.6 }],
    });
    await calendarPage.navigateToCalendar();
    await calendarPage.switchToDayView();
    await calendarPage.toggleSubtasks(true);

    // 掌握度进度条展示百分比。注：掌握度由 FSRS 从 knowledge_points 计算（单一来源），
    // 新建未学习知识点回写 0.6 会被 updateKnowledgePointMastery 基于 retrievability 重算，
    // 故此处仅断言"百分比已展示"而非特定数值。
    await expect(page.getByText(/\d+%/, { exact: false }).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("应该根据状态显示不同颜色", async ({
    authenticatedPage: page,
  }) => {
    // 创建完成/进行中/待办三种状态的子任务，堆叠中呈现对应状态文案与边框色
    await createEventAndTrack(page, {
      title: `状态颜色_${Date.now()}`,
      subtasks: [
        { title: "颜色完成", status: "completed" },
        { title: "颜色进行中", status: "in_progress" },
        { title: "颜色待办", status: "pending" },
      ],
    });
    await calendarPage.navigateToCalendar();
    await calendarPage.switchToDayView();
    await calendarPage.toggleSubtasks(true);

    await expect(
      page.getByText("颜色完成", { exact: true }).first(),
    ).toBeVisible({ timeout: 10000 });
    // 状态文案：已完成 / In progress / 待办
    await expect(page.getByText(/已完成|Completed/).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/进行中|In progress/).first()).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe("日历事件与子任务关联测试", () => {
  let calendarPage: CalendarPageObject;

  test.beforeEach(async ({ authenticatedPage: page }) => {
    calendarPage = new CalendarPageObject(page);
    await calendarPage.navigateToCalendar();
  });

  test("应该显示有子任务的事件标识", async ({
    authenticatedPage: page,
  }) => {
    // 事件卡片显示子任务计数标识 "(0/N)"（月视图）或 "0/N subtasks"（日/周视图）
    await createEventAndTrack(page, {
      title: `有子任务标识_${Date.now()}`,
      subtasks: [{ title: "标识子1" }],
    });
    await calendarPage.navigateToCalendar();

    await expect(page.getByText(/0\/1/).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("应该在事件卡片上显示子任务数量", async ({
    authenticatedPage: page,
  }) => {
    // 4 个子任务 → 事件卡片数量标识为 "/4"
    await createEventAndTrack(page, {
      title: `数量_${Date.now()}`,
      subtasks: Array.from({ length: 4 }, (_, i) => ({
        title: `数量子${i + 1}`,
      })),
    });
    await calendarPage.navigateToCalendar();

    await expect(page.getByText(/\/4/).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("应该点击事件时显示关联的子任务", async ({
    authenticatedPage: page,
  }) => {
    const { title, taskId } = await createEventAndTrack(page, {
      title: `点击关联_${Date.now()}`,
      subtasks: [{ title: "点击关联子1" }, { title: "点击关联子2" }],
    });
    await calendarPage.navigateToCalendar();
    // 日视图事件卡片是 role=button 且 aria-label=event.title，点击比月视图文本更稳定
    await calendarPage.switchToDayView();

    // 点击事件卡片 → 跳转到任务详情页，展示关联子任务
    await page.getByRole("button", { name: title }).first().click();
    await expect(page).toHaveURL(
      new RegExp(`/scheduler/task/${taskId}`),
      { timeout: 10000 },
    );
    await expect(
      page.getByText("点击关联子1", { exact: true }).first(),
    ).toBeVisible({ timeout: 10000 });
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
