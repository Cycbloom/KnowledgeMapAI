/**
 * useOptimisticMutation — 乐观更新基础 hook
 *
 * 统一模式：
 * - onMutate：保存旧数据并即时更新缓存
 * - onError：回滚到旧数据，显示错误 Toast
 * - onSettled：失效相关查询
 *
 * 实现在 src/hooks/mutations/useOptimisticMutation.ts，此处为便捷重导出。
 */
export {
  useOptimisticMutation,
  type OptimisticMutationOptions,
} from "../mutations/useOptimisticMutation";