// @vitest-environment jsdom
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { SaveButton } from "../SaveButton";

vi.mock("../../../utils/messageHelper", () => ({
  message: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

import { message } from "../../../utils/messageHelper";

// i18n 默认语言已在 src/setupTests.ts 全局设置为 zh-CN,无需在此重复调用。

describe("SaveButton", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("初始渲染时显示 idleLabel（保存）", () => {
    render(<SaveButton onSave={vi.fn()} />);
    expect(screen.getByText("保存")).toBeInTheDocument();
  });

  it("点击后调用 onSave", async () => {
    const onSave = vi.fn(() => Promise.resolve());
    render(<SaveButton onSave={onSave} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("onSave 成功：先显示 savingLabel，1.5s 内显示 savedLabel，1.5s 后回 idleLabel", async () => {
    vi.useFakeTimers();

    let resolveSave!: () => void;
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    render(<SaveButton onSave={onSave} />);

    const button = screen.getByRole("button");

    // 点击 → 进入 pending，显示 savingLabel
    await act(async () => {
      fireEvent.click(button);
    });
    expect(screen.getByText("保存中...")).toBeInTheDocument();

    // resolve → 进入 success，显示 savedLabel
    await act(async () => {
      resolveSave();
    });
    expect(screen.getByText("已保存")).toBeInTheDocument();

    // 推进 1.5s → 回 idle，显示 idleLabel
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByText("保存")).toBeInTheDocument();
  });

  it("onSave 失败：显示 error toast，按钮回 idleLabel", async () => {
    const onSave = vi.fn(() => Promise.reject(new Error("网络错误")));
    render(<SaveButton onSave={onSave} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    expect(message.error).toHaveBeenCalledWith("网络错误", undefined);
    expect(screen.getByText("保存")).toBeInTheDocument();
  });

  it("pending 态按钮 disabled", async () => {
    let resolveSave!: () => void;
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    render(<SaveButton onSave={onSave} />);

    const button = screen.getByRole("button");

    await act(async () => {
      fireEvent.click(button);
    });

    // pending 态：按钮 disabled
    expect(screen.getByText("保存中...")).toBeInTheDocument();
    expect(button).toBeDisabled();

    // resolve 后：按钮恢复可点击
    await act(async () => {
      resolveSave();
    });

    await waitFor(() => {
      expect(button).not.toBeDisabled();
    });
  });

  it("success 态按钮不 disabled（可点击）", async () => {
    let resolveSave!: () => void;
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    render(<SaveButton onSave={onSave} />);

    const button = screen.getByRole("button");

    await act(async () => {
      fireEvent.click(button);
    });

    await act(async () => {
      resolveSave();
    });

    // success 态：显示 savedLabel 且按钮可点击
    expect(screen.getByText("已保存")).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  it("透传 variant/size/fullWidth 等 props", () => {
    render(
      <SaveButton
        onSave={vi.fn()}
        variant="danger"
        size="lg"
        fullWidth
      />,
    );
    const button = screen.getByRole("button");
    expect(button.className).toContain("bg-red-600");
    expect(button.className).toContain("h-12");
    expect(button.className).toContain("w-full");
  });
});
