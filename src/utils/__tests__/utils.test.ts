import { describe, it, expect } from "vitest";
import { cn } from "../utils";

describe("cn", () => {
  it("组合多个字符串参数并用空格连接", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("过滤 falsy 值", () => {
    expect(cn("a", false, "b", null, undefined, 0, "c")).toBe("a b c");
  });

  it("支持条件对象类名", () => {
    expect(cn("a", { b: true })).toBe("a b");
    expect(cn("a", { b: false })).toBe("a");
  });

  it("无参数时返回空字符串", () => {
    expect(cn()).toBe("");
  });

  it("全部为 falsy 时返回空字符串", () => {
    expect(cn(false, null, undefined, 0, "")).toBe("");
  });

  it("通过 tailwind-merge 合并冲突类名", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});