import { describe, it, expect } from "vitest";
import { canReuseNode } from "../nodeSpecificity";

describe("canReuseNode", () => {
  it("双方均为 specific 时可复用", () => {
    expect(canReuseNode("specific", "specific")).toBe(true);
  });

  it("新节点为 generic 时不可复用（即使已有节点 specific）", () => {
    expect(canReuseNode("generic", "specific")).toBe(false);
  });

  it("已有节点为 generic 时不可复用（即使新节点 specific）", () => {
    expect(canReuseNode("specific", "generic")).toBe(false);
  });

  it("双方均为 generic 时不可复用", () => {
    expect(canReuseNode("generic", "generic")).toBe(false);
  });

  it("无标注（undefined）视为可复用，兼容存量节点", () => {
    expect(canReuseNode(undefined, "specific")).toBe(true);
    expect(canReuseNode("specific", undefined)).toBe(true);
    expect(canReuseNode(undefined, undefined)).toBe(true);
  });
});
