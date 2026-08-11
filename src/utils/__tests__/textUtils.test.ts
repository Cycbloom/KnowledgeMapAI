import { describe, it, expect } from "vitest";
import { truncateText, TITLE_CONFIG } from "../textUtils";

describe("truncateText", () => {
  it("空字符串返回空结果", () => {
    expect(truncateText("")).toEqual({
      truncated: "",
      isTruncated: false,
      original: "",
      isEnglish: false,
    });
  });

  it("undefined 输入返回空结果", () => {
    const result = truncateText(undefined as unknown as string);
    expect(result).toEqual({
      truncated: "",
      isTruncated: false,
      original: "",
      isEnglish: false,
    });
  });

  it("null 输入返回空结果", () => {
    const result = truncateText(null as unknown as string);
    expect(result).toEqual({
      truncated: "",
      isTruncated: false,
      original: "",
      isEnglish: false,
    });
  });

  it("英文文本长度不超过 limit 时不截断", () => {
    const result = truncateText("abc", 5);
    expect(result.truncated).toBe("abc");
    expect(result.isTruncated).toBe(false);
    expect(result.original).toBe("abc");
    expect(result.isEnglish).toBe(true);
  });

  it("恰好等于 limit 时不截断", () => {
    const result = truncateText("abcde", 5);
    expect(result.isTruncated).toBe(false);
    expect(result.truncated).toBe("abcde");
  });

  it("超过 limit 时截断并追加默认省略号", () => {
    const result = truncateText("abcdef", 3);
    expect(result.truncated).toBe("abc...");
    expect(result.isTruncated).toBe(true);
    expect(result.original).toBe("abcdef");
    expect(result.isEnglish).toBe(true);
  });

  it("自定义省略号生效", () => {
    const result = truncateText("abcdef", 3, "…");
    expect(result.truncated).toBe("abc…");
  });

  it("中文文本默认 limit 为 MAX_TITLE_LENGTH_CN", () => {
    // 11 个中文字符超 10 上限
    const result = truncateText("一二三四五六七八九十壹");
    expect(result.truncated).toBe("一二三四五六七八九十...");
    expect(result.isTruncated).toBe(true);
    expect(result.isEnglish).toBe(false);
  });

  it("中文文本恰好等于默认上限时不截断", () => {
    const result = truncateText("一二三四五六七八九十");
    expect(result.isTruncated).toBe(false);
    expect(result.truncated).toBe("一二三四五六七八九十");
  });

  it("英文文本未传 maxLength 时默认使用 MAX_TITLE_LENGTH_EN", () => {
    const longEnglish = "a".repeat(TITLE_CONFIG.MAX_TITLE_LENGTH_EN + 1);
    const result = truncateText(longEnglish);
    expect(result.isEnglish).toBe(true);
    expect(result.isTruncated).toBe(true);
    expect(result.truncated).toHaveLength(TITLE_CONFIG.MAX_TITLE_LENGTH_EN + TITLE_CONFIG.ELLIPSIS.length);
    expect(result.truncated.startsWith(longEnglish.slice(0, TITLE_CONFIG.MAX_TITLE_LENGTH_EN))).toBe(true);
  });

  it("中英混合文本按字母占比判定为英文", () => {
    const result = truncateText("hello你好", 5);
    expect(result.isEnglish).toBe(true);
    expect(result.truncated).toBe("hello...");
  });
});