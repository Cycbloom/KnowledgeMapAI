import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";
import { authedRequest } from "./utils/auth";

/**
 * 复习流程 E2E 测试。
 *
 * 覆盖复习闭环：生成复习卡片 → 拉取待复习卡片 → 提交作答（FSRS 进度更新）→
 * 复习统计 → FSRS 参数读写。
 *
 * 策略（App Action 模式）：
 * - 准备：通过 API 创建「知识点 → 图谱节点 → 学习卡片」链条（比 UI 生成更快更稳定，
 *   且不依赖真实 AI 服务）。
 * - 断言：使用显式断言（`toBe(true)` / `toBeGreaterThanOrEqual` / `toBe` 等）。
 *
 * 端点说明：规范简写为 `/api/learning/study/*`，但实际后端将 study 路由挂载在
 * `/api/v1/study`（见 `api/services/plugins/StudyPlugin.ts`），旧 `/api/*` 通过
 * 308 重定向到 `/api/v1/*`（见 `api/app.ts`）。以下按实际实现使用 `/api/v1/study/*`。
 */

/**
 * 复习卡片种子数据类型。
 */
type SeededCard = {
  knowledgePointId: string;
  cardId: string;
};

/**
 * 通过 API 创建「知识点 → 图谱节点 → 学习卡片」链条。
 *
 * 1. POST /api/v1/knowledge-points 创建知识点
 * 2. POST /api/v1/graph-nodes 将知识点挂载为图谱节点（study/cards 要求知识点已挂载节点）
 * 3. POST /api/v1/study/cards 创建学习卡片（携带 graph_id 与 knowledge_point_id）
 */
async function seedStudyCard(page: Page, graphId: string): Promise<SeededCard> {
  const unique = Date.now();

  const kpRes = await authedRequest(page, "POST", "/api/v1/knowledge-points", {
    title: `复习测试知识点_${unique}`,
    content: "复习测试知识点内容",
  });
  expect(kpRes.ok, `创建知识点失败: HTTP ${kpRes.status}`).toBe(true);
  const kp = kpRes.body as { id: string };
  expect(kp.id).toBeTruthy();

  const nodeRes = await authedRequest(page, "POST", "/api/v1/graph-nodes", {
    graph_id: graphId,
    knowledge_point_id: kp.id,
    level: "normal",
  });
  expect(nodeRes.ok, `创建图谱节点失败: HTTP ${nodeRes.status}`).toBe(true);
  const node = nodeRes.body as { id: string };
  expect(node.id).toBeTruthy();

  const cardRes = await authedRequest(page, "POST", "/api/v1/study/cards", {
    knowledge_point_id: kp.id,
    graph_id: graphId,
    question: `复习卡片问题_${unique}`,
    answer: "复习卡片答案",
    card_type: "qa",
  });
  expect(cardRes.ok, `创建复习卡片失败: HTTP ${cardRes.status}`).toBe(true);
  const card = cardRes.body as { id: string };
  expect(card.id).toBeTruthy();

  return { knowledgePointId: kp.id, cardId: card.id };
}

/**
 * 清理复习卡片种子数据。
 *
 * 硬删除知识点会级联删除关联的 graph_node 与 study_card
 * （详见 `supabase/migrations/06_study_and_cards.sql` 与
 * `supabase/migrations/04_graph_structure.sql` 的 ON DELETE CASCADE）。
 * 图谱本身由 `testGraph` fixture 的 teardown 永久删除。
 */
async function cleanupStudyCard(
  page: Page,
  knowledgePointId: string,
): Promise<void> {
  const res = await authedRequest(
    page,
    "DELETE",
    `/api/v1/knowledge-points/${knowledgePointId}/hard-delete`,
  );
  expect(res.ok, `清理知识点失败: HTTP ${res.status}`).toBe(true);
}

