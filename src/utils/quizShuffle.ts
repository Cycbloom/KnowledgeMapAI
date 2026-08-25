/**
 * 随机洗牌工具
 *
 * 用途：
 * - 答题/测验模式下选择题（choice / multi_choice / select_from_options）选项随机排列，
 *   避免用户因记住固定选项位置（肌肉记忆/位置记忆）而答对。
 * - 测验模式整卷题目顺序随机打乱。
 *
 * 说明：
 * - Fisher–Yates 洗牌，返回新数组（不修改入参）。
 * - 判分基于选项/答案的完整字符串匹配，显示时仅剥离字母前缀或改变顺序，
 *   因此打乱不影响正确性。
 * - 判断题（true_false）仅 True/False 两项、matching/ordering 选项顺序本身即排序语义，
 *   不打乱。
 */

/** 泛型 Fisher–Yates 洗牌，返回新数组（不修改入参） */
export function shuffleArray<T>(items: readonly T[]): T[] {
  if (items.length <= 1) return [...items];
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 字符串选项数组洗牌（选择题选项随机排列） */
export function shuffleOptions(items: readonly string[]): string[] {
  return shuffleArray(items);
}