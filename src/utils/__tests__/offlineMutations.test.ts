import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import {
  offlineMutationQueue,
  OfflineError,
  type QueuedMutation,
} from "../offlineMutations";

/**
 * 刷新异步任务队列：fake-indexeddb 通过 queueMicrotask 调度 IDB 事件回调，
 * notifyListeners 内部走 getAllItems().then(...) 微任务链。
 * setTimeout(0) 是宏任务，可确保上述所有微任务全部执行完毕。
 */
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** 通过公共 API 清空队列，保证每个测试起始状态一致 */
async function clearQueue(): Promise<void> {
  const pending = await offlineMutationQueue.getPending();
  await Promise.all(
    pending.map((item) => offlineMutationQueue.dequeue(item.id)),
  );
  await flushMicrotasks();
}

/** 创建 mock QueryClient，控制 mutation.execute 的行为 */
function createMockQueryClient(
  executeImpl: (variables: unknown) => Promise<unknown>,
): { queryClient: QueryClient; mutation: { execute: ReturnType<typeof vi.fn> } } {
  const mutation = {
    execute: vi.fn((variables: unknown) => executeImpl(variables)),
  };
  const mutationCache = {
    build: vi.fn(() => mutation),
  };
  const queryClient = {
    getMutationCache: vi.fn(() => mutationCache),
  };
  return {
    // replay 仅用到 getMutationCache().build().execute()，此处构造结构兼容的 mock。
    // 非访问内部实现，仅为公共 replay API 提供受控依赖。
    queryClient: queryClient as unknown as QueryClient,
    mutation,
  };
}

