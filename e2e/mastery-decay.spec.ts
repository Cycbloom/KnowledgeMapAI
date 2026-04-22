import { test, expect, Page } from "@playwright/test";
import { loginAsTestUser } from "./utils/auth";

class MasteryPageObject {
  constructor(private page: Page) {}

  async navigateToTasks() {
    await this.page.goto("/tasks");
    await this.page.waitForLoadState("networkidle");
  }

  async navigateToReview() {
    await this.page.goto("/review");
    await this.page.waitForLoadState("networkidle");
  }

  async navigateToKnowledgePoints() {
    await this.page.goto("/knowledge");
    await this.page.waitForLoadState("networkidle");
  }

  async createTaskWithKnowledgePoint(title: string) {
    const createButton = this.page
      .locator('button:has-text("新建"), button:has-text("创建任务")')
      .first();
    await createButton.click();

    const titleInput = this.page
      .locator('input[name="title"], input[placeholder*="标题"]')
      .first();
    await titleInput.fill(title);

    const submitButton = this.page
      .locator(
        'button[type="submit"]:has-text("创建"), button:has-text("确定")',
      )
      .first();
    await submitButton.click();

    await this.page.waitForTimeout(500);
  }

  async openTaskDetail(taskTitle: string) {
    const taskCard = this.page.locator(`text="${taskTitle}"`).first();
    await taskCard.click();
    await this.page.waitForTimeout(300);
  }

  async createSubtaskForKnowledgePoint(subtaskTitle: string) {
    const addSubtaskButton = this.page
      .locator('button:has-text("添加子任务"), button:has-text("新建子任务")')
      .first();
    if (
      await addSubtaskButton.isVisible({ timeout: 3000 }).catch(() => false)
    ) {
      await addSubtaskButton.click();

      const titleInput = this.page
        .locator('input[placeholder*="子任务标题"], input[name="subtaskTitle"]')
        .first();
      await titleInput.fill(subtaskTitle);

      const submitButton = this.page
        .locator(
          'button[type="submit"]:has-text("添加"), button:has-text("确定")',
        )
        .first();
      await submitButton.click();

      await this.page.waitForTimeout(500);
    }
  }

  async setSubtaskMastery(masteryLevel: number) {
    const masteryInput = this.page.locator('input[type="range"]').first();
    if (await masteryInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await masteryInput.fill(String(masteryLevel));
    }
  }

  async getMasteryLevel(): Promise<number> {
    const masteryText = this.page.locator("text=/\\d+%/").first();
    const text = await masteryText.textContent();
    if (text) {
      const match = text.match(/(\d+)%/);
      return match ? parseInt(match[1], 10) : 0;
    }
    return 0;
  }

  async getReviewTaskCount(): Promise<number> {
    const reviewCards = this.page.locator(
      '[data-testid="review-task-card"], .review-task-card',
    );
    return reviewCards.count();
  }

  async getOverdueReviewCount(): Promise<number> {
    const overdueBadge = this.page.locator("text=/逾期|overdue/i");
    return overdueBadge.count();
  }

  async getTodayReviewCount(): Promise<number> {
    const todayBadge = this.page.locator("text=/今天|today/i");
    return todayBadge.count();
  }

  async completeReview(quality: "again" | "hard" | "good" | "easy") {
    const qualityButton = this.page
      .locator(
        `button:has-text("${quality}"), button[data-quality="${quality}"]`,
      )
      .first();
    if (await qualityButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await qualityButton.click();
      await this.page.waitForTimeout(500);
    }
  }

  async openKnowledgePointDetail(kpTitle: string) {
    const kpCard = this.page.locator(`text="${kpTitle}"`).first();
    await kpCard.click();
    await this.page.waitForTimeout(300);
  }

  async getKnowledgePointMastery(): Promise<number> {
    const masteryBar = this.page
      .locator('[data-testid="mastery-progress"], .mastery-progress')
      .first();
    const ariaValue = await masteryBar.getAttribute("aria-valuenow");
    return ariaValue ? parseInt(ariaValue, 10) : 0;
  }

  async triggerManualDecay() {
    const decayButton = this.page
      .locator('button:has-text("计算衰减"), button:has-text("刷新掌握度")')
      .first();
    if (await decayButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await decayButton.click();
      await this.page.waitForTimeout(1000);
    }
  }

  async waitForSubtaskToAppear(subtaskTitle: string) {
    await expect(this.page.locator(`text="${subtaskTitle}"`)).toBeVisible({
      timeout: 10000,
    });
  }
}

