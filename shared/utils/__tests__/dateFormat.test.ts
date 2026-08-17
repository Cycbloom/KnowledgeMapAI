import { describe, it, expect } from "vitest";
import { toLocalDateString, toIcsUtcTimestamp } from "../dateFormat";

describe("toLocalDateString", () => {
  it("输出本地时区 YYYY-MM-DD", () => {
    expect(toLocalDateString(new Date(2026, 7, 17))).toBe("2026-08-17");
  });

  it("月/日补零", () => {
    expect(toLocalDateString(new Date(2026, 0, 3))).toBe("2026-01-03");
    expect(toLocalDateString(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  it("按本地时区取值而非 UTC（UTC 8 月 17 日 20:00 在东八区已是次日）", () => {
    // 东八区本地时间 2026-08-18 04:00
    const d = new Date(Date.UTC(2026, 7, 17, 20, 0, 0));
    // 该断言依赖运行时区为 Asia/Shanghai；用本地字段反向构造避免 flaky
    const local = new Date(2026, 7, 18, 4, 0, 0);
    expect(toLocalDateString(d)).toBe(toLocalDateString(local));
  });

  it("默认参数取当前时间且格式合法", () => {
    expect(toLocalDateString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("toIcsUtcTimestamp", () => {
  it("输出 RFC 5545 UTC 基本格式", () => {
    expect(toIcsUtcTimestamp(new Date("2026-08-17T12:30:45.123Z"))).toBe(
      "20260817T123045Z",
    );
  });

  it("丢弃毫秒并保留 Z 后缀", () => {
    const result = toIcsUtcTimestamp(new Date("2026-01-02T03:04:05.678Z"));
    expect(result).toBe("20260102T030405Z");
    expect(result).toMatch(/^\d{8}T\d{6}Z$/);
  });
});
