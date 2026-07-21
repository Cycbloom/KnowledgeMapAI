// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { SVGProps } from "react";
import { RetryButton } from "../RetryButton";

// Mock lucide-react Loader2：附加 data-testid 以便语义化查询，同时透传 className 用于断言
vi.mock("lucide-react", () => ({
  Loader2: (props: SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-loader" {...props} />
  ),
}));

// i18n 默认语言已在 src/setupTests.ts 全局设置为 zh-CN,无需在此重复调用。

describe("RetryButton", () => {
  it("默认 primary variant：按钮 className 含 bg-primary-600", () => {
    render(<RetryButton onClick={vi.fn()} />);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("bg-primary-600");
  });

  it("ghost variant：按钮 className 含 text-primary-600", () => {
    render(<RetryButton onClick={vi.fn()} variant="ghost" />);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("text-primary-600");
  });

  it("danger variant：按钮 className 含 bg-red-600", () => {
    render(<RetryButton onClick={vi.fn()} variant="danger" />);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("bg-red-600");
  });

  it("isLoading=true：渲染 Loader2、按钮 disabled、aria-busy=true", () => {
    render(<RetryButton onClick={vi.fn()} isLoading />);
    const button = screen.getByRole("button");
    expect(screen.getByTestId("icon-loader")).toBeInTheDocument();
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("isLoading=true 时 Loader2 含 animate-spin class", () => {
    render(<RetryButton onClick={vi.fn()} isLoading />);
    const loader = screen.getByTestId("icon-loader");
    expect(loader).toHaveClass("animate-spin");
  });

  it("自定义 label：按钮文案变化", () => {
    render(<RetryButton onClick={vi.fn()} label="重新加载" />);
    expect(
      screen.getByRole("button", { name: "重新加载" }),
    ).toBeInTheDocument();
  });

  it("默认 label：按钮文案为 '重试'（i18n form.error.retry）", () => {
    render(<RetryButton onClick={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "重试" }),
    ).toBeInTheDocument();
  });

  it("点击调用 onClick", () => {
    const onClick = vi.fn();
    render(<RetryButton onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("size='sm'：className 含 px-3 py-1.5 text-xs", () => {
    render(<RetryButton onClick={vi.fn()} size="sm" />);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("px-3", "py-1.5", "text-xs");
  });

  it("size='lg'：className 含 px-5 py-2.5 text-base", () => {
    render(<RetryButton onClick={vi.fn()} size="lg" />);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("px-5", "py-2.5", "text-base");
  });

  it("默认 size='md'：className 含 px-4 py-2 text-sm", () => {
    render(<RetryButton onClick={vi.fn()} />);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("px-4", "py-2", "text-sm");
  });

  it("className 合并：传入 className 与默认 className 合并", () => {
    render(
      <RetryButton onClick={vi.fn()} className="custom-class mt-4" />,
    );
    const button = screen.getByRole("button");
    // 默认 primary variant 类仍然存在
    expect(button).toHaveClass("bg-primary-600");
    // 自定义类已合并
    expect(button).toHaveClass("custom-class", "mt-4");
  });

  it("isLoading=true 点击不触发 onClick", () => {
    const onClick = vi.fn();
    render(<RetryButton onClick={onClick} isLoading />);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("base 样式含 inline-flex / items-center / gap-2 / rounded-lg / font-medium", () => {
    render(<RetryButton onClick={vi.fn()} />);
    const button = screen.getByRole("button");
    expect(button).toHaveClass(
      "inline-flex",
      "items-center",
      "gap-2",
      "rounded-lg",
      "font-medium",
      "transition-colors",
      "disabled:opacity-50",
      "disabled:cursor-not-allowed",
    );
  });
});
