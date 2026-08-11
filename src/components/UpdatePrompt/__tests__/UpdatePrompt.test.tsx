// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { UpdatePrompt } from "../UpdatePrompt";
import { swMockState } from "../../../../tests/__mocks__/virtualPwaRegisterReact";

const messageMock = vi.hoisted(() => ({
  info: vi.fn(),
  dismiss: vi.fn(),
}));

vi.mock("../../../utils/messageHelper", () => ({
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

beforeEach(() => {
  swMockState.needRefresh = true;
  swMockState.updateServiceWorker = vi.fn().mockResolvedValue(undefined);
});

afterEach(() => {
  swMockState.needRefresh = false;
  vi.clearAllMocks();
});

describe("UpdatePrompt", () => {
  it("should call message.info when needRefresh is true", async () => {
    render(<UpdatePrompt />);

    await waitFor(() => {
      expect(messageMock.info).toHaveBeenCalledTimes(1);
    });
  });
});