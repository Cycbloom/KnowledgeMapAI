import {
  isClozeCorrect,
  countClozeBlanks,
  isSelectFromOptionsCorrect,
  isMatchingCorrect,
  isOrderingCorrect,
  isComplexInteractiveType,
} from "../quizNewTypes";

describe("quizNewTypes scoring", () => {
  describe("countClozeBlanks", () => {
    it("counts groups of 3+ underscores", () => {
      expect(countClozeBlanks("a ___ b ___ c")).toBe(2);
      expect(countClozeBlanks("no blanks")).toBe(0);
      expect(countClozeBlanks("___ only one")).toBe(1);
    });
  });

  describe("isClozeCorrect", () => {
    const answer = '[{"blank":"特征A"},{"blank":"特征B"},{"blank":"特征C"}]';
    it("returns true when all inputs match in order", () => {
      expect(isClozeCorrect(answer, ["特征A", "特征B", "特征C"])).toBe(true);
    });
    it("trims surrounding whitespace", () => {
      expect(isClozeCorrect(answer, [" 特征A ", "特征B", " 特征C "])).toBe(true);
    });
    it("returns false on wrong order", () => {
      expect(isClozeCorrect(answer, ["特征B", "特征A", "特征C"])).toBe(false);
    });
    it("returns false on wrong length", () => {
      expect(isClozeCorrect(answer, ["特征A", "特征B"])).toBe(false);
    });
    it("returns false on invalid JSON or empty", () => {
      expect(isClozeCorrect("not json", ["a", "b", "c"])).toBe(false);
      expect(isClozeCorrect("", ["a"])).toBe(false);
      expect(isClozeCorrect(null, ["a"])).toBe(false);
    });
  });

  describe("isSelectFromOptionsCorrect", () => {
    it("matches exact answer", () => {
      expect(isSelectFromOptionsCorrect("要素A", "要素A")).toBe(true);
    });
    it("trims whitespace", () => {
      expect(isSelectFromOptionsCorrect("要素A", " 要素A ")).toBe(true);
    });
    it("rejects wrong selection", () => {
      expect(isSelectFromOptionsCorrect("要素A", "要素B")).toBe(false);
    });
    it("handles null/undefined", () => {
      expect(isSelectFromOptionsCorrect("要素A", null)).toBe(false);
      expect(isSelectFromOptionsCorrect(undefined, "要素A")).toBe(false);
    });
  });

  describe("isMatchingCorrect", () => {
    const answer =
      '[{"left":"A","right":"定义A"},{"left":"B","right":"定义B"}]';
    it("returns true when every left→right is correct", () => {
      expect(isMatchingCorrect(answer, { A: "定义A", B: "定义B" })).toBe(true);
    });
    it("trims whitespace on both sides", () => {
      expect(isMatchingCorrect(answer, { A: " 定义A", B: "定义B " })).toBe(true);
    });
    it("returns false when one pair wrong", () => {
      expect(isMatchingCorrect(answer, { A: "定义B", B: "定义A" })).toBe(false);
    });
    it("returns false when a left item unpaired", () => {
      expect(isMatchingCorrect(answer, { A: "定义A" })).toBe(false);
    });
    it("returns false on invalid JSON", () => {
      expect(isMatchingCorrect("bad", { A: "定义A", B: "定义B" })).toBe(false);
    });
  });

  describe("isOrderingCorrect", () => {
    const answer = '["步骤1","步骤2","步骤3"]';
    it("returns true for exact order", () => {
      expect(isOrderingCorrect(answer, ["步骤1", "步骤2", "步骤3"])).toBe(true);
    });
    it("trims whitespace", () => {
      expect(isOrderingCorrect(answer, [" 步骤1 ", "步骤2", "步骤3"])).toBe(true);
    });
    it("returns false on different order", () => {
      expect(isOrderingCorrect(answer, ["步骤2", "步骤1", "步骤3"])).toBe(false);
    });
    it("returns false on wrong length", () => {
      expect(isOrderingCorrect(answer, ["步骤1", "步骤2"])).toBe(false);
    });
    it("returns false on invalid JSON", () => {
      expect(isOrderingCorrect("bad", ["步骤1"])).toBe(false);
    });
  });

  describe("isComplexInteractiveType", () => {
    it("marks matching and ordering as complex", () => {
      expect(isComplexInteractiveType("matching")).toBe(true);
      expect(isComplexInteractiveType("ordering")).toBe(true);
    });
    it("marks cloze/select_from_options/others as not complex", () => {
      expect(isComplexInteractiveType("cloze")).toBe(false);
      expect(isComplexInteractiveType("select_from_options")).toBe(false);
      expect(isComplexInteractiveType("choice")).toBe(false);
    });
  });
});