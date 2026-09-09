import { describe, it, expect } from "vitest";
import {
  countFillBlankBlanks,
  splitFillBlankAnswers,
  isFillBlankCorrect,
} from "../../src/utils/quizNewTypes";

describe("countFillBlankBlanks", () => {
  it("多个 ___ 返回对应空数", () => {
    expect(countFillBlankBlanks("async 函数返回一个 ___ 对象，await 只能在 ___ 函数内部使用。")).toBe(2);
  });

  it("单个 ___ 返回 1", () => {
    expect(countFillBlankBlanks("闭包是指函数能够访问其 ___ 作用域中的变量。")).toBe(1);
  });

  it("未用 ___ 标记的历史题干至少返回 1", () => {
    expect(countFillBlankBlanks("请回答以下关于知识点的问题内容？")).toBe(1);
  });

  it("空题干至少返回 1", () => {
    expect(countFillBlankBlanks("")).toBe(1);
  });
});

describe("splitFillBlankAnswers", () => {
  it("单空：整串作为唯一答案", () => {
    expect(splitFillBlankAnswers("词法", 1)).toEqual(["词法"]);
  });

  it("多空：英文逗号分隔", () => {
    expect(splitFillBlankAnswers("Promise, async", 2)).toEqual(["Promise", "async"]);
  });

  it("多空：中文逗号分隔", () => {
    expect(splitFillBlankAnswers("Promise，async", 2)).toEqual(["Promise", "async"]);
  });

  it("多空：顿号分隔", () => {
    expect(splitFillBlankAnswers("A、B", 2)).toEqual(["A", "B"]);
  });

  it("多空：分号分隔", () => {
    expect(splitFillBlankAnswers("A; B", 2)).toEqual(["A", "B"]);
  });

  it("多空：换行分隔", () => {
    expect(splitFillBlankAnswers("A\nB", 2)).toEqual(["A", "B"]);
  });

  it("多空：自动去除每项首尾空格", () => {
    expect(splitFillBlankAnswers("  A , B  ", 2)).toEqual(["A", "B"]);
  });

  it("多空：分隔项数与空数不对齐时返回空数组", () => {
    expect(splitFillBlankAnswers("词法", 2)).toEqual([]);
    expect(splitFillBlankAnswers("A, B, C", 2)).toEqual([]);
  });

  it("空答案返回空数组", () => {
    expect(splitFillBlankAnswers("", 2)).toEqual([]);
    expect(splitFillBlankAnswers(null, 2)).toEqual([]);
    expect(splitFillBlankAnswers(undefined, 1)).toEqual([]);
  });
});

describe("isFillBlankCorrect", () => {
  it("单空：逐字全等判对", () => {
    expect(isFillBlankCorrect("词法", ["词法"])).toBe(true);
  });

  it("单空：忽略首尾空格", () => {
    expect(isFillBlankCorrect("词法", ["  词法  "])).toBe(true);
  });

  it("单空：内容不符判错", () => {
    expect(isFillBlankCorrect("词法", ["其他"])).toBe(false);
  });

  it("多空：按序逐空全等判对", () => {
    expect(isFillBlankCorrect("Promise, async", ["Promise", "async"])).toBe(true);
  });

  it("多空：顺序颠倒判错", () => {
    expect(isFillBlankCorrect("Promise, async", ["async", "Promise"])).toBe(false);
  });

  it("多空：大小写不一致判错", () => {
    expect(isFillBlankCorrect("Promise, async", ["promise", "async"])).toBe(false);
  });

  it("多空：空数与题干不对齐判错", () => {
    expect(isFillBlankCorrect("Promise, async", ["Promise"])).toBe(false);
    expect(isFillBlankCorrect("Promise, async", ["Promise", "async", "x"])).toBe(false);
  });

  it("多空：答案未按分隔符存储时判错", () => {
    expect(isFillBlankCorrect("Promise async", ["Promise", "async"])).toBe(false);
  });

  it("空答案判错", () => {
    expect(isFillBlankCorrect("", ["词法"])).toBe(false);
    expect(isFillBlankCorrect(null, ["词法"])).toBe(false);
  });
});