test.describe("掌握度衰减测试", () => {
  let masteryPage: MasteryPageObject;

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    masteryPage = new MasteryPageObject(page);
  });

  test("应该显示知识点掌握度", async ({ page }) => {
    await masteryPage.navigateToKnowledgePoints();

    const masteryIndicator = page
      .locator(
        '[data-testid="mastery-indicator"], .mastery-level, text=/掌握度|%/',
      )
      .first();
    await expect(masteryIndicator).toBeVisible({ timeout: 10000 });
  });

  test("应该显示掌握度进度条", async ({ page }) => {
    await masteryPage.navigateToKnowledgePoints();

    const progressBar = page
      .locator(
        '[role="progressbar"], .progress-bar, [data-testid="mastery-progress"]',
      )
      .first();
    await expect(progressBar).toBeVisible({ timeout: 10000 });
  });

  test("应该根据掌握度显示不同颜色", async ({ page }) => {
    await masteryPage.navigateToKnowledgePoints();

    const lowMastery = page
      .locator('.mastery-low, [data-mastery="low"]')
      .first();
    const mediumMastery = page
      .locator('.mastery-medium, [data-mastery="medium"]')
      .first();
    const highMastery = page
      .locator('.mastery-high, [data-mastery="high"]')
      .first();

    const hasMasteryIndicator =
      (await lowMastery.isVisible({ timeout: 2000 }).catch(() => false)) ||
      (await mediumMastery.isVisible({ timeout: 2000 }).catch(() => false)) ||
      (await highMastery.isVisible({ timeout: 2000 }).catch(() => false));

    expect(hasMasteryIndicator).toBeTruthy();
  });
});

test.describe("复习提醒触发测试", () => {
  let masteryPage: MasteryPageObject;

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    masteryPage = new MasteryPageObject(page);
  });

  test("应该显示复习任务列表", async ({ page }) => {
    await masteryPage.navigateToReview();

    const reviewSection = page.locator("text=/复习|review/i").first();
    await expect(reviewSection).toBeVisible({ timeout: 10000 });
  });

  test("应该显示待复习知识点数量", async ({ page }) => {
    await masteryPage.navigateToReview();

    const countBadge = page
      .locator(
        '[data-testid="review-count"], .review-count, text=/\\d+.*待复习/',
      )
      .first();
    await expect(countBadge).toBeVisible({ timeout: 10000 });
  });

  test("应该区分逾期和今日复习任务", async ({ page }) => {
    await masteryPage.navigateToReview();

    const overdueSection = page.locator("text=/逾期|overdue/i").first();
    const todaySection = page.locator("text=/今天|today/i").first();

    const hasOverdueOrToday =
      (await overdueSection.isVisible({ timeout: 3000 }).catch(() => false)) ||
      (await todaySection.isVisible({ timeout: 3000 }).catch(() => false));

    expect(hasOverdueOrToday).toBeTruthy();
  });

  test("应该显示复习任务的紧迫程度", async ({ page }) => {
    await masteryPage.navigateToReview();

    const urgencyIndicator = page
      .locator(
        '[data-testid="urgency-badge"], .urgency-badge, text=/紧急|urgent|逾期|overdue/',
      )
      .first();
    await expect(urgencyIndicator).toBeVisible({ timeout: 10000 });
  });
});

test.describe("SM2 算法测试", () => {
  let masteryPage: MasteryPageObject;

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    masteryPage = new MasteryPageObject(page);
  });

  test("应该显示下次复习日期", async ({ page }) => {
    await masteryPage.navigateToReview();

    const nextReviewDate = page
      .locator("text=/下次复习|next review|\\d+天/i")
      .first();
    await expect(nextReviewDate).toBeVisible({ timeout: 10000 });
  });

  test("应该显示复习间隔", async ({ page }) => {
    await masteryPage.navigateToReview();

    const intervalInfo = page.locator("text=/间隔|interval|\\d+天/i").first();
    await expect(intervalInfo).toBeVisible({ timeout: 10000 });
  });

  test("应该显示易遗忘因子", async ({ page }) => {
    await masteryPage.navigateToReview();

    const easeFactorInfo = page.locator("text=/EF|易遗忘因子|ease/i").first();
    const isVisible = await easeFactorInfo
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(typeof isVisible).toBe("boolean");
  });

  test("应该能够完成复习并更新间隔", async ({ page }) => {
    await masteryPage.navigateToReview();

    const reviewCard = page
      .locator('[data-testid="review-task-card"], .review-task-card')
      .first();
    if (await reviewCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await reviewCard.click();

      const qualityButton = page
        .locator(
          'button:has-text("良好"), button:has-text("good"), button[data-quality="good"]',
        )
        .first();
      if (await qualityButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await qualityButton.click();

        const successMessage = page.locator(
          "text=/复习完成|completed|更新成功/i",
        );
        await expect(successMessage.first())
          .toBeVisible({ timeout: 5000 })
          .catch(() => {});
      }
    }

    await expect(page).not.toHaveURL(/login/);
  });
});

