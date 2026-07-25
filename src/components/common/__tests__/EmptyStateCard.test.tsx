// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { SVGProps } from "react";
import { EmptyStateCard } from "../EmptyStateCard";

// Mock lucide-react 图标：附加 data-testid 以便语义化查询，同时透传 className 用于断言
vi.mock("lucide-react", () => ({
  FileX: (props: SVGProps<SVGSVGElement>) => (
    <svg data-testid="illustration-empty" {...props} />
  ),
  SearchX: (props: SVGProps<SVGSVGElement>) => (
    <svg data-testid="illustration-search" {...props} />
  ),
  AlertCircle: (props: SVGProps<SVGSVGElement>) => (
    <svg data-testid="illustration-error" {...props} />
  ),
  Database: (props: SVGProps<SVGSVGElement>) => (
    <svg data-testid="illustration-no-data" {...props} />
  ),
}));

describe("EmptyStateCard", () => {
  it("外层包裹应该含 dashed border、rounded-lg、bg-white、dark:bg-slate-800 等样式类", () => {
    const { container } = render(<EmptyStateCard title="test" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass(
      "border-dashed",
      "border-gray-300",
      "dark:border-slate-500",
      "rounded-lg",
      "bg-white",
      "dark:bg-slate-800",
      "border",
    );
  });

  it("应该透传 title 与 description 给内部 EmptyState 渲染文案", () => {
    render(
      <EmptyStateCard title="暂无图谱" description="点击下方按钮创建一个" />,
    );
    expect(screen.getByText("暂无图谱")).toBeInTheDocument();
    expect(screen.getByText("点击下方按钮创建一个")).toBeInTheDocument();
  });

  it("应该透传 action 给内部 EmptyState，按钮可渲染并可点击触发回调", () => {
    const onClick = vi.fn();
    render(
      <EmptyStateCard
        title="test"
        action={{ label: "新建", onClick }}
      />,
    );
    const button = screen.getByRole("button", { name: "新建" });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("应该透传 size 与 iconWrapper 给内部 EmptyState（图标 className 含 w-8 h-8、wrapper 含 rounded-full p-3）", () => {
    render(<EmptyStateCard title="test" size="sm" iconWrapper />);
    const icon = screen.getByTestId("illustration-empty");
    expect(icon).toHaveClass("w-8", "h-8");
    const wrapper = screen.getByTestId("empty-state-icon-wrapper");
    expect(wrapper).toHaveClass("rounded-full", "p-3", "bg-gray-100");
  });

  it("外层包裹应该包含 dark: 前缀的 Tailwind 暗色模式类", () => {
    const { container } = render(<EmptyStateCard title="test" />);
    const wrapper = container.firstChild as HTMLElement;
    const html = wrapper.outerHTML;
    expect(html).toMatch(/dark:bg-slate-800/);
    expect(html).toMatch(/dark:border-slate-500/);
  });

  it("不传任何可选字段时应该仅渲染外层包裹 + 内层 EmptyState 默认行为（默认 illustration=empty、size=md、iconWrapper=false）", () => {
    const { container } = render(<EmptyStateCard title="仅标题" />);
    // 外层包裹存在
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("border-dashed", "rounded-lg");
    // 内层 EmptyState 默认 illustration='empty' 渲染 FileX 图标
    expect(screen.getByTestId("illustration-empty")).toBeInTheDocument();
    // 默认 size='md'，图标 className 含 w-12 h-12
    expect(screen.getByTestId("illustration-empty")).toHaveClass("w-12", "h-12");
    // 默认 iconWrapper=false，无外层包裹 div
    expect(screen.queryByTestId("empty-state-icon-wrapper")).not.toBeInTheDocument();
    // title 正常渲染
    expect(screen.getByText("仅标题")).toBeInTheDocument();
    // 无 actions 容器
    expect(screen.queryByTestId("empty-state-actions")).not.toBeInTheDocument();
  });
});
