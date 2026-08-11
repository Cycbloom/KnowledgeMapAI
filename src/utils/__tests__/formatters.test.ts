import { describe, it, expect } from "vitest";
import {
  formatDuration,
  formatDurationMinutes,
  formatDurationMs,
  formatTimeFromSeconds,
  formatIsoDuration,
  formatNumber,
  formatDate,
} from "../formatters";

describe("formatDuration", () => {
  it("秒数小于 60 时按分钟向下取整返回 0 分钟", () => {
    expect(formatDuration(30)).toBe("0分钟");
  });

  it("60 秒格式化为 1 分钟", () => {
    expect(formatDuration(60)).toBe("1分钟");
  });

  it("3600 秒格式化为 1 小时", () => {
    expect(formatDuration(3600)).toBe("1小时");
  });

  it("5400 秒格式化为 1 小时 30 分钟", () => {
    expect(formatDuration(5400)).toBe("1 小时 30 分钟");
  });

  it("3661 秒格式化为 1 小时 1 分钟", () => {
    expect(formatDuration(3661)).toBe("1 小时 1 分钟");
  });

  it("0 / undefined / null 返回默认 emptyText '--'", () => {
    expect(formatDuration(0)).toBe("--");
    expect(formatDuration(undefined)).toBe("--");
    expect(formatDuration(null)).toBe("--");
  });

  it("自定义 emptyText 生效", () => {
    expect(formatDuration(0, { emptyText: "" })).toBe("");
    expect(formatDuration(undefined, { emptyText: "0h" })).toBe("0h");
  });

  it("compact 格式输出 h/m", () => {
    expect(formatDuration(3600, { format: "compact" })).toBe("1h 0m");
    expect(formatDuration(5400, { format: "compact" })).toBe("1h 30m");
    expect(formatDuration(1800, { format: "compact" })).toBe("30m");
  });

  it("zh-spaced 格式与 zh 保持源码一致的最小分支", () => {
    expect(formatDuration(60, { format: "zh-spaced" })).toBe("1分钟");
    expect(formatDuration(5400, { format: "zh-spaced" })).toBe("1 小时 30 分钟");
  });

  it("round 选项使用 Math.round 计算分钟", () => {
    expect(formatDuration(30, { round: true })).toBe("1分钟");
    expect(formatDuration(30)).toBe("0分钟");
  });
});

describe("formatDurationMinutes", () => {
  it("30 分钟格式化为 30 分钟", () => {
    expect(formatDurationMinutes(30)).toBe("30分钟");
  });

  it("60 分钟格式化为 1 小时", () => {
    expect(formatDurationMinutes(60)).toBe("1小时");
  });

  it("90 分钟格式化为 1 小时 30 分钟", () => {
    expect(formatDurationMinutes(90)).toBe("1 小时 30 分钟");
  });

  it("0 / undefined / null 返回默认 emptyText '--'", () => {
    expect(formatDurationMinutes(0)).toBe("--");
    expect(formatDurationMinutes(undefined)).toBe("--");
    expect(formatDurationMinutes(null)).toBe("--");
  });

  it("自定义 emptyText 生效", () => {
    expect(formatDurationMinutes(0, { emptyText: "0h" })).toBe("0h");
  });

  it("compact 格式输出 h/m", () => {
    expect(formatDurationMinutes(90, { format: "compact" })).toBe("1h 30m");
    expect(formatDurationMinutes(60, { format: "compact" })).toBe("1h 0m");
    expect(formatDurationMinutes(45, { format: "compact" })).toBe("45m");
  });

  it("zh-spaced 格式输出带空格", () => {
    expect(formatDurationMinutes(90, { format: "zh-spaced" })).toBe("1 小时 30 分钟");
  });
});

describe("formatDurationMs", () => {
  it("小于 1000ms 输出 ms", () => {
    expect(formatDurationMs(500)).toBe("500ms");
    expect(formatDurationMs(999)).toBe("999ms");
  });

  it("1000ms 到 60000ms 输出带一位小数的秒", () => {
    expect(formatDurationMs(1000)).toBe("1.0s");
    expect(formatDurationMs(1500)).toBe("1.5s");
  });

  it("大于等于 60000ms 输出带一位小数的分钟", () => {
    expect(formatDurationMs(60000)).toBe("1.0min");
    expect(formatDurationMs(90000)).toBe("1.5min");
  });
});

describe("formatTimeFromSeconds", () => {
  it("0 秒输出 00:00", () => {
    expect(formatTimeFromSeconds(0)).toBe("00:00");
  });

  it("65 秒输出 01:05", () => {
    expect(formatTimeFromSeconds(65)).toBe("01:05");
  });

  it("3661 秒输出 61:01（分钟可超过 59）", () => {
    expect(formatTimeFromSeconds(3661)).toBe("61:01");
  });

  it("5 秒输出 00:05", () => {
    expect(formatTimeFromSeconds(5)).toBe("00:05");
  });
});

