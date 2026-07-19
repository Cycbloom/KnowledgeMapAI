// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  clearApiCache,
  prefetchUrls,
  getServiceWorkerStatus,
  updateServiceWorker,
  unregisterServiceWorker,
  unregisterLegacySW,
} from "../serviceWorker";

/**
 * 构造一个模拟的 ServiceWorkerRegistration。
 * 仅包含 serviceWorker.ts 中实际使用的字段：
 * - active / waiting / installing: ServiceWorker 对象（含 postMessage）
 * - unregister: 注销方法
 */
function createMockRegistration(options: {
  active?: { postMessage: ReturnType<typeof vi.fn> } | null;
  waiting?: { postMessage: ReturnType<typeof vi.fn> } | null;
  installing?: unknown;
  unregister?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    active: options.active ?? null,
    waiting: options.waiting ?? null,
    installing: options.installing ?? null,
    unregister: options.unregister ?? vi.fn().mockResolvedValue(true),
  };
}

/** 模拟 ServiceWorkerContainer 的最小接口 */
interface MockServiceWorkerContainer {
  getRegistration: ReturnType<typeof vi.fn>;
  getRegistrations: ReturnType<typeof vi.fn>;
  ready: Promise<unknown>;
  controller: unknown;
}

/** 模拟 CacheStorage 的最小接口 */
interface MockCacheStorage {
  keys: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
}