test.describe("复习流程（学习卡片 + FSRS）", () => {
  test("应该能够通过 API 生成复习卡片", async ({
    authenticatedPage: page,
    testGraph,
  }) => {
    // App Action：通过 API 生成卡片，断言返回卡片含 id
    const seeded = await seedStudyCard(page, testGraph.id);
    expect(seeded.cardId).toBeTruthy();

    await cleanupStudyCard(page, seeded.knowledgePointId);
  });

  test("应该能够拉取待复习卡片", async ({
    authenticatedPage: page,
    testGraph,
  }) => {
    const seeded = await seedStudyCard(page, testGraph.id);

    // 拉取该图谱下的学习卡片，断言可检索到刚生成的卡片
    const listRes = await authedRequest(
      page,
      "GET",
      `/api/v1/study/cards?graph_id=${testGraph.id}`,
    );
    expect(listRes.ok, `拉取复习卡片失败: HTTP ${listRes.status}`).toBe(true);
    const cards = listRes.body as Array<{ id: string }>;
    const found = cards.some((c) => c.id === seeded.cardId);
    expect(found, "生成的复习卡片未出现在卡片列表中").toBe(true);

    await cleanupStudyCard(page, seeded.knowledgePointId);
  });

  test("应该能够提交复习作答并更新进度", async ({
    authenticatedPage: page,
    testGraph,
  }) => {
    const seeded = await seedStudyCard(page, testGraph.id);

    // 提交作答：PUT 进度，携带 quality（0–5 有效值，3 = Good）
    const progressRes = await authedRequest(
      page,
      "PUT",
      `/api/v1/study/cards/${seeded.cardId}/progress`,
      { quality: 3 },
    );
    expect(progressRes.ok, `提交复习作答失败: HTTP ${progressRes.status}`).toBe(
      true,
    );
    const updated = progressRes.body as {
      id: string;
      fsrs_state: string;
      fsrs_scheduled_days: number;
      review_count: number;
      next_review: string;
    };
    expect(updated.id).toBe(seeded.cardId);
    // 新卡片（New）+ Good → Learning，review_count 递增，调度按 FSRS 更新
    expect(updated.fsrs_state).toBe("Learning");
    expect(updated.review_count).toBe(1);
    expect(updated.fsrs_scheduled_days).toBeGreaterThanOrEqual(0);
    expect(updated.next_review).toBeTruthy();

    await cleanupStudyCard(page, seeded.knowledgePointId);
  });

  test("应该能够查询复习统计", async ({
    authenticatedPage: page,
    testGraph,
  }) => {
    const seeded = await seedStudyCard(page, testGraph.id);

    const statsRes = await authedRequest(
      page,
      "GET",
      `/api/v1/study/stats?graph_id=${testGraph.id}`,
    );
    expect(statsRes.ok, `查询复习统计失败: HTTP ${statsRes.status}`).toBe(true);
    const stats = statsRes.body as {
      totalCards: number;
      dueCards: number;
      newCards: number;
      learningCards: number;
      reviewCards: number;
      relearningCards: number;
      averageRetrievability: number;
      averageStability: number;
      averageDifficulty: number;
    };
    // 刚生成的卡片计入总数与 New 状态
    expect(stats.totalCards).toBeGreaterThanOrEqual(1);
    expect(stats.newCards).toBeGreaterThanOrEqual(1);
    // 其余统计字段为数值且非负
    expect(stats.dueCards).toBeGreaterThanOrEqual(0);
    expect(stats.learningCards).toBeGreaterThanOrEqual(0);
    expect(stats.reviewCards).toBeGreaterThanOrEqual(0);
    expect(stats.relearningCards).toBeGreaterThanOrEqual(0);
    expect(stats.averageRetrievability).toBeGreaterThanOrEqual(0);
    expect(stats.averageStability).toBeGreaterThanOrEqual(0);
    expect(stats.averageDifficulty).toBeGreaterThanOrEqual(0);

    await cleanupStudyCard(page, seeded.knowledgePointId);
  });

  test("应该能够读写 FSRS 参数", async ({ authenticatedPage: page }) => {
    // GET：读取当前 FSRS 参数
    const getRes = await authedRequest(page, "GET", "/api/v1/study/fsrs-parameters");
    expect(getRes.ok, `读取 FSRS 参数失败: HTTP ${getRes.status}`).toBe(true);
    const params = getRes.body as {
      source: string;
      w: number[];
      request_retention: number;
      maximum_interval: number;
    };
    expect(params.w.length).toBeGreaterThan(0);
    expect(params.request_retention).toBeGreaterThan(0);
    expect(params.maximum_interval).toBeGreaterThan(0);

    // PUT：写回（用读取到的 w，写入后 source 应变更为 custom）
    const putRes = await authedRequest(page, "PUT", "/api/v1/study/fsrs-parameters", {
      w: params.w,
    });
    expect(putRes.ok, `写入 FSRS 参数失败: HTTP ${putRes.status}`).toBe(true);
    const updated = putRes.body as {
      source: string;
      w: number[];
      request_retention: number;
      maximum_interval: number;
    };
    expect(updated.source).toBe("custom");
    expect(updated.w.length).toBe(params.w.length);
    expect(updated.request_retention).toBeGreaterThan(0);
    expect(updated.maximum_interval).toBeGreaterThan(0);

    // 清理：重置为默认参数，避免污染测试用户设置
    const resetRes = await authedRequest(
      page,
      "DELETE",
      "/api/v1/study/fsrs-parameters",
    );
    expect(resetRes.ok, `重置 FSRS 参数失败: HTTP ${resetRes.status}`).toBe(true);
  });
});