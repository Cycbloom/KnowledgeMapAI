import { Page, Locator, expect } from "@playwright/test";
import { createGraphViaSupabase } from "../utils/testHelpers";

export class DashboardPage {
  readonly page: Page;
  readonly title: Locator;
  readonly searchInput: Locator;
  readonly newGraphButton: Locator;
  readonly aiGenerateButton: Locator;
  readonly graphCards: Locator;
  readonly themeButton: Locator;
  readonly emptyState: Locator;
  readonly templateSelector: Locator;
  readonly skipTemplateButton: Locator;
  readonly createGraphModal: Locator;
  readonly graphTitleInput: Locator;
  readonly graphDescriptionInput: Locator;
  readonly confirmCreateButton: Locator;
  readonly cancelButton: Locator;
  readonly deleteConfirmModal: Locator;
  readonly deleteConfirmButton: Locator;
  readonly deleteCancelButton: Locator;
  readonly graphCardMenuButton: Locator;
  readonly noResultsState: Locator;
  readonly firstGraphCard: Locator;
  readonly favoriteFilterButton: Locator;
  readonly sortDropdown: Locator;

  constructor(page: Page) {
    this.page = page;
    this.title = page.locator('h1:has-text("我的知识图谱")');
    this.searchInput = page.locator('input[placeholder*="搜索"]');
    this.newGraphButton = page.locator('button:has-text("新建图谱")').first();
    this.aiGenerateButton = page.locator('button:has-text("AI 生成")');
    this.graphCards = page.locator('[class*="group relative rounded-2xl"]');
    this.themeButton = page.locator('button[title*="切换"]');
    this.emptyState = page.locator("text=开始您的知识之旅");
    this.templateSelector = page.locator("text=选择模板");
    this.skipTemplateButton = page.locator(
      'button:has-text("跳过，创建空白图谱")',
    );
    this.createGraphModal = page.locator(".fixed.inset-0.z-50");
    this.graphTitleInput = page.locator('input[placeholder*="例如"]');
    this.graphDescriptionInput = page.locator('textarea[placeholder*="描述"]');
    this.confirmCreateButton = page.locator('button:has-text("立即创建")');
    this.cancelButton = page.locator('button:has-text("取消")');
    this.deleteConfirmModal = page.locator(
      '.fixed.inset-0.z-50:has-text("删除图谱")',
    );
    this.deleteConfirmButton = page.locator(
      '.fixed.inset-0.z-50:has-text("删除图谱") button:has-text("确定")',
    );
    this.deleteCancelButton = page.locator(
      '.fixed.inset-0.z-50:has-text("删除图谱") button:has-text("取消")',
    );
    this.graphCardMenuButton = page.locator(
      '[class*="group relative rounded-2xl"] button[title="删除图谱"]',
    );
    this.noResultsState = page.locator("text=未找到相关图谱");
    this.firstGraphCard = page
      .locator('[class*="group relative rounded-2xl"]')
      .first();
    this.favoriteFilterButton = page.locator('button:has-text("收藏")');
    this.sortDropdown = page.locator(
      'button:has-text("排序"), select[data-testid="sort-select"]',
    );
  }

  async goto() {
    await this.page.goto("/");
  }

  async searchGraphs(query: string) {
    await this.searchInput.fill(query);
  }

  async clearSearch() {
    await this.searchInput.clear();
  }

  async openCreateGraphModal() {
    const fabButton = this.page.locator(
      'button[class*="fixed bottom-6 right-6"], button.fixed.bottom-6.right-6',
    );
    const hasFAB = (await fabButton.count()) > 0;

    if (hasFAB) {
      await fabButton.first().click();
      await this.page.waitForTimeout(300);
      const newGraphMenuItem = this.page
        .locator('button:has-text("新建图谱")')
        .first();
      await newGraphMenuItem.click();
    } else {
      await this.newGraphButton.click();
    }

    await this.graphTitleInput.waitFor({ state: "visible", timeout: 15000 });
  }

  async createGraph(title: string, description?: string) {
    const graphId = await createGraphViaSupabase(this.page, title, description);
    await this.page.goto(`/graph/${graphId}`);
    // 增加超时时间到 30 秒，确保页面完全加载
    await this.page.waitForLoadState("domcontentloaded", { timeout: 30000 });
    // 额外等待确保 React 组件渲染完成
    await this.page.waitForTimeout(2000);
  }

  async toggleTheme() {
    await this.themeButton.click();
  }

