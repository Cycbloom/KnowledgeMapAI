import type { CardType } from "@shared/types/quiz";

/**
 * 新题型答题数据解析与判分工具。
 * 负责 cloze / select_from_options / matching / ordering 的数据格式约定与判分逻辑。
 * DB 中 answer 为 TEXT，下列类型以 JSON 字符串存储；此处提供读写一致的解析与比对。
 */

export type ClozeAnswer = { blank: string }[];
export type MatchingAnswer = { left: string; right: string }[];
export type OrderingAnswer = string[];

/** 解析 JSON 字符串，失败返回 null */
export function parseJsonAnswer<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** trim 并去除首尾多余空格；非字符串（含 undefined）视为空串 */
const norm = (s: string | null | undefined) => (typeof s === "string" ? s.trim() : "");

/**
 * cloze 判分：answer 为 [{"blank":"正确词"},...]，与题干挖空顺序一一对应。
 * 用户输入逐空 trim 后全等才算对。
 */
export function isClozeCorrect(
  answerRaw: string | null | undefined,
  userInputs: (string | null | undefined)[],
): boolean {
  const expected = parseJsonAnswer<ClozeAnswer>(answerRaw);
  if (!expected || expected.length === 0) return false;
  if (userInputs.length !== expected.length) return false;
  return expected.every((item, i) => norm(item.blank) === norm(userInputs[i] ?? ""));
}

/** 提取题目中挖空数量（以 ___ 计） */
export function countClozeBlanks(question: string): number {
  const matches = question.match(/_{3,}/g);
  return matches ? matches.length : 0;
}

/**
 * select_from_options 判分：answer 为正确词字符串，与用户选中词全等。
 */
export function isSelectFromOptionsCorrect(
  answerRaw: string | null | undefined,
  selected: string | null | undefined,
): boolean {
  return norm(answerRaw ?? "") === norm(selected ?? "");
}

/**
 * matching 判分：answer 为 [{"left":"A","right":"定义"},...]。
 * 用户提交的每一对 left→right 都正确才算对。
 * 用户提交结构：Record<left, right>（若某 left 未配对则以空串计）。
 */
export function isMatchingCorrect(
  answerRaw: string | null | undefined,
  userPairs: Record<string, string | undefined>,
): boolean {
  const expected = parseJsonAnswer<MatchingAnswer>(answerRaw);
  if (!expected || expected.length === 0) return false;
  return expected.every((item) => {
    // 兼容非对象项（如 multi_choice 的字符串数组答案），直接视为不匹配
    if (!item || typeof item !== "object") return false;
    const l = item as { left?: unknown; right?: unknown };
    return (
      norm(typeof l.left === "string" ? l.left : "") !== "" &&
      norm(userPairs[String(l.left)] ?? "") === norm(typeof l.right === "string" ? l.right : "")
    );
  });
}

/**
 * ordering 判分：answer 为完整有序字符串数组。
 * 用户提交的完整顺序逐项全等才算对。
 */
export function isOrderingCorrect(
  answerRaw: string | null | undefined,
  userOrder: (string | null | undefined)[],
): boolean {
  const expected = parseJsonAnswer<OrderingAnswer>(answerRaw);
  if (!expected || expected.length === 0) return false;
  if (userOrder.length !== expected.length) return false;
  return expected.every((item, i) => norm(item) === norm(userOrder[i] ?? ""));
}

/** 是否属于新增的「交互型」题型（需要独立渲染，而非简单点选/填空） */
export function isComplexInteractiveType(type: CardType | string): boolean {
  return type === "matching" || type === "ordering";
}