// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { TaskRuntimeProgress } from "@shared/types/common";
import { TaskProgressBar } from "../TaskProgressBar";

describe("TaskProgressBar", () => {
  it("progress 为 undefined 时应该返回 null", () => {
    const { container } = render(<TaskProgressBar progress={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it("完整进度展示应该显示百分比进度条、阶段文案、已完成计数与当前项", () => {
    const progress: TaskRuntimeProgress = {
      stage: "generating",
      stageLabel: "生成题目中",
      percent: 40,
      completed: 20,
      total: 50,
      current: "节点A",
    };
    render(<TaskProgressBar progress={progress} />);

    // 进度条 role 存在，aria-valuenow 为 40
    const bar = screen.getByRole("progressbar");
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveAttribute("aria-valuenow", "40");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");

    // 填充层存在（确定模式）
    expect(
      screen.getByTestId("task-progress-bar-fill"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("task-progress-bar-indeterminate"),
    ).not.toBeInTheDocument();

    // 状态文本：阶段 · 已完成 X/Y
    expect(
      screen.getByText("生成题目中 · 已完成 20/50"),
    ).toBeInTheDocument();

    // 当前项文本
    expect(screen.getByText("当前：节点A")).toBeInTheDocument();
  });

  it("仅 stageLabel 无 percent 时应该渲染 indeterminate 模式并显示阶段文案", () => {
    const progress: TaskRuntimeProgress = {
      stage: "init",
      stageLabel: "初始化中",
    };
    render(<TaskProgressBar progress={progress} />);

    const bar = screen.getByRole("progressbar");
    expect(bar).toBeInTheDocument();
    // indeterminate 模式不应设置 aria-valuenow
    expect(bar).not.toHaveAttribute("aria-valuenow");

    // indeterminate 层存在
    expect(
      screen.getByTestId("task-progress-bar-indeterminate"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("task-progress-bar-fill"),
    ).not.toBeInTheDocument();

    // 阶段文案显示
    expect(screen.getByText("初始化中")).toBeInTheDocument();

    // 不应显示"已完成 X/Y"
    expect(screen.queryByText(/已完成/)).not.toBeInTheDocument();
  });

  it("仅 percent 无 completed/total 时应该只显示进度条不显示状态文本", () => {
    const progress: TaskRuntimeProgress = { percent: 60 };
    render(<TaskProgressBar progress={progress} />);

    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "60");

    // 确定模式填充层存在
    expect(
      screen.getByTestId("task-progress-bar-fill"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("task-progress-bar-indeterminate"),
    ).not.toBeInTheDocument();

    // 不应有状态文本与当前项文本
    expect(
      screen.queryByTestId("task-progress-status"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("task-progress-current"),
    ).not.toBeInTheDocument();
  });

  it("应该正确合并传入的 className", () => {
    const progress: TaskRuntimeProgress = { percent: 50 };
    const { container } = render(
      <TaskProgressBar progress={progress} className="custom-class" />,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.classList.contains("custom-class")).toBe(true);
  });

  it("暗色模式应该包含 dark: 前缀的 Tailwind 类", () => {
    const progress: TaskRuntimeProgress = {
      stageLabel: "生成中",
      percent: 30,
      completed: 3,
      total: 10,
      current: "节点X",
    };
    const { container } = render(<TaskProgressBar progress={progress} />);
    const root = container.firstChild as HTMLElement;
    const html = root.outerHTML;
    // 至少覆盖轨道、填充、文本三层 dark: 类
    expect(html).toMatch(/dark:bg-slate-700/);
    expect(html).toMatch(/dark:bg-primary-400/);
    expect(html).toMatch(/dark:text-slate-400/);
  });

  it("percent 超出 0-100 范围时应该被 clamp 到合法范围", () => {
    const progressOver: TaskRuntimeProgress = { percent: 150 };
    const { rerender } = render(<TaskProgressBar progress={progressOver} />);
    const barOver = screen.getByRole("progressbar");
    expect(barOver).toHaveAttribute("aria-valuenow", "100");
    const fillOver = screen.getByTestId("task-progress-bar-fill");
    expect((fillOver as HTMLElement).style.width).toBe("100%");

    const progressUnder: TaskRuntimeProgress = { percent: -20 };
    rerender(<TaskProgressBar progress={progressUnder} />);
    const barUnder = screen.getByRole("progressbar");
    expect(barUnder).toHaveAttribute("aria-valuenow", "0");
    const fillUnder = screen.getByTestId("task-progress-bar-fill");
    expect((fillUnder as HTMLElement).style.width).toBe("0%");
  });

  it("仅有 stageLabel 和 current 无 percent 时应该显示 indeterminate 与当前项", () => {
    const progress: TaskRuntimeProgress = {
      stage: "loading",
      stageLabel: "加载中",
      current: "资源B",
    };
    render(<TaskProgressBar progress={progress} />);

    // indeterminate 模式
    expect(
      screen.getByTestId("task-progress-bar-indeterminate"),
    ).toBeInTheDocument();

    // 阶段文案 + 当前项
    expect(screen.getByText("加载中")).toBeInTheDocument();
    expect(screen.getByText("当前：资源B")).toBeInTheDocument();

    // 不应有 X/Y 计数
    expect(screen.queryByText(/已完成/)).not.toBeInTheDocument();
  });
});
