import { describe, it, expect } from "vitest";
import { generateGroupColors, getSimilarityOpacity } from "../similarityColors";

const HEX_COLOR_PATTERN = /^#[0-9A-F]{6}$/;

describe("generateGroupColors", () => {
  it("count <= 0 时返回空数组", () => {
    expect(generateGroupColors(0)).toEqual([]);
  });

  it("count 为 1 时返回长度为 1 的数组", () => {
    const colors = generateGroupColors(1);
    expect(colors).toHaveLength(1);
    expect(colors[0]).toMatch(HEX_COLOR_PATTERN);
  });

  it("count 小于等于调色板长度时返回对应个数的调色板颜色", () => {
    const colors = generateGroupColors(8);
    expect(colors).toHaveLength(8);
    colors.forEach((color) => expect(color).toMatch(HEX_COLOR_PATTERN));
  });

  it("count 大于调色板长度时返回正确长度的颜色数组", () => {
    const colors = generateGroupColors(10);
    expect(colors).toHaveLength(10);
    colors.forEach((color) => expect(color).toMatch(HEX_COLOR_PATTERN));
  });

  it("count 大于调色板长度数倍时正确生成颜色", () => {
    const colors = generateGroupColors(20);
    expect(colors).toHaveLength(20);
    colors.forEach((color) => expect(color).toMatch(HEX_COLOR_PATTERN));
  });

  it("生成的元素均为合法颜色字符串", () => {
    const colors = generateGroupColors(12);
    expect(colors.every((color) => HEX_COLOR_PATTERN.test(color))).toBe(true);
  });
});

describe("getSimilarityOpacity", () => {
  it("similarity 为 0 时返回下界 0.3", () => {
    expect(getSimilarityOpacity(0)).toBe(0.3);
  });

  it("similarity 为 1 时返回上界 1", () => {
    expect(getSimilarityOpacity(1)).toBe(1);
  });

  it("similarity 为中间值时按公式计算", () => {
    expect(getSimilarityOpacity(0.5)).toBeCloseTo(0.65, 10);
  });

  it("similarity 小于 0 时被收敛到下界 0.3", () => {
    expect(getSimilarityOpacity(-0.5)).toBe(0.3);
  });

  it("similarity 大于 1 时被收敛到上界 1", () => {
    expect(getSimilarityOpacity(1.5)).toBe(1);
  });
});