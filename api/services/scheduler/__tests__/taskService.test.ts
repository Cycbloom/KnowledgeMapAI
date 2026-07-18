import { describe, it, expect, beforeEach, vi } from "vitest";
import { taskService } from "../taskService";
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
    title: "test task",
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

describe("TaskService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  describe("createTask", () => {
    it("应该成功创建任务并计算下一个位置", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;

      // 第一次 from() 调用：获取 max position
      inner.from.mockReturnValueOnce(makeChain({ position: 5 }));
      // 第二次 from() 调用：插入任务
      const createdTask = buildTask({ id: "new-task", position: 6, title: "新任务" });
      inner.from.mockReturnValueOnce(makeChain(createdTask));

      const result = await taskService.createTask(supabase, "user-1", {
        title: "新任务",
        priority: 1,
      });

      expect(result.id).toBe("new-task");
      expect(result.position).toBe(6);
      expect(inner.from).toHaveBeenCalledWith("user_tasks");
    });

    it("应该在无已有任务时从位置 0 开始", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;

      inner.from.mockReturnValueOnce(makeChain(null));
      const createdTask = buildTask({ id: "new-task", position: 0 });
      inner.from.mockReturnValueOnce(makeChain(createdTask));

      const result = await taskService.createTask(supabase, "user-1", {
        title: "第一个任务",
      });

      expect(result.position).toBe(0);
    });

    it("应该在数据库插入错误时抛出异常", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;

      inner.from.mockReturnValueOnce(makeChain({ position: 0 }));
      inner.from.mockReturnValueOnce(makeChain(null, { message: "Insert failed" }));

      await expect(
        taskService.createTask(supabase, "user-1", { title: "任务" }),
      ).rejects.toThrow();
    });
  });

  describe("getTask", () => {
    it("应该返回指定 ID 的任务", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      const task = buildTask({ id: "task-99", title: "查找任务" });
      inner.from.mockReturnValueOnce(makeChain(task));

      const result = await taskService.getTask(supabase, "task-99", "user-1");
      expect(result).not.toBeNull();
      expect(result?.id).toBe("task-99");
      expect(result?.title).toBe("查找任务");
    });

    it("应该在任务不存在时返回 null", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      inner.from.mockReturnValueOnce(makeChain(null, { code: "PGRST116" }));

      const result = await taskService.getTask(supabase, "nonexistent", "user-1");
      expect(result).toBeNull();
    });

    it("应该在数据库错误时抛出异常", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      inner.from.mockReturnValueOnce(makeChain(null, { code: "OTHER_ERROR", message: "DB error" }));

      await expect(
        taskService.getTask(supabase, "task-1", "user-1"),
      ).rejects.toThrow();
    });
  });
  describe("getTaskStatus", () => {
    it("应该返回任务状态", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      inner.from.mockReturnValueOnce(makeChain({ status: "in_progress" }));

      const result = await taskService.getTaskStatus(supabase, "task-1", "user-1");
      expect(result).toBe("in_progress");
    });

    it("应该在任务不存在时返回 null", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      inner.from.mockReturnValueOnce(makeChain(null, { code: "PGRST116" }));

      const result = await taskService.getTaskStatus(supabase, "nonexistent", "user-1");
      expect(result).toBeNull();
    });
  });

  describe("getTasksByQueue", () => {
    it("应该返回指定队列的任务列表", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      const tasks = [
        buildTask({ id: "t1", queue_level: 0, position: 0 }),
        buildTask({ id: "t2", queue_level: 0, position: 1 }),
      ];
      inner.from.mockReturnValueOnce(makeChain(tasks));

      const result = await taskService.getTasksByQueue(supabase, "user-1", 0);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("t1");
      expect(result[1].id).toBe("t2");
    });

    it("应该在队列为空时返回空数组", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      inner.from.mockReturnValueOnce(makeChain([]));

      const result = await taskService.getTasksByQueue(supabase, "user-1", 2);
      expect(result).toEqual([]);
    });

    it("应该在数据库错误时抛出异常", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      inner.from.mockReturnValueOnce(makeChain(null, { message: "DB error" }));

      await expect(
        taskService.getTasksByQueue(supabase, "user-1", 0),
      ).rejects.toThrow();
    });
  });

  describe("deleteTask", () => {
    it("应该成功软删除任务", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      inner.from.mockReturnValueOnce(makeChain(null));

      await taskService.deleteTask(supabase, "task-1", "user-1");
      expect(inner.from).toHaveBeenCalledWith("user_tasks");
    });

    it("应该在数据库错误时抛出异常", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      inner.from.mockReturnValueOnce(makeChain(null, { message: "Delete failed" }));

      await expect(
        taskService.deleteTask(supabase, "task-1", "user-1"),
      ).rejects.toThrow();
    });
  });
  describe("pauseTask", () => {
    it("应该成功暂停任务并返回更新后的任务", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      const pausedTask = buildTask({ id: "task-1", status: "paused" });
      inner.from.mockReturnValueOnce(makeChain(pausedTask));

      const result = await taskService.pauseTask(supabase, "task-1", "user-1");
      expect(result.status).toBe("paused");
    });

    it("应该在数据库错误时抛出异常", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      inner.from.mockReturnValueOnce(makeChain(null, { message: "Update failed" }));

      await expect(
        taskService.pauseTask(supabase, "task-1", "user-1"),
      ).rejects.toThrow();
    });
  });

  describe("updateTask", () => {
    it("应该成功更新任务并返回更新后的任务", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      const updatedTask = buildTask({ id: "task-1", title: "更新后的标题" });
      inner.from.mockReturnValueOnce(makeChain(updatedTask));

      const result = await taskService.updateTask(supabase, "task-1", "user-1", {
        title: "更新后的标题",
      });
      expect(result.title).toBe("更新后的标题");
    });

    it("应该在任务不存在时抛出异常", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      inner.from.mockReturnValueOnce(makeChain(null, null));

      await expect(
        taskService.updateTask(supabase, "task-1", "user-1", { title: "新标题" }),
      ).rejects.toThrow();
    });

    it("应该在数据库错误时抛出异常", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      inner.from.mockReturnValueOnce(makeChain(null, { message: "Update failed" }));

      await expect(
        taskService.updateTask(supabase, "task-1", "user-1", { title: "新标题" }),
      ).rejects.toThrow();
    });
  });

  describe("getTimeSlice", () => {
    it("应该在无任务设置时返回默认值 25 分钟（1500 秒）", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      inner.from.mockReturnValueOnce(makeChain(null, { code: "PGRST116" }));

      const result = await taskService.getTimeSlice(supabase, "user-1", 0);
      expect(result).toBe(25 * 60);
    });

    it("应该在有任务设置时返回对应队列的时间切片", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      const settings = {
        q0_time_slice: 1800,
        q1_time_slice: 3600,
        q2_time_slice: 7200,
      };
      inner.from.mockReturnValueOnce(makeChain(settings));

      const result = await taskService.getTimeSlice(supabase, "user-1", 1);
      expect(result).toBe(3600);
    });

    it("应该在队列为 2 时返回 q2_time_slice", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      const settings = {
        q0_time_slice: 1800,
        q1_time_slice: 3600,
        q2_time_slice: 7200,
      };
      inner.from.mockReturnValueOnce(makeChain(settings));

      const result = await taskService.getTimeSlice(supabase, "user-1", 2);
      expect(result).toBe(7200);
    });
  });
  describe("moveTaskToQueue", () => {
    it("应该成功移动任务到目标队列并计算下一个位置", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;

      // 第一次 from() 调用：获取目标队列的 max position
      inner.from.mockReturnValueOnce(makeChain({ position: 3 }));
      // 第二次 from() 调用：更新任务
      const movedTask = buildTask({ id: "task-1", queue_level: 1, position: 4 });
      inner.from.mockReturnValueOnce(makeChain(movedTask));

      const result = await taskService.moveTaskToQueue(supabase, "task-1", "user-1", 1);
      expect(result.queue_level).toBe(1);
      expect(result.position).toBe(4);
    });

    it("应该在目标队列为空时从位置 0 开始", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;

      inner.from.mockReturnValueOnce(makeChain(null));
      const movedTask = buildTask({ id: "task-1", queue_level: 2, position: 0 });
      inner.from.mockReturnValueOnce(makeChain(movedTask));

      const result = await taskService.moveTaskToQueue(supabase, "task-1", "user-1", 2);
      expect(result.position).toBe(0);
    });

    it("应该在数据库更新错误时抛出异常", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;

      inner.from.mockReturnValueOnce(makeChain({ position: 0 }));
      inner.from.mockReturnValueOnce(makeChain(null, { message: "Update failed" }));

      await expect(
        taskService.moveTaskToQueue(supabase, "task-1", "user-1", 1),
      ).rejects.toThrow();
    });
  });

  describe("demoteTask", () => {
    it("应该将队列 0 的任务降级到队列 1", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;

      // 第一次 from() 调用：获取任务当前队列
      inner.from.mockReturnValueOnce(makeChain({ queue_level: 0 }));
      // moveTaskToQueue 内部的两次 from() 调用
      inner.from.mockReturnValueOnce(makeChain({ position: 2 }));
      const demotedTask = buildTask({ id: "task-1", queue_level: 1, position: 3 });
      inner.from.mockReturnValueOnce(makeChain(demotedTask));

      const result = await taskService.demoteTask(supabase, "task-1", "user-1");
      expect(result.queue_level).toBe(1);
    });

    it("应该将队列 2 的任务保持在队列 2（最大值）", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;

      inner.from.mockReturnValueOnce(makeChain({ queue_level: 2 }));
      inner.from.mockReturnValueOnce(makeChain({ position: 5 }));
      const demotedTask = buildTask({ id: "task-1", queue_level: 2, position: 6 });
      inner.from.mockReturnValueOnce(makeChain(demotedTask));

      const result = await taskService.demoteTask(supabase, "task-1", "user-1");
      expect(result.queue_level).toBe(2);
    });

    it("应该在任务不存在时抛出异常", async () => {
      const supabase = createMockSupabase();
      const inner = supabase as unknown as MockSupabaseClient;
      inner.from.mockReturnValueOnce(makeChain(null, { code: "PGRST116" }));

      await expect(
        taskService.demoteTask(supabase, "task-1", "user-1"),
      ).rejects.toThrow();
    });
  });
});
