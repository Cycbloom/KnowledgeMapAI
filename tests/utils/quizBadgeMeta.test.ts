import { describe, it, expect } from "vitest";
import type { CardType } from "../../shared/types/quiz";
import {
  getCardTypeBadgeMeta,
  badgeToneClasses,
  type BadgeTone,
} from "../../src/utils/quizBadgeMeta";

/** 6 种标准题型及其期望的 labelKey */
const EXPECTED_LABEL_KEYS: Readonly<Record<CardType, string>> = {
  choice: "study.cardType.choice",
  multi_choice: "study.cardType.multiChoice",
  true_false: "study.cardType.trueFalse",
  fill_in_the_blank: "study.cardType.fillBlank",
  qa: "study.cardType.qa",
  essay: "study.cardType.essay",
};

describe("getCardTypeBadgeMeta", () => {
  const cardTypes: CardType[] = [
    "choice",
    "multi_choice",
    "true_false",
    "fill_in_the_blank",
    "qa",
    "essay",
  ];

  it.each(cardTypes)("题型 %s 的 labelKey 正确", (cardType) => {
    const meta = getCardTypeBadgeMeta(cardType);
    expect(meta.labelKey).toBe(EXPECTED_LABEL_KEYS[cardType]);
  });

  it.each(cardTypes)("题型 %s 的 Icon 是函数组件", (cardType) => {
    const meta = getCardTypeBadgeMeta(cardType);
    const typeOfIcon = typeof meta.Icon;
    expect(typeOfIcon === "function" || typeOfIcon === "object").toBe(true);
    expect(meta.Icon).not.toBeNull();
  });

  it("未知题型不抛错且回退到 essay/slate", () => {
    expect(() => getCardTypeBadgeMeta("unknown_type")).not.toThrow();
    const meta = getCardTypeBadgeMeta("unknown_type");
    expect(meta.labelKey).toBe("study.cardType.essay");
    expect(meta.tone).toBe("slate");
    const typeOfIcon = typeof meta.Icon;
    expect(typeOfIcon === "function" || typeOfIcon === "object").toBe(true);
    expect(meta.Icon).not.toBeNull();
  });

  it("空字符串不抛错且回退到 essay/slate", () => {
    expect(() => getCardTypeBadgeMeta("")).not.toThrow();
    const meta = getCardTypeBadgeMeta("");
    expect(meta.tone).toBe("slate");
  });
});

describe("badgeToneClasses", () => {
  const tones: BadgeTone[] = [
    "blue",
    "rose",
    "emerald",
    "violet",
    "amber",
    "slate",
  ];

  it.each(tones)("tone=%s 亮色模式返回非空 class 字符串", (tone) => {
    const classes = badgeToneClasses(tone, false);
    expect(typeof classes).toBe("string");
    expect(classes.length).toBeGreaterThan(0);
    expect(classes).toContain("rounded-full");
    expect(classes).toContain("border");
  });

  it.each(tones)("tone=%s 暗色模式返回非空 class 字符串", (tone) => {
    const classes = badgeToneClasses(tone, true);
    expect(typeof classes).toBe("string");
    expect(classes.length).toBeGreaterThan(0);
    expect(classes).toContain("rounded-full");
    expect(classes).toContain("border");
  });

  it("亮色与暗色模式 class 内容不同", () => {
    const light = badgeToneClasses("blue", false);
    const dark = badgeToneClasses("blue", true);
    expect(light).not.toBe(dark);
  });
});