  async isDarkMode() {
    return await this.page.evaluate(() => {
      return document.documentElement.classList.contains("dark");
    });
  }

  async getGraphCount() {
    return await this.graphCards.count();
  }

  async closeModal() {
    await this.cancelButton.click();
  }

  async getGraphCardByTitle(title: string) {
    return this.page.locator(
      `[class*="group relative rounded-2xl"]:has-text("${title}")`,
    );
  }

  async deleteGraphByTitle(title: string) {
    const card = this.getGraphCardByTitle(title);
    await card.hover();
    const deleteButton = card.locator('button[title="删除图谱"]');
    await deleteButton.click();
  }

  async confirmDelete() {
    await this.deleteConfirmButton.click();
  }

  async cancelDelete() {
    await this.deleteCancelButton.click();
  }

  async isGraphVisible(title: string) {
    const card = this.getGraphCardByTitle(title);
    return await card.isVisible();
  }

  async waitForGraphToBeVisible(title: string, timeout = 10000) {
    const card = this.getGraphCardByTitle(title);
    await expect(card).toBeVisible({ timeout });
  }

  async waitForGraphToBeHidden(title: string, timeout = 10000) {
    const card = this.getGraphCardByTitle(title);
    await expect(card).not.toBeVisible({ timeout });
  }

  async isEmptyStateVisible() {
    return await this.emptyState.isVisible();
  }

  async isNoResultsStateVisible() {
    return await this.noResultsState.isVisible();
  }

  async getGraphCardTitles() {
    const cards = await this.graphCards.all();
    const titles: string[] = [];
    for (const card of cards) {
      const titleElement = card.locator("h3");
      const title = await titleElement.textContent();
      if (title) {
        titles.push(title.trim());
      }
    }
    return titles;
  }

  // 收藏相关方法
  async toggleFavorite(title: string) {
    const card = this.getGraphCardByTitle(title);
    await card.hover();
    const favoriteButton = card.locator(
      'button[title="收藏图谱"], button[title="取消收藏"]',
    );
    await favoriteButton.click();
  }

  async isFavorited(title: string) {
    const card = this.getGraphCardByTitle(title);
    const filledStar = card.locator('svg[fill="currentColor"]');
    return (await filledStar.count()) > 0;
  }

  async getFavoriteButton(title: string) {
    const card = this.getGraphCardByTitle(title);
    return card.locator('button[title="收藏图谱"], button[title="取消收藏"]');
  }

  // 分页相关方法
  async goToNextPage() {
    const nextButton = this.page.locator(
      'button:has(svg[class*="chevron-right"]), button:has(svg.lucide-chevron-right)',
    );
    if ((await nextButton.count()) > 0) {
      await nextButton.last().click();
    }
  }

  async goToPreviousPage() {
    const prevButton = this.page.locator(
      'button:has(svg[class*="chevron-left"]), button:has(svg.lucide-chevron-left)',
    );
    if ((await prevButton.count()) > 0) {
      await prevButton.first().click();
    }
  }

  async getCurrentPage() {
    const activePage = this.page.locator("button.bg-blue-600");
    if ((await activePage.count()) > 0) {
      const text = await activePage.textContent();
      return parseInt(text || "1");
    }
    return 1;
  }

  async getTotalPages() {
    const pageText = this.page.locator("text=/\\d+\\s*\\/\\s*\\d+/");
    if ((await pageText.count()) > 0) {
      const text = await pageText.textContent();
      const match = text?.match(/(\d+)\s*\/\s*(\d+)/);
      if (match) {
        return parseInt(match[2]);
      }
    }
    return 1;
  }

  // 图谱卡片详情获取
  async getGraphCardInfo(title: string) {
    const card = this.getGraphCardByTitle(title);
    const titleText = await card.locator("h3").textContent();
    const description = await card.locator("p").first().textContent();
    const nodesCount = await card.locator("text=节点").textContent();

    return {
      title: titleText?.trim() || "",
      description: description?.trim() || "",
      nodesCount: nodesCount?.trim() || "",
    };
  }

  // 等待图谱列表加载完成
  async waitForGraphsToLoad(timeout = 10000) {
    await this.page
      .waitForSelector('[class*="group relative rounded-2xl"]', {
        state: "attached",
        timeout,
      })
      .catch(() => {
        // 如果没有图谱卡片，检查空状态
      });
  }