describe("serviceWorker utils", () => {
  let mockServiceWorker: MockServiceWorkerContainer;
  let mockCaches: MockCacheStorage;
  let reloadMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockServiceWorker = {
      getRegistration: vi.fn().mockResolvedValue(undefined),
      getRegistrations: vi.fn().mockResolvedValue([]),
      ready: Promise.resolve(null),
      controller: undefined,
    };
    mockCaches = {
      keys: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(true),
    };
    reloadMock = vi.fn();

    // 注入 navigator.serviceWorker mock
    Object.defineProperty(navigator, "serviceWorker", {
      value: mockServiceWorker,
      configurable: true,
      writable: true,
    });
    // 注入 window.caches mock
    Object.defineProperty(window, "caches", {
      value: mockCaches,
      configurable: true,
      writable: true,
    });
    // 注入 window.location.reload mock
    // 注意：jsdom 中 Location 实例的 reload 属性不可配置，
    // 因此整体替换 window.location 对象（保留原有可枚举属性）。
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      value: {
        ...originalLocation,
        reload: reloadMock,
      } as unknown as Location,
      configurable: true,
      writable: true,
    });
  });

  describe("getServiceWorkerStatus", () => {
    it("无注册时应该返回所有状态为 false", async () => {
      mockServiceWorker.getRegistration.mockResolvedValue(undefined);
      mockServiceWorker.controller = undefined;

      const status = await getServiceWorkerStatus();

      expect(status.registered).toBe(false);
      expect(status.active).toBe(false);
      expect(status.waiting).toBe(false);
      expect(status.controller).toBe(false);
      expect(mockServiceWorker.getRegistration).toHaveBeenCalledTimes(1);
    });

    it("有注册且含 active/waiting 时应该返回对应状态为 true", async () => {
      const waiting = { postMessage: vi.fn() };
      const active = { postMessage: vi.fn() };
      mockServiceWorker.getRegistration.mockResolvedValue(
        createMockRegistration({ active, waiting }),
      );
      mockServiceWorker.controller = { state: "activated" };

      const status = await getServiceWorkerStatus();

      expect(status.registered).toBe(true);
      expect(status.active).toBe(true);
      expect(status.waiting).toBe(true);
      expect(status.controller).toBe(true);
    });

    it("有注册但无 active/waiting 时 active/waiting 应为 false", async () => {
      mockServiceWorker.getRegistration.mockResolvedValue(
        createMockRegistration({ active: null, waiting: null }),
      );
      mockServiceWorker.controller = undefined;

      const status = await getServiceWorkerStatus();

      expect(status.registered).toBe(true);
      expect(status.active).toBe(false);
      expect(status.waiting).toBe(false);
      expect(status.controller).toBe(false);
    });
  });

  describe("updateServiceWorker", () => {
    it("应该向 waiting SW 发送 SKIP_WAITING 消息并 reload 页面", async () => {
      const waiting = { postMessage: vi.fn() };
      mockServiceWorker.getRegistration.mockResolvedValue(
        createMockRegistration({ waiting }),
      );

      await updateServiceWorker();

      expect(waiting.postMessage).toHaveBeenCalledWith({
        type: "SKIP_WAITING",
      });
      expect(reloadMock).toHaveBeenCalledTimes(1);
    });

    it("无 waiting SW 时也应调用 reload", async () => {
      mockServiceWorker.getRegistration.mockResolvedValue(
        createMockRegistration({ waiting: null }),
      );

      await updateServiceWorker();

      expect(reloadMock).toHaveBeenCalledTimes(1);
    });

    it("无注册时也应调用 reload", async () => {
      mockServiceWorker.getRegistration.mockResolvedValue(undefined);

      await updateServiceWorker();

      expect(reloadMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("unregisterServiceWorker", () => {
    it("应该注销所有注册并清空所有 Cache Storage", async () => {
      const reg1 = createMockRegistration();
      const reg2 = createMockRegistration();
      mockServiceWorker.getRegistrations.mockResolvedValue([reg1, reg2]);
      mockCaches.keys.mockResolvedValue(["cache-1", "cache-2"]);

      await unregisterServiceWorker();

      expect(reg1.unregister).toHaveBeenCalledTimes(1);
      expect(reg2.unregister).toHaveBeenCalledTimes(1);
      expect(mockCaches.keys).toHaveBeenCalledTimes(1);
      expect(mockCaches.delete).toHaveBeenCalledWith("cache-1");
      expect(mockCaches.delete).toHaveBeenCalledWith("cache-2");
      expect(mockCaches.delete).toHaveBeenCalledTimes(2);
    });

    it("无注册时也应清空 caches", async () => {
      mockServiceWorker.getRegistrations.mockResolvedValue([]);
      mockCaches.keys.mockResolvedValue(["only-cache"]);

      await unregisterServiceWorker();

      expect(mockCaches.delete).toHaveBeenCalledWith("only-cache");
    });
  });

  describe("unregisterLegacySW", () => {
    it("应该注销 /sw.js 并删除遗留缓存", async () => {
      const legacyReg = createMockRegistration();
      mockServiceWorker.getRegistration.mockResolvedValue(legacyReg);

      await unregisterLegacySW();

      expect(mockServiceWorker.getRegistration).toHaveBeenCalledWith("/sw.js");
      expect(legacyReg.unregister).toHaveBeenCalledTimes(1);
      expect(mockCaches.delete).toHaveBeenCalledWith("knowledge-map-v1");
      expect(mockCaches.delete).toHaveBeenCalledWith("knowledge-map-static-v1");
      expect(mockCaches.delete).toHaveBeenCalledWith("workbox-precache-v2-/");
      // 三个遗留缓存都应被删除
      expect(mockCaches.delete).toHaveBeenCalledTimes(3);
    });

    it("无遗留 SW 时不应抛错但仍应清理遗留缓存", async () => {
      mockServiceWorker.getRegistration.mockResolvedValue(undefined);

      await unregisterLegacySW();

      expect(mockServiceWorker.getRegistration).toHaveBeenCalledWith("/sw.js");
      expect(mockCaches.delete).toHaveBeenCalledWith("knowledge-map-v1");
      expect(mockCaches.delete).toHaveBeenCalledWith("knowledge-map-static-v1");
      expect(mockCaches.delete).toHaveBeenCalledWith("workbox-precache-v2-/");
    });
  });

  describe("clearApiCache", () => {
    it("应该只删除包含 api 或 supabase 的缓存", async () => {
      mockCaches.keys.mockResolvedValue([
        "api-cache",
        "supabase-rest-cache",
        "other-cache",
      ]);

      await clearApiCache();

      expect(mockCaches.delete).toHaveBeenCalledWith("api-cache");
      expect(mockCaches.delete).toHaveBeenCalledWith("supabase-rest-cache");
      expect(mockCaches.delete).not.toHaveBeenCalledWith("other-cache");
      expect(mockCaches.delete).toHaveBeenCalledTimes(2);
    });

    it("无匹配缓存时不应调用 delete", async () => {
      mockCaches.keys.mockResolvedValue(["fonts-cache", "images-cache"]);

      await clearApiCache();

      expect(mockCaches.delete).not.toHaveBeenCalled();
    });

    it("空缓存列表时不应调用 delete", async () => {
      mockCaches.keys.mockResolvedValue([]);

      await clearApiCache();

      expect(mockCaches.delete).not.toHaveBeenCalled();
    });

    it("同时匹配 api 与 supabase 关键字时都应删除", async () => {
      mockCaches.keys.mockResolvedValue([
        "api-supabase-cache",
        "supabase-only",
        "api-only",
      ]);

      await clearApiCache();

      expect(mockCaches.delete).toHaveBeenCalledWith("api-supabase-cache");
      expect(mockCaches.delete).toHaveBeenCalledWith("supabase-only");
      expect(mockCaches.delete).toHaveBeenCalledWith("api-only");
      expect(mockCaches.delete).toHaveBeenCalledTimes(3);
    });
  });

  describe("prefetchUrls", () => {
    it("应该向 active SW 发送 PREFETCH 消息", async () => {
      const postMessage = vi.fn();
      const registration = createMockRegistration({
        active: { postMessage },
      });
      mockServiceWorker.ready = Promise.resolve(registration);

      await prefetchUrls(["url1", "url2"]);

      expect(postMessage).toHaveBeenCalledWith({
        type: "PREFETCH",
        urls: ["url1", "url2"],
      });
    });

    it("应该去重并过滤空字符串", async () => {
      const postMessage = vi.fn();
      const registration = createMockRegistration({
        active: { postMessage },
      });
      mockServiceWorker.ready = Promise.resolve(registration);

      await prefetchUrls(["url1", "url1", "", "url2", ""]);

      expect(postMessage).toHaveBeenCalledWith({
        type: "PREFETCH",
        urls: ["url1", "url2"],
      });
    });

    it("空 URL 列表不应发送消息", async () => {
      const postMessage = vi.fn();
      const registration = createMockRegistration({
        active: { postMessage },
      });
      mockServiceWorker.ready = Promise.resolve(registration);

      await prefetchUrls([]);

      expect(postMessage).not.toHaveBeenCalled();
    });

    it("仅含空字符串的列表不应发送消息", async () => {
      const postMessage = vi.fn();
      const registration = createMockRegistration({
        active: { postMessage },
      });
      mockServiceWorker.ready = Promise.resolve(registration);

      await prefetchUrls(["", ""]);

      expect(postMessage).not.toHaveBeenCalled();
    });

    it("无 active SW 时不应抛错", async () => {
      const registration = createMockRegistration({ active: null });
      mockServiceWorker.ready = Promise.resolve(registration);

      // 不抛错即通过
      await prefetchUrls(["url1"]);
    });
  });
});
