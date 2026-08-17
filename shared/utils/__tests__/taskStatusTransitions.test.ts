import { describe, it, expect } from "vitest";
import {
  USER_TASK_TRANSITIONS,
  canTransition,
  getValidNextStatuses,
} from "../taskStatusTransitions";

describe("canTransition", () => {
  it("允许 pending → in_progress", () => {
    expect(canTransition("pending", "in_progress")).toBe(true);
  });

  it("允许 in_progress ⇄ paused 双向", () => {
    expect(canTransition("in_progress", "paused")).toBe(true);
    expect(canTransition("paused", "in_progress")).toBe(true);
  });

  it("允许 in_progress / paused → completed", () => {
    expect(canTransition("in_progress", "completed")).toBe(true);
    expect(canTransition("paused", "completed")).toBe(true);
  });

  it("禁止 pending 直达 completed（必须先开始）", () => {
    expect(canTransition("pending", "completed")).toBe(false);
  });

  it("禁止 pending → paused（未开始的任务不能暂停）", () => {
    expect(canTransition("pending", "paused")).toBe(false);
  });

  it("终态 completed 不允许任何转换", () => {
    expect(canTransition("completed", "in_progress")).toBe(false);
    expect(canTransition("completed", "paused")).toBe(false);
    expect(canTransition("completed", "pending")).toBe(false);
  });

  it("终态 cancelled 不允许任何转换", () => {
    expect(canTransition("cancelled", "in_progress")).toBe(false);
    expect(canTransition("cancelled", "completed")).toBe(false);
  });

  it("非法 from 状态返回 false 而非抛错", () => {
    expect(
      canTransition("unknown" as never, "in_progress"),
    ).toBe(false);
  });
});

describe("getValidNextStatuses", () => {
  it("pending 的后继为 in_progress / cancelled", () => {
    expect(getValidNextStatuses("pending")).toEqual([
      "in_progress",
      "cancelled",
    ]);
  });

  it("终态后继为空数组", () => {
    expect(getValidNextStatuses("completed")).toEqual([]);
    expect(getValidNextStatuses("cancelled")).toEqual([]);
  });
});

describe("USER_TASK_TRANSITIONS 表完整性", () => {
  it("覆盖全部 UserTaskStatus 值", () => {
    const expected = [
      "pending",
      "in_progress",
      "paused",
      "completed",
      "cancelled",
    ];
    expect(Object.keys(USER_TASK_TRANSITIONS).sort()).toEqual(
      [...expected].sort(),
    );
  });
});