describe("formatIsoDuration", () => {
  it("0 秒输出 PT（result 为真值，不落入 PT0S 回退）", () => {
    expect(formatIsoDuration(0)).toBe("PT");
  });

  it("65 秒输出 PT1M5S", () => {
    expect(formatIsoDuration(65)).toBe("PT1M5S");
  });

  it("3661 秒输出 PT1H1M1S", () => {
    expect(formatIsoDuration(3661)).toBe("PT1H1M1S");
  });

  it("3600 秒输出 PT1H", () => {
    expect(formatIsoDuration(3600)).toBe("PT1H");
  });

  it("60 秒输出 PT1M", () => {
    expect(formatIsoDuration(60)).toBe("PT1M");
  });

  it("1 秒输出 PT1S", () => {
    expect(formatIsoDuration(1)).toBe("PT1S");
  });
});

describe("formatNumber", () => {
  it("显式传 locale 时输出千分位分隔符", () => {
    expect(formatNumber(12345, "en-US")).toBe("12,345");
    expect(formatNumber(1000000, "en-US")).toBe("1,000,000");
    expect(formatNumber(3.14, "en-US")).toBe("3.14");
  });

  it("不传 locale 时跟随 i18next 当前语言 (zh-CN)", () => {
    expect(formatNumber(12345)).toBe("12,345");
  });
});

describe("formatDate", () => {
  const localDate = new Date(2024, 2, 15, 14, 30); // 2024-03-15 14:30 本地时间

  it("null / undefined / 非法日期返回 '--'", () => {
    expect(formatDate(null)).toBe("--");
    expect(formatDate(undefined)).toBe("--");
    expect(formatDate("not-a-date")).toBe("--");
  });

  it("full 格式输出年/月/日", () => {
    expect(formatDate(localDate, "full")).toBe("2024年3月15日");
  });

  it("short 格式输出月/日", () => {
    expect(formatDate(localDate, "short")).toBe("3月15日");
  });

  it("short-datetime 输出月/日 + 时间", () => {
    expect(formatDate(localDate, "short-datetime")).toBe("3月15日 14:30");
  });

  it("full-datetime 输出年/月/日 + 时间", () => {
    expect(formatDate(localDate, "full-datetime")).toBe("2024年3月15日 14:30");
  });

  it("time 格式输出 HH:mm", () => {
    expect(formatDate(localDate, "time")).toBe("14:30");
  });

  it("short-date 格式按 Intl 输出", () => {
    expect(formatDate(localDate, "short-date")).toBe("2024/03/15");
  });

  it("month-day 格式输出月/日", () => {
    expect(formatDate(localDate, "month-day")).toBe("3月15日");
  });

  it("weekday-short / weekday-long 输出星期", () => {
    expect(formatDate(localDate, "weekday-short")).toBe("周五");
    expect(formatDate(localDate, "weekday-long")).toBe("星期五");
  });

  it("month-year 格式输出年/月", () => {
    expect(formatDate(localDate, "month-year")).toBe("2024年3月");
  });

  it("long-date 格式输出完整日期加星期", () => {
    expect(formatDate(localDate, "long-date")).toBe("2024年3月15日星期五");
  });

  it("month-day-weekday 格式输出月/日加星期", () => {
    expect(formatDate(localDate, "month-day-weekday")).toBe("3月15日星期五");
  });

  it("支持数字时间戳输入", () => {
    expect(formatDate(localDate.getTime(), "full")).toBe("2024年3月15日");
  });

  it("支持无时区 ISO 字符串输入", () => {
    expect(formatDate("2024-03-15T14:30:00", "full")).toBe("2024年3月15日");
  });

  it("relative 格式按时间差输出", () => {
    expect(formatDate(new Date(Date.now() - 30_000), "relative")).toBe("刚刚");
    expect(formatDate(new Date(Date.now() - 5 * 60_000), "relative")).toBe("5分钟前");
    expect(formatDate(new Date(Date.now() - 2 * 3600_000), "relative")).toBe("2小时前");
    expect(formatDate(new Date(Date.now() - 3 * 86_400_000), "relative")).toBe("3天前");
    expect(formatDate(new Date(Date.now() - 60 * 86_400_000), "relative")).toBe("2 个月前");
  });

  it("relative 超过一年回退为完整日期", () => {
    const past = new Date(Date.now() - 400 * 86_400_000);
    const expected = `${past.getFullYear()}年${past.getMonth() + 1}月${past.getDate()}日`;
    expect(formatDate(past, "relative")).toBe(expected);
  });
});