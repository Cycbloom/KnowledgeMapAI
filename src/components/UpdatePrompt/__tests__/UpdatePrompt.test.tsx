// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { UpdatePrompt } from "../UpdatePrompt";

// 共享 mock 状态：通过 vi.hoisted 确保 vi.mock 工厂可访问
const swState = vi.hoisted(() => ({
  needRefresh: false,
  updateServiceWorker: vi.fn().mockResolvedValue(undefined),
}));

// message helper mock：spy info/dismiss 调用
const messageMock = vi.hoisted(() => ({
  info: vi.fn(),
  dismiss: vi.fn(),
}));

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({
    needRefresh: [swState.needRefresh, vi.fn()],
    updateServiceWorker: swState.updateServiceWorker,
  }),
}));

vi.mock("@/utils/messageHelper", () => ({
  message: {
    info: messageMock.info,
    dismiss: messageMock.dismiss,
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "zh-CN" },
  }),
}));

describe("UpdatePrompt", () => {
  beforeEach(() => {
    swState.needRefresh = false;
    swState.updateServiceWorker = vi.fn().mockResolvedValue(undefined);
    messageMock.info.mockClear();
    messageMock.dismiss.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("应该 needRefresh 为 false 时不调用 message.info", () => {
    swState.needRefresh = false;

    render(<UpdatePrompt />);

    expect(messageMock.info).not.toHaveBeenCalled();
  });

  it("应该 needRefresh 为 true 时调用 message.info 并传入新版本可用文本与 id", () => {
    swState.needRefresh = true;

    render(<UpdatePrompt />);

    expect(messageMock.info).toHaveBeenCalledTimes(1);
    expect(messageMock.info).toHaveBeenCalledWith(
      "toast.update.newVersionAvailable",
      expect.objectContaining({
        id: "sw-update",
        duration: Infinity,
        action: expect.objectContaining({
          label: "toast.update.refreshNow",
        }),
      }),
    );
  });

  it("应该 action.onClick 调用 updateServiceWorker(true)", () => {
    swState.needRefresh = true;

    render(<UpdatePrompt />);

    expect(messageMock.info).toHaveBeenCalledTimes(1);
    const options = messageMock.info.mock.calls[0][1] as {
      action: { onClick: () => void };
    };
    options.action.onClick();

    expect(swState.updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it("应该卸载时调用 message.dismiss('sw-update')", () => {
    swState.needRefresh = true;

    const { unmount } = render(<UpdatePrompt />);
    expect(messageMock.dismiss).not.toHaveBeenCalledWith("sw-update");

    unmount();

    expect(messageMock.dismiss).toHaveBeenCalledWith("sw-update");
  });
});