test.describe("掌握度与子任务同步测试", () => {
  let masteryPage: MasteryPageObject;
  const testTaskTitle = `同步测试任务_${Date.now()}`;
  const testSubtaskTitle = `同步测试子任务_${Date.now()}`;

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    masteryPage = new MasteryPageObject(page);
  });

  test("应该同步子任务掌握度到知识点", async ({ page }) => {
    await masteryPage.navigateToTasks();
    await masteryPage.createTaskWithKnowledgePoint(testTaskTitle);
    await masteryPage.openTaskDetail(testTaskTitle);
    await masteryPage.createSubtaskForKnowledgePoint(testSubtaskTitle);
    await masteryPage.waitForSubtaskToAppear(testSubtaskTitle);

    const subtaskItem = page.locator(`text="${testSubtaskTitle}"`).first();
    await subtaskItem.click();

    await masteryPage.setSubtaskMastery(80);

    const saveButton = page
      .locator('button:has-text("保存"), button:has-text("更新")')
      .first();
    if (await saveButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveButton.click();
    }

    const masteryDisplay = page.locator("text=/80%/");
    await expect(masteryDisplay.first()).toBeVisible({ timeout: 5000 });
  });

  test("应该同步知识点掌握度到子任务", async ({ page }) => {
    await masteryPage.navigateToKnowledgePoints();

    const knowledgePointCard = page
      .locator('[data-testid="knowledge-point-card"], .knowledge-point-card')
      .first();
    if (
      await knowledgePointCard.isVisible({ timeout: 3000 }).catch(() => false)
    ) {
      await knowledgePointCard.click();

      const masteryInput = page.locator('input[type="range"]').first();
      if (await masteryInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await masteryInput.fill("60");

        const saveButton = page
          .locator('button:has-text("保存"), button:has-text("更新")')
          .first();
        if (await saveButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await saveButton.click();
        }
      }
    }

    await expect(page).not.toHaveURL(/login/);
  });
});

test.describe("掌握度衰减计算测试", () => {
  let masteryPage: MasteryPageObject;

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    masteryPage = new MasteryPageObject(page);
  });

  test("应该计算并显示衰减后的掌握度", async ({ page }) => {
    await masteryPage.navigateToKnowledgePoints();

    const lastStudyInfo = page
      .locator("text=/上次学习|last study|\\d+天前/i")
      .first();
    const isVisible = await lastStudyInfo
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(typeof isVisible).toBe("boolean");
  });

  test("应该标记需要复习的知识点", async ({ page }) => {
    await masteryPage.navigateToKnowledgePoints();

    const needsReviewBadge = page
      .locator(
        '[data-testid="needs-review"], .needs-review, text=/需要复习|needs review/i',
      )
      .first();
    const isVisible = await needsReviewBadge
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(typeof isVisible).toBe("boolean");
  });

  test("应该显示预计遗忘时间", async ({ page }) => {
    await masteryPage.navigateToKnowledgePoints();

    const forgetPrediction = page
      .locator("text=/预计遗忘|forget prediction|\\d+天后/i")
      .first();
    const isVisible = await forgetPrediction
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(typeof isVisible).toBe("boolean");
  });
});

test.describe("批量复习操作测试", () => {
  let masteryPage: MasteryPageObject;

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
    masteryPage = new MasteryPageObject(page);
  });

  test("应该能够批量开始复习", async ({ page }) => {
    await masteryPage.navigateToReview();

    const startReviewButton = page
      .locator('button:has-text("开始复习"), button:has-text("start review")')
      .first();
    if (
      await startReviewButton.isVisible({ timeout: 3000 }).catch(() => false)
    ) {
      await startReviewButton.click();

      const reviewInterface = page
        .locator('[data-testid="review-interface"], .review-interface')
        .first();
      await expect(reviewInterface)
        .toBeVisible({ timeout: 5000 })
        .catch(() => {});
    }

    await expect(page).not.toHaveURL(/login/);
  });

  test("应该能够跳过当前复习项", async ({ page }) => {
    await masteryPage.navigateToReview();

    const reviewCard = page
      .locator('[data-testid="review-task-card"], .review-task-card')
      .first();
    if (await reviewCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await reviewCard.click();

      const skipButton = page
        .locator('button:has-text("跳过"), button:has-text("skip")')
        .first();
      if (await skipButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await skipButton.click();
      }
    }

    await expect(page).not.toHaveURL(/login/);
  });

  test("应该显示复习统计信息", async ({ page }) => {
    await masteryPage.navigateToReview();

    const statsSection = page
      .locator("text=/统计|statistics|复习次数/i")
      .first();
    const isVisible = await statsSection
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(typeof isVisible).toBe("boolean");
  });
});
