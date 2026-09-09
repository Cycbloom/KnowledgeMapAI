import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import type { OfflineBundle } from "@shared/types";
import type { StudyCard } from "@shared/types/common";
import { importOfflineBundle } from "../offlineImport";
import { updateCardProgressOffline } from "../offlineFsrs";
import { offlineApi } from "../offlineApi";
import { countPendingOps } from "../offlineSync";
import {
  getAll,
  clearStore,
  closeOfflineDb,
  ensureOfflineDb,
  CONTENT_STORES,
  RECORD_STORES,
  META_STORE,
} from "../offlineDb";

function makeCard(overrides: Partial<StudyCard> = {}): StudyCard {
  return {
    id: "card-1",
    knowledge_point_id: "kp-1",
    user_id: "owner-1",
    graph_id: "graph-1",
    source_graph_id: "graph-1",
    question: "什么是 FSRS？",
    answer: "间隔重复调度算法",
    card_type: "qa",
    next_review: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    review_count: 0,
    fsrs_state: "New",
    fsrs_stability: 0,
    fsrs_difficulty: 0,
    fsrs_elapsed_days: 0,
    fsrs_scheduled_days: 0,
    fsrs_retrievability: 0,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeBundle(): OfflineBundle {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    owner: {
      id: "owner-1",
      email: "owner@test.local",
      settings: { request_retention: 0.9 },
    },
    graphs: [
      {
        id: "graph-1",
        user_id: "owner-1",
        title: "算法导论",
        created_at: new Date().toISOString(),
      },
    ],
    knowledgePoints: [
      {
        id: "kp-1",
        owner_id: "owner-1",
        title: "间隔重复",
        content: { "zh-CN": "间隔重复算法介绍" },
        learning_material: { "zh-CN": "这是学习资料正文" },
        created_at: new Date().toISOString(),
      },
      {
        id: "kp-2",
        owner_id: "owner-1",
        title: "记忆曲线",
        created_at: new Date().toISOString(),
      },
    ],
    graphNodes: [
      {
        id: "gn-1",
        graph_id: "graph-1",
        knowledge_point_id: "kp-1",
        x_position: 0,
        y_position: 0,
        level: "root",
        is_accepted: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "gn-2",
        graph_id: "graph-1",
        knowledge_point_id: "kp-2",
        x_position: 1,
        y_position: 1,
        level: "child",
        is_accepted: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    edges: [
      {
        id: "edge-1",
        graph_id: "graph-1",
        source_knowledge_point_id: "kp-1",
        target_knowledge_point_id: "kp-2",
        relationship_type: "prerequisite",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    studyCards: [
      makeCard(),
      makeCard({
        id: "card-2",
        graph_id: "graph-2",
        knowledge_point_id: "kp-2",
        question: "未来卡片",
        next_review: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }),
    ],
    quizSets: [
      {
        id: "quiz-1",
        user_id: "owner-1",
        title: "FSRS 自测",
        config: { cardTypes: ["qa"], difficulty: "medium", knowledgePointIds: ["kp-1"] },
        status: "ready",
        card_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    quizSetCards: [
      {
        id: "qsc-1",
        quiz_set_id: "quiz-1",
        card_id: "card-1",
        display_order: 0,
        created_at: new Date().toISOString(),
      },
    ],
  };
}

beforeEach(async () => {
  for (const store of [...CONTENT_STORES, ...RECORD_STORES, META_STORE]) {
    await clearStore(store);
  }
});

describe("offline 数据层", () => {
  it("导入数据包后可按图/到期筛选并补全来源标题", async () => {
    await importOfflineBundle(makeBundle());

    const all = await offlineApi.study.getCards({});
    expect(all).toHaveLength(2);
    expect(all[0].knowledgePointTitle).toBe("间隔重复");
    expect(all[0].graphTitle).toBe("算法导论");

    const due = await offlineApi.study.getCards({ due: true });
    expect(due.map((c) => c.id)).toEqual(["card-1"]);

    const byGraph = await offlineApi.study.getCards({ graph_id: "graph-2" });
    expect(byGraph.map((c) => c.id)).toEqual(["card-2"]);
  });

  it("客户端 FSRS 更新卡片进度并写入复习日志与操作日志", async () => {
    await importOfflineBundle(makeBundle());

    const updated = await updateCardProgressOffline("card-1", 3);
    expect(updated.review_count).toBeGreaterThanOrEqual(1);
    expect(updated.fsrs_state).not.toBe("New");
    expect(new Date(updated.next_review).getTime()).toBeGreaterThan(Date.now());
    expect(updated.fsrs_stability).toBeGreaterThan(0);

    const logs = await getAll<{ card_id: string; quality: number }>("review_logs");
    expect(logs).toHaveLength(1);
    expect(logs[0].card_id).toBe("card-1");
    expect(logs[0].quality).toBe(3);

    const opLog = await getAll<{ action: string; record_id: string }>("op_log");
    expect(opLog).toHaveLength(1);
    expect(opLog[0].action).toBe("update");
    expect(opLog[0].record_id).toBe("card-1");
  });

  it("答题记录落库并生成可回传操作日志", async () => {
    await importOfflineBundle(makeBundle());

    const result = await offlineApi.study.recordQuizAttempt("quiz-1", [
      { card_id: "card-1", correct: true, time_spent: 5 },
      { card_id: "card-2", correct: false, time_spent: 8 },
    ]);

    expect(result.success).toBe(true);
    expect(result.data.correctCount).toBe(1);
    expect(result.data.totalCount).toBe(2);
    expect(result.data.score).toBe(50);

    const sessions = await getAll<{ quiz_set_id: string }>("quiz_sessions");
    expect(sessions).toHaveLength(1);
    expect(sessions[0].quiz_set_id).toBe("quiz-1");

    const opLog = await getAll<{ table: string; action: string }>("op_log");
    expect(opLog.some((op) => op.table === "quiz_sessions" && op.action === "create")).toBe(true);
  });

  it("题库读取：quiz.get 返回带卡片的 QuizSetWithCards", async () => {
    await importOfflineBundle(makeBundle());

    const quizSet = await offlineApi.quiz.get("quiz-1");
    expect(quizSet.title).toBe("FSRS 自测");
    expect(quizSet.cards).toHaveLength(1);
    expect(quizSet.cards[0].id).toBe("card-1");
  });

  it("统计聚合基于本地卡片计算", async () => {
    await importOfflineBundle(makeBundle());

    const stats = await offlineApi.study.getStats("graph-1");
    expect(stats.totalCards).toBe(1);
    expect(stats.dueCards).toBe(1);

    const statistics = await offlineApi.statistics.getStats();
    expect(statistics.metrics.totalCards).toBe(2);
    expect(statistics.distribution).toHaveLength(4);
  });

  it("学习资料读取：nodes.get 返回 learning_material 与本地化标题", async () => {
    await importOfflineBundle(makeBundle());

    const node = await offlineApi.nodes.get("kp-1");
    expect(node.id).toBe("kp-1");
    expect(node.graph_id).toBe("graph-1");
    expect(node.title).toBe("间隔重复");
    expect(node.learning_material).toEqual({ "zh-CN": "这是学习资料正文" });
  });

  it("图谱大纲读取：graphs.getNodes 返回节点/边/学习状态", async () => {
    await importOfflineBundle(makeBundle());

    const result = await offlineApi.graphs.getNodes("graph-1", false, true);
    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[0].learning_material).toEqual({ "zh-CN": "这是学习资料正文" });
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].source_knowledge_point_id).toBe("kp-1");
    expect(result.nodeStatus).toBeDefined();
    expect(result.nodeStatus?.["kp-1"]).toBeDefined();
  });

  it("待同步计数：复习与答题产生的操作日志被统计", async () => {
    await importOfflineBundle(makeBundle());

    const before = await countPendingOps();
    expect(before).toBe(0);

    await offlineApi.study.updateProgress("card-1", 3);
    await offlineApi.study.recordQuizAttempt("quiz-1", [
      { card_id: "card-1", correct: true },
    ]);

    const after = await countPendingOps();
    expect(after).toBe(2);
  });

  it("旧版 v1 库升级后自动补齐 graph_nodes/edges 存储（修复零节点）", async () => {
    // 先重置连接并删除库，再以旧 schema（无 graph_nodes/edges）建一个 v1 库
    await closeOfflineDb();
    await new Promise<void>((resolve, reject) => {
      const delReq = indexedDB.deleteDatabase("KnowledgeMapOffline");
      delReq.onsuccess = () => resolve();
      delReq.onerror = () => reject(delReq.error);
      delReq.onblocked = () => resolve();
    });
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("KnowledgeMapOffline", 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        const oldStores: Array<{ name: string; keyPath: string }> = [
          { name: "graphs", keyPath: "id" },
          { name: "knowledge_points", keyPath: "id" },
          { name: "study_cards", keyPath: "id" },
          { name: "quiz_sets", keyPath: "id" },
          { name: "quiz_set_cards", keyPath: "id" },
          { name: "meta", keyPath: "key" },
          { name: "review_logs", keyPath: "id" },
          { name: "quiz_sessions", keyPath: "id" },
          { name: "op_log", keyPath: "id" },
        ];
        for (const store of oldStores) {
          if (!db.objectStoreNames.contains(store.name)) {
            db.createObjectStore(store.name, { keyPath: store.keyPath });
          }
        }
      };
      req.onsuccess = () => {
        req.result.close();
        resolve();
      };
      req.onerror = () => reject(req.error);
    });

    // 通过 offlineDb（v2）重新打开 → onupgradeneeded 补建新 store → 导入成功
    await ensureOfflineDb();
    await importOfflineBundle(makeBundle());
    const graphNodes = await getAll("graph_nodes");
    const edges = await getAll("edges");
    expect(graphNodes.length).toBeGreaterThan(0);
    expect(edges.length).toBeGreaterThan(0);

    // 清理：关闭连接，避免影响后续用例
    await closeOfflineDb();
    await clearStore("meta");
  });
});
