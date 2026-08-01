// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSyncStatus } from "../useSyncStatus";
import {
  isLocalDbAvailable,
  getSyncStatus,
  onSyncStatusChanged,
} from "../../../services/api/localClient";
import type { SyncStatus } from "../../../../shared/types/ipc";

vi.mock("../../../services/api/localClient", () => ({
  isLocalDbAvailable: vi.fn(),
  getSyncStatus: vi.fn(),
  onSyncStatusChanged: vi.fn(),
  triggerSync: vi.fn(),
}));

const mockIsLocalDbAvailable = vi.mocked(isLocalDbAvailable);
const mockGetSyncStatus = vi.mocked(getSyncStatus);
const mockOnSyncStatusChanged = vi.mocked(onSyncStatusChanged);

describe("useSyncStatus", () => {
  const defaultSyncStatus: SyncStatus = {
    isRunning: false,
    isOnline: true,
    lastSyncAt: "2024-01-01T00:00:00Z",
    pendingPush: 0,
    pendingPull: 0,
    conflicts: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLocalDbAvailable.mockResolvedValue(true);
    mockGetSyncStatus.mockResolvedValue(defaultSyncStatus);
    mockOnSyncStatusChanged.mockReturnValue(vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("应该返回初始同步状态", async () => {
    const { result } = renderHook(() => useSyncStatus());

    // 等待异步的 isLocalDbAvailable 和 getSyncStatus 完成
    await vi.waitFor(() => {
      expect(result.current.isLocalAvailable).toBe(true);
    });

    expect(result.current.status).toEqual(defaultSyncStatus);
    expect(mockIsLocalDbAvailable).toHaveBeenCalled();
    expect(mockGetSyncStatus).toHaveBeenCalled();
  });

  it("当本地数据库不可用时，状态应为 null", async () => {
    mockIsLocalDbAvailable.mockResolvedValue(false);

    const { result } = renderHook(() => useSyncStatus());

    await vi.waitFor(() => {
      expect(result.current.isLocalAvailable).toBe(false);
    });

    expect(result.current.status).toBeNull();
    expect(mockGetSyncStatus).not.toHaveBeenCalled();
  });

  it("状态变更事件应更新返回的同步状态", async () => {
    let onStatusChangedCallback: ((status: unknown) => void) | null = null;
    mockOnSyncStatusChanged.mockImplementation((callback) => {
      onStatusChangedCallback = callback;
      return vi.fn();
    });

    const { result } = renderHook(() => useSyncStatus());

    // 等待初始状态加载完成
    await vi.waitFor(() => {
      expect(result.current.isLocalAvailable).toBe(true);
    });

    const newStatus: SyncStatus = {
      isRunning: true,
      isOnline: true,
      lastSyncAt: null,
      pendingPush: 5,
      pendingPull: 2,
      conflicts: 0,
    };

    act(() => {
      onStatusChangedCallback?.(newStatus);
    });

    expect(result.current.status).toEqual(newStatus);
  });

  it("卸载时应移除事件监听（清理订阅和定时器）", async () => {
    const unsubscribe = vi.fn();
    mockOnSyncStatusChanged.mockReturnValue(unsubscribe);

    const { unmount } = renderHook(() => useSyncStatus());

    // 等待异步操作完成后再卸载
    await vi.waitFor(() => {
      expect(mockOnSyncStatusChanged).toHaveBeenCalled();
    });

    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});