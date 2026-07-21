import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock frontendEventBus：替换为 vi.fn() 以断言 publish 调用
vi.mock("../../services/timer/FrontendEventBus", () => {
  const publish = vi.fn();
  return {
    frontendEventBus: { publish },
    FrontendEventBus: vi.fn(),
  };
});

import { message } from "../messageHelper";
import { frontendEventBus } from "../../services/timer/FrontendEventBus";

const publishMock = frontendEventBus.publish as unknown as ReturnType<
  typeof vi.fn
>;

describe("messageHelper", () => {
  beforeEach(() => {
    publishMock.mockClear();
  });

  it("message.success('x') 返回字符串 id", () => {
    const id = message.success("x");
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
    expect(publishMock).toHaveBeenCalledTimes(1);
    expect(publishMock).toHaveBeenCalledWith("message_show", {
      id,
      type: "success",
      content: "x",
      duration: 3000,
      action: undefined,
    });
  });

  it("message.success('x', { id: 'custom' }) 返回 'custom'", () => {
    const id = message.success("x", { id: "custom" });
    expect(id).toBe("custom");
    expect(publishMock).toHaveBeenCalledWith("message_show", {
      id: "custom",
      type: "success",
      content: "x",
      duration: 3000,
      action: undefined,
    });
  });

  it("message.loading('x') 默认使用 Infinity duration", () => {
    const id = message.loading("x");
    expect(typeof id).toBe("string");
    expect(publishMock).toHaveBeenCalledWith("message_show", {
      id,
      type: "loading",
      content: "x",
      duration: Infinity,
      action: undefined,
    });
  });

  it("message.dismiss('id') 发布 message_dismiss 事件", () => {
    message.dismiss("id");
    expect(publishMock).toHaveBeenCalledWith("message_dismiss", { id: "id" });
    expect(publishMock).not.toHaveBeenCalledWith(
      "message_dismiss_all",
      expect.anything(),
    );
  });

  it("message.dismiss() 发布 message_dismiss_all 事件", () => {
    message.dismiss();
    expect(publishMock).toHaveBeenCalledWith("message_dismiss_all", {});
    expect(publishMock).not.toHaveBeenCalledWith(
      "message_dismiss",
      expect.anything(),
    );
  });

  it("message.error('x', { duration: 0 }) 发布 duration: 0", () => {
    const id = message.error("x", { duration: 0 });
    expect(typeof id).toBe("string");
    expect(publishMock).toHaveBeenCalledWith("message_show", {
      id,
      type: "error",
      content: "x",
      duration: 0,
      action: undefined,
    });
  });

  it("message.warning/info 默认 duration 正确", () => {
    message.warning("w");
    message.info("i");
    expect(publishMock).toHaveBeenNthCalledWith(1, "message_show", {
      id: expect.any(String),
      type: "warning",
      content: "w",
      duration: 4000,
      action: undefined,
    });
    expect(publishMock).toHaveBeenNthCalledWith(2, "message_show", {
      id: expect.any(String),
      type: "info",
      content: "i",
      duration: 3000,
      action: undefined,
    });
  });

  it("传入 action 时被透传到 payload", () => {
    const action = { label: "撤销", onClick: () => {} };
    message.success("done", { action });
    expect(publishMock).toHaveBeenCalledWith("message_show", {
      id: expect.any(String),
      type: "success",
      content: "done",
      duration: 3000,
      action,
    });
  });

  it("loading 显式 duration 覆盖默认 Infinity", () => {
    message.loading("loading...", { duration: 5000 });
    expect(publishMock).toHaveBeenCalledWith("message_show", {
      id: expect.any(String),
      type: "loading",
      content: "loading...",
      duration: 5000,
      action: undefined,
    });
  });
});
