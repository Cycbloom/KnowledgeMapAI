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
vi.mock("../../../utils/messageHelper", () => ({
  message: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { message } from "../../../utils/messageHelper";

describe("CopyButton", () => {
  const writeText = vi.fn();
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    writeText.mockReset();
    message.success.mockClear();
    message.error.mockClear();

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
    consoleErrorSpy.mockRestore();
    vi.useRealTimers();
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
    });
    await act(async () => {});

    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("成功后应该显示 Check icon 并在 2 秒后回 Copy icon", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });

    let resolveWriteText!: () => void;
    writeText.mockImplementation(
      () => new Promise<void>((resolve) => { resolveWriteText = resolve; }),
    );
    render(<CopyButton text="hello" />);

    // 初始显示 Copy
    expect(screen.getByTestId("copy-icon")).toBeInTheDocument();

    // 点击 → 进入 pending，手动 resolve writeText
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    // resolve writeText → run 内部调用 succeed() → 显示 Check icon + message.success
    await act(async () => {
      resolveWriteText();
    });
    expect(screen.getByTestId("check-icon")).toBeInTheDocument();
    expect(message.success).toHaveBeenCalledWith("已复制");

    // 1999ms 时仍显示 Check（未满 2000ms）
    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(screen.getByTestId("check-icon")).toBeInTheDocument();

    // 再推进 1ms（共 2000ms）应回 Copy
    act(() => {
      vi.advanceTimersByTime(1);
    });
    // 额外 flush 一次，确保 setTimeout 中的 setState('idle') 已生效
    await act(async () => {});
    expect(screen.getByTestId("copy-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("check-icon")).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it("失败后应该显示 message.error 且 icon 保持 Copy", async () => {
    let rejectWriteText!: (reason: Error) => void;
    writeText.mockImplementation(
      () => new Promise<void>((_resolve, reject) => { rejectWriteText = reject; }),
    );
    render(<CopyButton text="hello" />);

    // 点击 → 进入 pending
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    // reject writeText → run 内部调用 fail() → catch 块调用 message.error
    await act(async () => {
      rejectWriteText(new Error("clipboard denied"));
    });
    expect(message.error).toHaveBeenCalledWith("复制失败");
    expect(screen.getByTestId("copy-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("check-icon")).not.toBeInTheDocument();
  });
});