import { describe, it, expect } from "vitest";
import { detectContentLanguage, isChineseContent } from "../language";

describe("detectContentLanguage", () => {
  it("识别中文内容", () => {
    expect(
      detectContentLanguage("机器学习是人工智能的一个分支，专注于让计算机从数据中学习。"),
    ).toBe("zh");
  });

  it("识别英文内容", () => {
    expect(
      detectContentLanguage(
        "Machine learning is a branch of artificial intelligence that focuses on learning from data.",
      ),
    ).toBe("en");
  });

  it("识别日文内容（假名 + 汉字）", () => {
    expect(detectContentLanguage("機械学習は人工知能の一分野であり、データから学習することに焦点を当てています。")).toBe("ja");
  });

  it("识别韩文内容（谚文）", () => {
    expect(
      detectContentLanguage("기계 학습은 인공 지능의 한 분야로, 데이터로부터 학습하는 데 초점을 맞춥니다."),
    ).toBe("ko");
  });

  it("空字符串与无脚本文本回退为 other", () => {
    expect(detectContentLanguage("")).toBe("other");
    expect(detectContentLanguage("   \n\t ")).toBe("other");
    expect(detectContentLanguage("😀😀😀")).toBe("other");
  });

  it("isChineseContent 按语种判定中文门控", () => {
    expect(isChineseContent("zh")).toBe(true);
    expect(isChineseContent("en")).toBe(false);
    expect(isChineseContent("ja")).toBe(false);
    expect(isChineseContent("ko")).toBe(false);
  });
});