  // 获取所有收藏的图谱
  async getFavoritedGraphTitles() {
    const cards = await this.graphCards.all();
    const favoritedTitles: string[] = [];

    for (const card of cards) {
      const filledStar = card.locator('svg[fill="currentColor"]');
      if ((await filledStar.count()) > 0) {
        const title = await card.locator("h3").textContent();
        if (title) {
          favoritedTitles.push(title.trim());
        }
      }
    }

    return favoritedTitles;
  }

  // 排序相关方法
  async selectSortOption(option: string) {
    const sortDropdown = this.page.locator(
      'button:has-text("排序"), select[data-testid="sort-select"]',
    );
    if ((await sortDropdown.count()) > 0) {
      const isSelect = await sortDropdown.evaluate(
        (el) => el.tagName === "SELECT",
      );
      if (isSelect) {
        await sortDropdown.selectOption(option);
      } else {
        await sortDropdown.click();
        const optionButton = this.page
          .locator(`button:has-text("${option}")`)
          .first();
        await optionButton.click();
      }
      await this.page.waitForTimeout(500);
    }
  }

  async getCurrentSortOption() {
    const sortDropdown = this.page.locator(
      'button:has-text("排序"), select[data-testid="sort-select"]',
    );
    if ((await sortDropdown.count()) > 0) {
      const isSelect = await sortDropdown.evaluate(
        (el) => el.tagName === "SELECT",
      );
      if (isSelect) {
        return await sortDropdown.inputValue();
      } else {
        return await sortDropdown.textContent();
      }
    }
    return "";
  }

  async isSortDropdownVisible() {
    return (await this.sortDropdown.count()) > 0;
  }

  // 收藏筛选相关方法
  async filterByFavorites() {
    const favoriteFilter = this.page.locator(
      'button:has-text("收藏"), button[title="仅显示收藏"]',
    );
    if ((await favoriteFilter.count()) > 0) {
      await favoriteFilter.click();
      await this.page.waitForTimeout(500);
    }
  }

  async clearFavoriteFilter() {
    const activeFilter = this.page.locator(
      'button.bg-blue-600:has-text("收藏"), button[aria-pressed="true"]',
    );
    if ((await activeFilter.count()) > 0) {
      await activeFilter.click();
      await this.page.waitForTimeout(500);
    }
  }

  async isFavoriteFilterActive() {
    const activeFilter = this.page.locator(
      'button.bg-blue-600:has-text("收藏"), button[aria-pressed="true"]',
    );
    return (await activeFilter.count()) > 0;
  }

  // 分享功能相关方法
  async openShareMenu(title: string) {
    const card = this.getGraphCardByTitle(title);
    await card.hover();
    const shareButton = card.locator(
      'button[title*="分享"], button:has(svg[class*="share"])',
    );
    if ((await shareButton.count()) > 0) {
      await shareButton.click();
      await this.page.waitForTimeout(300);
    }
  }

  async isShareMenuVisible() {
    const shareMenu = this.page.locator(
      '.fixed:has-text("分享"), [role="dialog"]:has-text("分享")',
    );
    return (await shareMenu.count()) > 0;
  }

  async closeShareMenu() {
    const shareMenu = this.page.locator(
      '.fixed:has-text("分享"), [role="dialog"]:has-text("分享")',
    );
    if ((await shareMenu.count()) > 0) {
      const closeButton = shareMenu
        .locator('button:has(svg[class*="x"]), button:has-text("关闭")')
        .first();
      await closeButton.click();
      await this.page.waitForTimeout(300);
    }
  }

  async getShareLink() {
    const shareInput = this.page.locator(
      'input[value*="http"], input[readonly]',
    );
    if ((await shareInput.count()) > 0) {
      return await shareInput.inputValue();
    }
    return "";
  }

  async copyShareLink() {
    const copyButton = this.page.locator(
      'button:has-text("复制"), button:has-text("Copy")',
    );
    if ((await copyButton.count()) > 0) {
      await copyButton.click();
      await this.page.waitForTimeout(300);
    }
  }

  async toggleGraphVisibility(title: string) {
    const card = this.getGraphCardByTitle(title);
    await card.hover();
    const visibilityButton = card.locator(
      'button[title*="公开"], button[title*="私有"]',
    );
    if ((await visibilityButton.count()) > 0) {
      await visibilityButton.click();
      await this.page.waitForTimeout(500);
    }
  }

  async getGraphVisibility(title: string) {
    const card = this.getGraphCardByTitle(title);
    const visibilityBadge = card.locator('text="公开", text="私有"');
    if ((await visibilityBadge.count()) > 0) {
      return await visibilityBadge.textContent();
    }
    return "";
  }
}
