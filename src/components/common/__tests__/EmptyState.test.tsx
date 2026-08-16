// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { SVGProps } from "react";
import { EmptyState } from "../EmptyState";

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
  Compass: (props: SVGProps<SVGSVGElement>) => (
    <svg data-testid="illustration-guide" {...props} />
  ),
  X: (props: SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-close" {...props} />
  ),
}));

describe("EmptyState", () => {
  it("默认 props 渲染应该不报错并显示 title 与默认 illustration 图标", () => {
    render(<EmptyState title="暂无数据" />);
    expect(screen.getByText("暂无数据")).toBeInTheDocument();
    expect(screen.getByTestId("illustration-empty")).toBeInTheDocument();
  });

  it("size='sm' 时图标 className 应该含 w-8 和 h-8", () => {
    render(<EmptyState title="test" size="sm" />);
    const icon = screen.getByTestId("illustration-empty");
    expect(icon).toHaveClass("w-8", "h-8");
  });

  it("size='md' 时图标 className 应该含 w-12 和 h-12", () => {
    render(<EmptyState title="test" size="md" />);
    const icon = screen.getByTestId("illustration-empty");
    expect(icon).toHaveClass("w-12", "h-12");
  });

  it("size='lg' 时图标 className 应该含 w-16 和 h-16", () => {
    render(<EmptyState title="test" size="lg" />);
    const icon = screen.getByTestId("illustration-empty");
    expect(icon).toHaveClass("w-16", "h-16");
  });

  it("size 默认值应该为 md（图标含 w-12 h-12）", () => {
    render(<EmptyState title="test" />);
    const icon = screen.getByTestId("illustration-empty");
    expect(icon).toHaveClass("w-12", "h-12");
  });

  it("iconWrapper=true 时图标外包 div 应该含 rounded-full 和 bg-gray-100", () => {
    render(<EmptyState title="test" iconWrapper />);
    const wrapper = screen.getByTestId("empty-state-icon-wrapper");
    expect(wrapper).toHaveClass("rounded-full", "bg-gray-100");
  });

  it("iconWrapper=true 配合 size='sm' 时外层 padding 应该为 p-3", () => {
    render(<EmptyState title="test" iconWrapper size="sm" />);
    const wrapper = screen.getByTestId("empty-state-icon-wrapper");
    expect(wrapper).toHaveClass("p-3");
  });

  it("iconWrapper=true 配合 size='lg' 时外层 padding 应该为 p-6", () => {
    render(<EmptyState title="test" iconWrapper size="lg" />);
    const wrapper = screen.getByTestId("empty-state-icon-wrapper");
    expect(wrapper).toHaveClass("p-6");
  });

  it("iconWrapper=false（默认）时应该无外层包裹 div", () => {
    render(<EmptyState title="test" />);
    expect(screen.queryByTestId("empty-state-icon-wrapper")).not.toBeInTheDocument();
  });

  it("secondaryAction 应该渲染为 Ghost Button（bg-transparent + border）", () => {
    render(
      <EmptyState
        title="test"
        secondaryAction={{ label: "取消", onClick: vi.fn() }}
      />,
    );
    const button = screen.getByRole("button", { name: "取消" });
    expect(button).toHaveClass("bg-transparent");
    expect(button).toHaveClass("border");
  });

  it("action + secondaryAction 同时存在时两个按钮应该在 flex 容器中横向排列", () => {
    render(
      <EmptyState
        title="test"
        action={{ label: "确定", onClick: vi.fn() }}
        secondaryAction={{ label: "取消", onClick: vi.fn() }}
      />,
    );
    const actionsContainer = screen.getByTestId("empty-state-actions");
    expect(actionsContainer).toHaveClass("flex", "gap-3", "flex-wrap");
    expect(screen.getByRole("button", { name: "确定" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "取消" })).toBeInTheDocument();
  });

  it("variant='page'（默认）容器 className 应该含 min-h-[200px] 和 py-12", () => {
    const { container } = render(<EmptyState title="test" variant="page" />);
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass("min-h-[200px]", "py-12");
  });

  it("variant 默认值应该为 page（含 min-h-[200px] 和 py-12）", () => {
    const { container } = render(<EmptyState title="test" />);
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass("min-h-[200px]", "py-12");
  });

  it("variant='panel' 容器 className 应该含 min-h-[120px] 和 py-8", () => {
    const { container } = render(<EmptyState title="test" variant="panel" />);
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass("min-h-[120px]", "py-8");
  });

  it("variant='inline' 容器 className 应该含 min-h-[80px] 和 py-4", () => {
    const { container } = render(<EmptyState title="test" variant="inline" />);
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveClass("min-h-[80px]", "py-4");
  });

  it("暗色模式应该包含 dark: 前缀的 Tailwind 类", () => {
    const { container } = render(<EmptyState title="test" iconWrapper />);
    const html = container.innerHTML;
    // 至少覆盖图标背景、标题文本、图标颜色三层 dark: 类
    expect(html).toMatch(/dark:bg-slate-800/);
    expect(html).toMatch(/dark:text-gray-100/);
    expect(html).toMatch(/dark:text-gray-500/);
  });

  it("illustration='guide' 应该渲染 guide 图标", () => {
    render(<EmptyState title="test" illustration="guide" />);
    expect(screen.getByTestId("illustration-guide")).toBeInTheDocument();
  });

  it("dismissible 时渲染关闭按钮且点击触发 onDismiss", () => {
    const onDismiss = vi.fn();
    render(<EmptyState title="test" dismissible onDismiss={onDismiss} />);
    const closeButton = screen.getByRole("button", { name: "关闭提示" });
    expect(closeButton).toBeInTheDocument();
    fireEvent.click(closeButton);
    expect(onDismiss).toHaveBeenCalled();
  });

  it("dismissible=false（默认）时不渲染关闭按钮", () => {
    render(<EmptyState title="test" />);
    expect(screen.queryByRole("button", { name: "关闭提示" })).toBeNull();
  });

  it("acknowledge 渲染按钮且点击触发回调", () => {
    const onClick = vi.fn();
    render(
      <EmptyState title="test" acknowledge={{ label: "开始上手", onClick }} />,
    );
    const button = screen.getByRole("button", { name: "开始上手" });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalled();
  });
});