describe("offlineMutations", () => {
  // 跟踪所有 subscribe 注册的 unsubscribe 函数，防止测试失败时 listener 泄漏到后续测试
  const subscriptions: Array<() => void> = [];

  beforeEach(async () => {
    await clearQueue();
  });

  afterEach(() => {
    while (subscriptions.length > 0) {
      const unsubscribe = subscriptions.pop();
      unsubscribe();
    }
  });

  describe("OfflineError 类", () => {
    it("应该正确设置 name 和默认 message", () => {
      const error = new OfflineError();
      expect(error.name).toBe("OfflineError");
      expect(error.message).toBe("Mutation queued offline");
    });

    it("应该是 Error 和 OfflineError 的实例", () => {
      const error = new OfflineError();
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(OfflineError);
    });

    it("应该接受自定义 message 且保持 name 为 OfflineError", () => {
      const error = new OfflineError("custom offline message");
      expect(error.message).toBe("custom offline message");
      expect(error.name).toBe("OfflineError");
    });
  });

  describe("enqueue", () => {
    it("应该返回非空字符串 ID 并将项入队，字段正确", async () => {
      const before = Date.now();
      const id = await offlineMutationQueue.enqueue({
        mutationKey: ["graphs", "create"],
        variables: { name: "test graph" },
        context: undefined,
        meta: { source: "test" },
      });
      const after = Date.now();

      expect(id).toEqual(expect.any(String));
      expect(id.length).toBeGreaterThan(0);

      const pending = await offlineMutationQueue.getPending();
      expect(pending).toHaveLength(1);

      const item = pending[0];
      expect(item.id).toBe(id);
      expect(item.mutationKey).toEqual(["graphs", "create"]);
      expect(item.variables).toEqual({ name: "test graph" });
      expect(item.context).toBeUndefined();
      expect(item.meta).toEqual({ source: "test" });
      expect(item.retryCount).toBe(0);
      expect(item.timestamp).toBeGreaterThanOrEqual(before);
      expect(item.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe("dequeue", () => {
    it("应该从队列中移除指定 ID 的项", async () => {
      const id = await offlineMutationQueue.enqueue({
        mutationKey: ["test"],
        variables: {},
        context: undefined,
        meta: undefined,
      });

      await offlineMutationQueue.dequeue(id);

      const pending = await offlineMutationQueue.getPending();
      expect(pending).toHaveLength(0);
    });
  });

  describe("getPending", () => {
    it("应该按 timestamp 升序返回所有待重放项", async () => {
      const id1 = await offlineMutationQueue.enqueue({
        mutationKey: ["test", 1],
        variables: {},
        context: undefined,
        meta: undefined,
      });
      await new Promise((resolve) => setTimeout(resolve, 5));
      const id2 = await offlineMutationQueue.enqueue({
        mutationKey: ["test", 2],
        variables: {},
        context: undefined,
        meta: undefined,
      });
      await new Promise((resolve) => setTimeout(resolve, 5));
      const id3 = await offlineMutationQueue.enqueue({
        mutationKey: ["test", 3],
        variables: {},
        context: undefined,
        meta: undefined,
      });

      const pending = await offlineMutationQueue.getPending();
      expect(pending).toHaveLength(3);
      expect(pending[0].id).toBe(id1);
      expect(pending[1].id).toBe(id2);
      expect(pending[2].id).toBe(id3);
      expect(pending[0].timestamp).toBeLessThanOrEqual(pending[1].timestamp);
      expect(pending[1].timestamp).toBeLessThanOrEqual(pending[2].timestamp);
    });

    it("空队列应该返回空数组", async () => {
      const pending = await offlineMutationQueue.getPending();
      expect(pending).toEqual([]);
    });
  });

  describe("subscribe", () => {
    it("应该在订阅时立即触发一次并传入当前队列快照", async () => {
      const listener = vi.fn();
      const unsubscribe = offlineMutationQueue.subscribe(listener);
      subscriptions.push(unsubscribe);

      await flushMicrotasks();

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenLastCalledWith([]);

      unsubscribe();
      // afterEach 也会调用 unsubscribe，但 listeners.delete 是幂等的
    });

    it("应该在 enqueue 时通知 listener 并传入最新队列", async () => {
      const listener = vi.fn();
      const unsubscribe = offlineMutationQueue.subscribe(listener);
      subscriptions.push(unsubscribe);

      await flushMicrotasks();
      listener.mockClear();

      await offlineMutationQueue.enqueue({
        mutationKey: ["test"],
        variables: { foo: "bar" },
        context: undefined,
        meta: undefined,
      });
      await flushMicrotasks();

      expect(listener).toHaveBeenCalled();
      const lastCall = listener.mock.calls[listener.mock.calls.length - 1];
      const queue = lastCall[0] as QueuedMutation[];
      expect(queue).toHaveLength(1);
      expect(queue[0].variables).toEqual({ foo: "bar" });
    });

    it("应该在 unsubscribe 后不再通知 listener", async () => {
      const listener = vi.fn();
      const unsubscribe = offlineMutationQueue.subscribe(listener);

      await flushMicrotasks();
      listener.mockClear();

      unsubscribe();
      // 从 subscriptions 移除，避免 afterEach 重复调用
      const idx = subscriptions.indexOf(unsubscribe);
      if (idx >= 0) subscriptions.splice(idx, 1);

      await offlineMutationQueue.enqueue({
        mutationKey: ["test"],
        variables: {},
        context: undefined,
        meta: undefined,
      });
      await flushMicrotasks();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("replay", () => {
    it("成功执行的 mutation 应该被 dequeue", async () => {
      const { queryClient, mutation } = createMockQueryClient(
        async () => "success",
      );

      await offlineMutationQueue.enqueue({
        mutationKey: ["test", "success"],
        variables: { foo: "bar" },
        context: undefined,
        meta: undefined,
      });

      await offlineMutationQueue.replay(queryClient);

      const pending = await offlineMutationQueue.getPending();
      expect(pending).toHaveLength(0);
      expect(mutation.execute).toHaveBeenCalledWith({ foo: "bar" });
    });

    it("网络错误时 mutation 应该保留在队列并增加 retryCount", async () => {
      const networkError = new TypeError("Failed to fetch");
      const { queryClient } = createMockQueryClient(async () => {
        throw networkError;
      });

      const id = await offlineMutationQueue.enqueue({
        mutationKey: ["test", "network-error"],
        variables: {},
        context: undefined,
        meta: undefined,
      });

      await offlineMutationQueue.replay(queryClient);

      const pending = await offlineMutationQueue.getPending();
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe(id);
      expect(pending[0].retryCount).toBe(1);
      expect(pending[0].lastError).toBe("Failed to fetch");
    });

    it("非网络错误重试到 MAX_RETRY_COUNT 后应该 dequeue", async () => {
      const serverError = new Error("Internal Server Error");
      const { queryClient } = createMockQueryClient(async () => {
        throw serverError;
      });

      const id = await offlineMutationQueue.enqueue({
        mutationKey: ["test", "server-error"],
        variables: {},
        context: undefined,
        meta: undefined,
      });

      // 第 1 次 replay：retryCount 0 -> 1（保留）
      await offlineMutationQueue.replay(queryClient);
      let pending = await offlineMutationQueue.getPending();
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe(id);
      expect(pending[0].retryCount).toBe(1);
      expect(pending[0].lastError).toBe("Internal Server Error");

      // 第 2 次 replay：retryCount 1 -> 2（保留）
      await offlineMutationQueue.replay(queryClient);
      pending = await offlineMutationQueue.getPending();
      expect(pending).toHaveLength(1);
      expect(pending[0].retryCount).toBe(2);

      // 第 3 次 replay：retryCount 2 -> 3（>= MAX_RETRY_COUNT，dequeue）
      await offlineMutationQueue.replay(queryClient);
      pending = await offlineMutationQueue.getPending();
      expect(pending).toHaveLength(0);
    });
  });
});
