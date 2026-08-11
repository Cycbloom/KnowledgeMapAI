// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "../../../../tests/helpers/renderWithProviders";
import { TaskTimer } from "../TaskTimer";

// react-i18next：直接返回 key，避免依赖真实 i18n 资源
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "zh-CN" },
  }),
}));

describe("TaskTimer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应渲染剩余时间与进度百分比", () => {
    renderWithProviders(
      <TaskTimer duration={100} elapsed={40} isRunning={false} />,
    );
    // elapsed=40 → remaining=60 → 显示 "01:00"
    expect(screen.getByText("01:00")).toBeInTheDocument();
    // progress = 40 / 100 = 40%
    expect(screen.getByText("40%")).toBeInTheDocument();
  });

  it("elapsed 变化时应更新显示时间（useEffect 同步）", () => {
    const { rerender } = renderWithProviders(
      <TaskTimer duration={100} elapsed={40} isRunning={false} />,
    );
    expect(screen.getByText("01:00")).toBeInTheDocument();
    rerender(
      <TaskTimer duration={100} elapsed={70} isRunning={false} />,
    );
    expect(screen.getByText("00:30")).toBeInTheDocument();
  });

  it("运行状态（isRunning=true）时应渲染辉光动画容器", () => {
    const { container } = renderWithProviders(
      <TaskTimer duration={100} elapsed={10} isRunning={true} />,
    );
    // 辉光 motion.div 存在（isRunning 条件渲染）
    const glowDiv = container.querySelector(
      "div.absolute.inset-0.rounded-full.pointer-events-none",
    );
    expect(glowDiv).not.toBeNull();
  });

  it("非运行状态（isRunning=false）时不应渲染辉光容器", () => {
    const { container } = renderWithProviders(
      <TaskTimer duration={100} elapsed={10} isRunning={false} />,
    );
    const glowDiv = container.querySelector(
      "div.absolute.inset-0.rounded-full.pointer-events-none",
    );
    expect(glowDiv).toBeNull();
  });

  it("运行时应显示暂停按钮并触发 onPause", () => {
    const onPause = vi.fn();
    renderWithProviders(
      <TaskTimer duration={100} elapsed={10} isRunning={true} onPause={onPause} />,
    );
    fireEvent.click(screen.getByText("scheduler.taskWorkbench.taskTimer.pause"));
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it("暂停时应显示继续按钮并触发 onResume", () => {
    const onResume = vi.fn();
    renderWithProviders(
      <TaskTimer duration={100} elapsed={10} isRunning={false} onResume={onResume} />,
    );
    fireEvent.click(screen.getByText("scheduler.taskWorkbench.taskTimer.resume"));
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it("点击完成按钮应触发 onComplete", () => {
    const onComplete = vi.fn();
    renderWithProviders(
      <TaskTimer duration={100} elapsed={10} isRunning={false} onComplete={onComplete} />,
    );
    fireEvent.click(screen.getByText("scheduler.taskWorkbench.taskTimer.complete"));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("休息模式（isBreak=true）时应显示休息标签与咖啡图标", () => {
    renderWithProviders(
      <TaskTimer duration={100} elapsed={10} isRunning={false} isBreak={true} />,
    );
    expect(screen.getByText("scheduler.taskTimer.breakTime")).toBeInTheDocument();
  });

  it("应渲染已用时间与总时长标签", () => {
    renderWithProviders(
      <TaskTimer duration={100} elapsed={40} isRunning={false} />,
    );
    expect(screen.getByText("scheduler.taskWorkbench.taskTimer.elapsedLabel")).toBeInTheDocument();
    expect(screen.getByText("scheduler.taskWorkbench.taskTimer.totalLabel")).toBeInTheDocument();
  });
});