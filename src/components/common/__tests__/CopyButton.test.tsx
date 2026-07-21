// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import type { SVGProps } from "react";
import { CopyButton } from "../CopyButton";

// Mock lucide-react 图标：附加 data-testid 以便语义化查询
vi.mock("lucide-react", () => ({
  Copy: (props: SVGProps<SVGSVGElement>) => (
    <svg data-testid="copy-icon" {...props} />
  ),
  Check: (props: SVGProps<SVGSVGElement>) => (
    <svg data-testid="check-icon" {...props} />
  ),
}));

// Mock message helper 以 spy success/error 调用
const messageSpy = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/utils/messageHelper", () => ({
  message: {
    success: messageSpy.success,
    error: messageSpy.error,
  },
}));

describe("CopyButton", () => {
  const writeText = vi.fn();
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    writeText.mockReset();
    messageSpy.success.mockClear();
    messageSpy.error.mockClear();

    // Stub navigator.clipboard（jsdom 默认不实现 Clipboard API）
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    // 抑制失败路径中的 console.error 输出
    consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    consoleErrorSpy.mockRestore();
  });

  it("初始渲染应该显示 Copy icon", () => {
    render(<CopyButton text="hello" />);
    expect(screen.getByTestId("copy-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("check-icon")).not.toBeInTheDocument();
  });

  it("点击后应该调用 navigator.clipboard.writeText 并传入 text", async () => {
    writeText.mockResolvedValue(undefined);
    render(<CopyButton text="hello" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("成功后应该显示 Check icon 并在 2 秒后回 Copy icon", async () => {
    writeText.mockResolvedValue(undefined);
    render(<CopyButton text="hello" />);

    // 初始显示 Copy
    expect(screen.getByTestId("copy-icon")).toBeInTheDocument();

    // 点击后显示 Check + message.success
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId("check-icon")).toBeInTheDocument();
    expect(messageSpy.success).toHaveBeenCalledWith("已复制");

    // 1999ms 时仍显示 Check（未满 2000ms）
    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(screen.getByTestId("check-icon")).toBeInTheDocument();

    // 再推进 1ms（共 2000ms）应回 Copy
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByTestId("copy-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("check-icon")).not.toBeInTheDocument();
  });

  it("失败后应该显示 message.error 且 icon 保持 Copy", async () => {
    writeText.mockRejectedValue(new Error("clipboard denied"));
    render(<CopyButton text="hello" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(messageSpy.error).toHaveBeenCalledWith("复制失败");
    expect(screen.getByTestId("copy-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("check-icon")).not.toBeInTheDocument();
  });
});
