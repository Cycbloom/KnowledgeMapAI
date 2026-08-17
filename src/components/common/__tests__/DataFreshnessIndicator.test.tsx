// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { DataFreshnessIndicator } from "../DataFreshnessIndicator";
import { renderWithProviders } from "../../../../tests/helpers/renderWithProviders";
import { useDataFreshness } from "../../../hooks/common/useDataFreshness";
import { useNetworkStatus } from "../../../hooks/common/useNetworkStatus";

vi.mock("../../../hooks/common/useDataFreshness", () => ({
  useDataFreshness: vi.fn(),
}));

vi.mock("../../../hooks/common/useNetworkStatus", () => ({
  useNetworkStatus: vi.fn(),
}));

const mockUseDataFreshness = vi.mocked(useDataFreshness);
const mockUseNetworkStatus = vi.mocked(useNetworkStatus);

const mockRefresh = vi.fn();

describe("DataFreshnessIndicator", () => {
  const NOW = 1_700_000_000_000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    mockUseNetworkStatus.mockReturnValue({ isOnline: true } as ReturnType<
      typeof useNetworkStatus
    >);
    mockUseDataFreshness.mockReturnValue({
      lastUpdatedAt: NOW - 60_000, // 1 分钟前
      isFetching: false,
      refresh: mockRefresh,
    } as ReturnType<typeof useDataFreshness>);
  });

  afterEach(() => {
    vi.useRealTimers();
    mockRefresh.mockClear();
  });

  it("渲染最近更新时间（复用 timeAgo）", () => {
    renderWithProviders(<DataFreshnessIndicator />);
    expect(screen.getByText(/数据更新于/)).toBeVisible();
    expect(screen.getByText(/分钟前/)).toBeVisible();
  });

  it("无数据时显示「数据尚未更新」但仍保留刷新按钮", () => {
    mockUseDataFreshness.mockReturnValue({
      lastUpdatedAt: null,
      isFetching: false,
      refresh: mockRefresh,
    } as ReturnType<typeof useDataFreshness>);

    renderWithProviders(<DataFreshnessIndicator />);
    expect(screen.getByText(/数据尚未更新/)).toBeVisible();
    expect(screen.getByLabelText("刷新数据")).toBeVisible();
  });

  it("点击刷新按钮触发 refresh", () => {
    renderWithProviders(<DataFreshnessIndicator />);
    const button = screen.getByLabelText("刷新数据");
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it("isFetching 时图标旋转且按钮禁用", () => {
    mockUseDataFreshness.mockReturnValue({
      lastUpdatedAt: NOW - 60_000,
      isFetching: true,
      refresh: mockRefresh,
    } as ReturnType<typeof useDataFreshness>);

    renderWithProviders(<DataFreshnessIndicator />);
    const button = screen.getByLabelText("刷新数据");
    expect(button).toBeDisabled();
    const icon = button.querySelector("svg");
    expect(icon).toHaveClass("animate-spin");
  });

  it("离线时刷新按钮禁用", () => {
    mockUseNetworkStatus.mockReturnValue({ isOnline: false } as ReturnType<
      typeof useNetworkStatus
    >);

    renderWithProviders(<DataFreshnessIndicator />);
    const button = screen.getByLabelText("刷新数据");
    expect(button).toBeDisabled();
  });

  it("离线点击不触发 refresh（即使按钮可交互场景下也安全）", () => {
    mockUseNetworkStatus.mockReturnValue({ isOnline: false } as ReturnType<
      typeof useNetworkStatus
    >);

    renderWithProviders(<DataFreshnessIndicator />);
    const button = screen.getByLabelText("刷新数据");
    expect(button).toBeDisabled();
  });

  it("freshness 时间随时间推移更新（重新渲染使用最新 Date.now）", () => {
    mockUseDataFreshness.mockReturnValue({
      lastUpdatedAt: NOW - 5 * 60_000, // 5 分钟前
      isFetching: false,
      refresh: mockRefresh,
    } as ReturnType<typeof useDataFreshness>);

    const { rerender } = renderWithProviders(<DataFreshnessIndicator />);
    expect(screen.getByText(/5分钟前/)).toBeVisible();

    // 切换系统时间到 10 分钟后，重新渲染
    vi.setSystemTime(NOW + 10 * 60_000);
    rerender(<DataFreshnessIndicator />);
    expect(screen.getByText(/15分钟前/)).toBeVisible();
  });
});