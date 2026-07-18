import { describe, it, expect, beforeEach, vi } from "vitest";
import { taskRecommendationService } from "../taskRecommendationService";
import type { UserTask } from "../../../../shared/types/scheduler-task";
import {
  createMockSupabase,
  type MockSupabaseClient,
  type MockQueryChain,
} from "../../../../tests/helpers/mockFactories";

function makeChain(data: unknown, error: unknown = null): MockQueryChain {
  const client = createMockSupabase({ data, error }) as unknown as MockSupabaseClient;
  return client._queryChain;
}

function buildTask(overrides: Partial<UserTask> = {}): UserTask {
  return {
    id: "task-1",
    user_id: "user-1",
    title: "测试任务",
    queue_level: 0,
    position: 0,
    status: "pending",
    tags: [],
    priority: 1,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

function dateAtHour(hour: number): Date {
  const d = new Date("2024-06-01T00:00:00Z");
  d.setHours(hour, 0, 0, 0);
  return d;
}

describe("TaskRecommendationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("calculateUrgencyScore", () => {
    it("应该在任务已超过截止日期时返回最高分 100", () => {
      const pastDeadline = new Date(Date.now() - 86400000).toISOString();
      const task = buildTask({ deadline: pastDeadline, priority: 1, queue_level: 0 });
      const score = taskRecommendationService.calculateUrgencyScore(task);
      expect(score).toBe(100);
    });

    it("应该在无截止日期且优先级 1 队列 0 时返回基础分 65", () => {
      const task = buildTask({ deadline: undefined, priority: 1, queue_level: 0 });
      const score = taskRecommendationService.calculateUrgencyScore(task);
      expect(score).toBe(65);
    });

    it("应该在优先级 3 队列 0 无截止日期时返回 95", () => {
      const task = buildTask({ deadline: undefined, priority: 3, queue_level: 0 });
      const score = taskRecommendationService.calculateUrgencyScore(task);
      expect(score).toBe(95);
    });

    it("应该为短任务加分", () => {
      const task = buildTask({
        deadline: undefined,
        priority: 1,
        queue_level: 0,
        estimated_duration: 20,
      });
      const score = taskRecommendationService.calculateUrgencyScore(task);
      expect(score).toBe(80);
    });

    it("应该为队列 2 的任务降低分数", () => {
      const task = buildTask({ deadline: undefined, priority: 1, queue_level: 2 });
      const score = taskRecommendationService.calculateUrgencyScore(task);
      expect(score).toBe(45);
    });
  });

  describe("getUrgencyLevel", () => {
    it("应该在分数大于等于 80 时返回 critical", () => {
      expect(taskRecommendationService.getUrgencyLevel(80)).toBe("critical");
      expect(taskRecommendationService.getUrgencyLevel(100)).toBe("critical");
    });

    it("应该在分数 60-79 时返回 high", () => {
      expect(taskRecommendationService.getUrgencyLevel(60)).toBe("high");
      expect(taskRecommendationService.getUrgencyLevel(79)).toBe("high");
    });

    it("应该在分数 40-59 时返回 medium", () => {
      expect(taskRecommendationService.getUrgencyLevel(40)).toBe("medium");
      expect(taskRecommendationService.getUrgencyLevel(59)).toBe("medium");
    });

    it("应该在分数小于 40 时返回 low", () => {
      expect(taskRecommendationService.getUrgencyLevel(0)).toBe("low");
      expect(taskRecommendationService.getUrgencyLevel(39)).toBe("low");
    });
  });

  describe("getCurrentTimeSlot", () => {
    it("应该在上午时段返回 morning", () => {
      const slot = taskRecommendationService.getCurrentTimeSlot(dateAtHour(10));
      expect(slot.type).toBe("morning");
      expect(slot.label).toBe("上午");
    });

    it("应该在下午时段返回 afternoon", () => {
      const slot = taskRecommendationService.getCurrentTimeSlot(dateAtHour(14));
      expect(slot.type).toBe("afternoon");
      expect(slot.label).toBe("下午");
    });

    it("应该在傍晚时段返回 evening", () => {
      const slot = taskRecommendationService.getCurrentTimeSlot(dateAtHour(20));
      expect(slot.type).toBe("evening");
      expect(slot.label).toBe("傍晚");
    });

    it("应该在夜间时段返回 night", () => {
      const slot = taskRecommendationService.getCurrentTimeSlot(dateAtHour(23));
      expect(slot.type).toBe("night");
      expect(slot.label).toBe("夜间");
    });
  });

  describe("analyzePriorityFromText", () => {
    it("应该在检测到紧急关键词时返回 critical 级别", () => {
      const result = taskRecommendationService.analyzePriorityFromText("修复 bug asap");
      expect(result.suggestedPriority).toBe(4);
      expect(result.suggestedQueue).toBe(0);
      expect(result.keywords).toContain("asap");
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    it("应该在检测到重要关键词时返回 high 级别", () => {
      const result = taskRecommendationService.analyzePriorityFromText("important task");
      expect(result.suggestedPriority).toBe(3);
      expect(result.suggestedQueue).toBe(0);
      expect(result.keywords).toContain("important");
    });

    it("应该在检测到低优先级关键词时返回 low 级别", () => {
      const result = taskRecommendationService.analyzePriorityFromText("low priority task");
      expect(result.suggestedPriority).toBe(1);
      expect(result.suggestedQueue).toBe(2);
      expect(result.keywords).toContain("low");
    });

    it("应该在无匹配关键词时返回默认中等优先级", () => {
      const result = taskRecommendationService.analyzePriorityFromText("普通任务");
      expect(result.suggestedPriority).toBe(2);
      expect(result.suggestedQueue).toBe(1);
      expect(result.confidence).toBe(0.5);
      expect(result.keywords).toEqual([]);
      expect(result.reasons).toHaveLength(1);
    });
  });

  describe("getTimeSlotRecommendations", () => {
    it("应该将匹配时段标签的任务排在前面", () => {
      const morningSlot = taskRecommendationService.getCurrentTimeSlot(dateAtHour(10));
      const tasks = [
        buildTask({ id: "task-work", tags: ["工作"] }),
        buildTask({ id: "task-study", tags: ["学习"] }),
      ];

      const sorted = taskRecommendationService.getTimeSlotRecommendations(tasks, morningSlot);
      expect(sorted[0].id).toBe("task-study");
      expect(sorted[1].id).toBe("task-work");
    });

    it("应该在无匹配标签时保持原顺序", () => {
      const morningSlot = taskRecommendationService.getCurrentTimeSlot(dateAtHour(10));
      const tasks = [
        buildTask({ id: "task-a", tags: ["运动"] }),
        buildTask({ id: "task-b", tags: ["休息"] }),
      ];

      const sorted = taskRecommendationService.getTimeSlotRecommendations(tasks, morningSlot);
      expect(sorted).toHaveLength(2);
    });
  });

  describe("calculateOptimalTaskOrder", () => {
    it("应该按综合得分降序排列任务", () => {
      const now = new Date("2024-06-01T10:00:00Z");
      const highPriorityTask = buildTask({
        id: "high",
        priority: 4,
        queue_level: 0,
        deadline: new Date("2024-06-01T13:00:00Z").toISOString(),
        tags: [],
      });
      const lowPriorityTask = buildTask({
        id: "low",
        priority: 1,
        queue_level: 2,
        deadline: undefined,
        tags: [],
      });

      const efficiencyData = {
        hourlyEfficiency: {},
        tagEfficiency: {},
        queueEfficiency: {},
        peakHours: [],
        lowHours: [],
      };

      const ordered = taskRecommendationService.calculateOptimalTaskOrder(
        [lowPriorityTask, highPriorityTask],
        efficiencyData,
        now,
      );

      expect(ordered[0].id).toBe("high");
      expect(ordered[1].id).toBe("low");
    });
  });

  describe("calculateDynamicPriority", () => {
    it("应该在任务已过期时返回高分并包含已过期因素", () => {
      const now = new Date("2024-06-01T10:00:00Z");
      const overdueTask = buildTask({
        deadline: new Date("2024-06-01T06:00:00Z").toISOString(),
        priority: 1,
        queue_level: 0,
      });

      const result = taskRecommendationService.calculateDynamicPriority(overdueTask, now);
      expect(result.score).toBe(100);
      const factorNames = result.factors.map((f) => f.name);
      expect(factorNames).toContain("已过期");
      expect(factorNames).toContain("优先级");
      expect(factorNames).toContain("队列");
    });

    it("应该在无截止日期时返回基础分并包含优先级和队列因素", () => {
      const now = new Date("2024-06-01T10:00:00Z");
      const task = buildTask({ deadline: undefined, priority: 2, queue_level: 1 });

      const result = taskRecommendationService.calculateDynamicPriority(task, now);
      expect(result.score).toBe(76);
      const factorNames = result.factors.map((f) => f.name);
      expect(factorNames).toContain("优先级");
      expect(factorNames).toContain("队列");
      expect(factorNames).not.toContain("已过期");
    });

    it("应该为短任务添加快速任务因素", () => {
      const now = new Date("2024-06-01T10:00:00Z");
      const task = buildTask({
        deadline: undefined,
        priority: 1,
        queue_level: 0,
        estimated_duration: 20,
      });

      const result = taskRecommendationService.calculateDynamicPriority(task, now);
      const factorNames = result.factors.map((f) => f.name);
      expect(factorNames).toContain("快速任务");
    });
  });

  describe("calculateEfficiencyData", () => {
    it("应该在数据库错误时返回默认效率数据", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      inner.from.mockReturnValueOnce(makeChain(null, { message: "DB error" }));

      const result = await taskRecommendationService.calculateEfficiencyData(supabase, "user-1");

      expect(result.hourlyEfficiency[0]).toBe(0);
      expect(result.hourlyEfficiency[10]).toBe(0);
      expect(result.tagEfficiency).toEqual({});
      expect(result.queueEfficiency).toEqual({});
      expect(result.peakHours).toHaveLength(4);
      expect(result.lowHours).toHaveLength(4);
    });

    it("应该正确计算效率数据", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      const executions = [
        {
          started_at: "2024-06-01T10:00:00",
          duration: 30,
          status: "completed",
          user_tasks: { tags: ["学习"], queue_level: 0 },
        },
        {
          started_at: "2024-06-01T14:00:00",
          duration: 60,
          status: "in_progress",
          user_tasks: { tags: ["工作"], queue_level: 1 },
        },
      ];
      inner.from.mockReturnValueOnce(makeChain(executions));

      const result = await taskRecommendationService.calculateEfficiencyData(supabase, "user-1");

      expect(result.hourlyEfficiency[10]).toBe(30);
      expect(result.hourlyEfficiency[14]).toBe(60);
      expect(result.hourlyEfficiency[0]).toBe(0);
      expect(result.tagEfficiency["学习"].avgDuration).toBe(30);
      expect(result.tagEfficiency["学习"].completionRate).toBe(1);
      expect(result.tagEfficiency["工作"].avgDuration).toBe(60);
      expect(result.tagEfficiency["工作"].completionRate).toBe(0);
      expect(result.queueEfficiency[0].avgDuration).toBe(30);
      expect(result.queueEfficiency[0].completionRate).toBe(1);
      expect(result.queueEfficiency[1].avgDuration).toBe(60);
      expect(result.queueEfficiency[1].completionRate).toBe(0);
      expect(result.peakHours).toHaveLength(4);
      expect(result.peakHours).toContain(14);
      expect(result.peakHours).toContain(10);
      expect(result.lowHours).toHaveLength(4);
    });

    it("应该在无执行记录时返回全零小时效率", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      inner.from.mockReturnValueOnce(makeChain([]));

      const result = await taskRecommendationService.calculateEfficiencyData(supabase, "user-1");

      expect(result.hourlyEfficiency[10]).toBe(0);
      expect(result.tagEfficiency).toEqual({});
      expect(result.queueEfficiency).toEqual({});
    });
  });

  describe("getTaskRecommendations", () => {
    it("应该在数据库错误时返回空数组", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      inner.from.mockReturnValueOnce(makeChain(null, { message: "DB error" }));

      const result = await taskRecommendationService.getTaskRecommendations(supabase, "user-1");
      expect(result).toEqual([]);
    });

    it("应该返回按分数降序排列的推荐", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      const now = new Date("2024-06-01T10:00:00Z");

      const tasks = [
        buildTask({
          id: "low-task",
          priority: 1,
          queue_level: 2,
          deadline: undefined,
          status: "pending",
        }),
        buildTask({
          id: "high-task",
          priority: 3,
          queue_level: 0,
          deadline: new Date("2024-06-01T13:00:00Z").toISOString(),
          status: "pending",
        }),
      ];

      inner.from.mockReturnValueOnce(makeChain(tasks));
      inner.from.mockReturnValueOnce(makeChain([]));

      const result = await taskRecommendationService.getTaskRecommendations(supabase, "user-1", {
        currentTime: now,
      });

      expect(result).toHaveLength(2);
      expect(result[0].task.id).toBe("high-task");
      expect(result[1].task.id).toBe("low-task");
      expect(result[0].score).toBeGreaterThanOrEqual(result[1].score);
    });

    it("应该为高优先级队列 0 的任务生成推荐原因", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      const now = new Date("2024-06-01T10:00:00Z");

      const tasks = [
        buildTask({
          id: "q0-task",
          priority: 3,
          queue_level: 0,
          status: "pending",
          deadline: new Date("2024-06-01T20:00:00Z").toISOString(),
        }),
      ];

      inner.from.mockReturnValueOnce(makeChain(tasks));
      inner.from.mockReturnValueOnce(makeChain([]));

      const result = await taskRecommendationService.getTaskRecommendations(supabase, "user-1", {
        currentTime: now,
      });

      expect(result).toHaveLength(1);
      expect(result[0].reasons.length).toBeGreaterThan(0);
      expect(result[0].reasons).toContain("高优先级任务");
      expect(result[0].reasons).toContain("位于高优先级队列 Q0");
      expect(result[0].suggestedTimeSlot).toBeDefined();
    });
  });

  describe("checkTaskDependencies", () => {
    it("应该在数据库错误时返回 canStart 为 true", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      inner.from.mockReturnValueOnce(makeChain(null, { message: "DB error" }));

      const result = await taskRecommendationService.checkTaskDependencies(supabase, "task-1", "user-1");
      expect(result.canStart).toBe(true);
      expect(result.blockedBy).toEqual([]);
      expect(result.softBlockedBy).toEqual([]);
    });

    it("应该在存在未完成的 strict 依赖时返回 canStart 为 false", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      const dependencies = [
        {
          dependency_type: "strict",
          depends_on_task_id: "dep-1",
          user_tasks: { id: "dep-1", title: "前置任务", status: "pending" },
        },
      ];
      inner.from.mockReturnValueOnce(makeChain(dependencies));

      const result = await taskRecommendationService.checkTaskDependencies(supabase, "task-1", "user-1");
      expect(result.canStart).toBe(false);
      expect(result.blockedBy).toHaveLength(1);
      expect(result.blockedBy[0].id).toBe("dep-1");
      expect(result.blockedBy[0].title).toBe("前置任务");
    });

    it("应该在 strict 依赖已完成时返回 canStart 为 true", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      const dependencies = [
        {
          dependency_type: "strict",
          depends_on_task_id: "dep-1",
          user_tasks: { id: "dep-1", title: "已完成任务", status: "completed" },
        },
      ];
      inner.from.mockReturnValueOnce(makeChain(dependencies));

      const result = await taskRecommendationService.checkTaskDependencies(supabase, "task-1", "user-1");
      expect(result.canStart).toBe(true);
      expect(result.blockedBy).toEqual([]);
    });

    it("应该在存在未完成的 soft 依赖时加入 softBlockedBy 但 canStart 仍为 true", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      const dependencies = [
        {
          dependency_type: "soft",
          depends_on_task_id: "dep-2",
          user_tasks: { id: "dep-2", title: "建议任务", status: "pending" },
        },
      ];
      inner.from.mockReturnValueOnce(makeChain(dependencies));

      const result = await taskRecommendationService.checkTaskDependencies(supabase, "task-1", "user-1");
      expect(result.canStart).toBe(true);
      expect(result.softBlockedBy).toHaveLength(1);
      expect(result.softBlockedBy[0].id).toBe("dep-2");
    });
  });

  describe("getTaskById", () => {
    it("应该返回指定 ID 的任务", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      const task = buildTask({ id: "task-99", title: "查找的任务" });
      inner.from.mockReturnValueOnce(makeChain(task));

      const result = await taskRecommendationService.getTaskById(supabase, "task-99", "user-1");
      expect(result).not.toBeNull();
      expect(result?.id).toBe("task-99");
      expect(result?.title).toBe("查找的任务");
    });

    it("应该在任务不存在时返回 null", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      inner.from.mockReturnValueOnce(makeChain(null, { code: "PGRST116" }));

      const result = await taskRecommendationService.getTaskById(supabase, "nonexistent", "user-1");
      expect(result).toBeNull();
    });
  });
});
