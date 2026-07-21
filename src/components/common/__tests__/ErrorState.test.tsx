// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { SVGProps } from "react";
import { ErrorState } from "../ErrorState";

// Mock lucide-react 图标：附加 data-testid 以便语义化查询，同时透传 className 用于断言
vi.mock("lucide-react", () => ({
  AlertCircle: (props: SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-alert" {...props} />
  ),
  XCircle: (props: SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-error" {...props} />
  ),
  AlertTriangle: (props: SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-warning" {...props} />
  ),
}));

describe("ErrorState", () => {
  it("默认渲染应该显示 AlertCircle 图标 + 默认 title + message + 重试按钮", () => {
    render(
      <ErrorState message="网络异常" onRetry={vi.fn()} />,
    );
    expect(screen.getByTestId("icon-alert")).toBeInTheDocument();
    expect(screen.getByText("加载失败")).toBeInTheDocument();
    expect(screen.getByText("网络异常")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "重试" }),
    ).toBeInTheDocument();
  });

  it("无 onRetry 时应该不显示重试按钮", () => {
    render(<ErrorState message="网络异常" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("variant='inline' 应该不显示 title 且容器 className 含 flex-row", () => {
    const { container } = render(
      <ErrorState message="网络异常" variant="inline" />,
    );
    // 不显示默认 title
    expect(screen.queryByText("加载失败")).not.toBeInTheDocument();
    // 仍显示 message
    expect(screen.getByText("网络异常")).toBeInTheDocument();
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass("flex-row");
    expect(root).not.toHaveClass("flex-col");
  });

  it("variant='panel' 应该垂直排列（flex-col）并使用中间距 gap-3", () => {
    const { container } = render(
      <ErrorState message="网络异常" variant="panel" />,
    );
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass("flex-col", "gap-3");
  });

  it("自定义 title 应该覆盖默认 title 文案", () => {
    render(<ErrorState title="自定义错误" message="网络异常" />);
    expect(screen.getByText("自定义错误")).toBeInTheDocument();
    expect(screen.queryByText("加载失败")).not.toBeInTheDocument();
  });

  it("icon='warning' 应该渲染 AlertTriangle 而非 AlertCircle", () => {
    render(<ErrorState icon="warning" message="网络异常" />);
    expect(screen.getByTestId("icon-warning")).toBeInTheDocument();
    expect(screen.queryByTestId("icon-alert")).not.toBeInTheDocument();
  });

  it("icon='error' 应该渲染 XCircle", () => {
    render(<ErrorState icon="error" message="网络异常" />);
    expect(screen.getByTestId("icon-error")).toBeInTheDocument();
    expect(screen.queryByTestId("icon-alert")).not.toBeInTheDocument();
  });

  it("自定义 retryLabel 应该覆盖默认按钮文案", () => {
    render(
      <ErrorState
        message="网络异常"
        onRetry={vi.fn()}
        retryLabel="重新加载"
      />,
    );
    expect(
      screen.getByRole("button", { name: "重新加载" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重试" })).not.toBeInTheDocument();
  });

  it("根容器应该含 role='alert'", () => {
    render(<ErrorState message="网络异常" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("点击重试按钮应该调用 onRetry 回调", () => {
    const onRetry = vi.fn();
    render(<ErrorState message="网络异常" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("size='sm' 时图标应该为 h-8 w-8，title 应该为 text-sm，message 应该为 text-xs", () => {
    render(
      <ErrorState title="失败" message="网络异常" size="sm" />,
    );
    const icon = screen.getByTestId("icon-alert");
    expect(icon).toHaveClass("h-8", "w-8");
    const title = screen.getByText("失败");
    expect(title).toHaveClass("text-sm");
    const message = screen.getByText("网络异常");
    expect(message).toHaveClass("text-xs");
  });

  it("size='lg' 时图标应该为 h-16 w-16，title 应该为 text-lg，message 应该为 text-base", () => {
    render(
      <ErrorState title="失败" message="网络异常" size="lg" />,
    );
    const icon = screen.getByTestId("icon-alert");
    expect(icon).toHaveClass("h-16", "w-16");
    const title = screen.getByText("失败");
    expect(title).toHaveClass("text-lg");
    const message = screen.getByText("网络异常");
    expect(message).toHaveClass("text-base");
  });

  it("传入 className 应该与默认 className 合并", () => {
    const { container } = render(
      <ErrorState message="网络异常" className="custom-class mt-4" />,
    );
    const root = container.firstChild as HTMLElement;
    // 默认 page variant 类仍然存在
    expect(root).toHaveClass("flex-col", "py-12", "px-4", "gap-4");
    // 自定义类已合并
    expect(root).toHaveClass("custom-class", "mt-4");
  });
});
