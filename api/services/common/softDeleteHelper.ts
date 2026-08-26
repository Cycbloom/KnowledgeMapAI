/**
 * Soft-delete 过滤助手：统一封装 `deleted_at IS NULL` / `IS NOT NULL` 过滤逻辑。
 *
 * 设计目标：
 * - 消除散落各处的 `.is('deleted_at', null)` 链式片段，集中管理 soft-delete 语义
 * - 保持 Supabase query builder 的链式调用能力（返回同类型）
 * - 提供类型安全：泛型 T 约束保证调用端类型不丢失
 *
 * 用法示例：
 *   // before
 *   client.from('user_tasks').select('*').eq('user_id', userId).is('deleted_at', null)
 *   // after
 *   notDeleted(client.from('user_tasks').select('*').eq('user_id', userId))
 *
 *   // 链式调用仍可继续
 *   notDeleted(client.from('user_tasks').select('*')).eq('status', 'active')
 */

/**
 * 类型约束：拥有 `is(column, value)` 方法的链式查询对象。
 * Supabase 的 SupabaseQueryBuilder / QueryBuilder 均满足该约束。
 *
 * 注意：`is` 的返回类型刻意不限定为 `T` 自身（自引用 `T extends SoftDeleteFilterable<T>`
 * 会在复杂 Supabase builder 类型上触发 TS2589 "excessively deep"）。返回 `unknown`
 * 即可，因为本 helper 只用于在链式查询末尾追加 soft-delete 过滤并直接 await。
 */
interface SoftDeleteFilterable {
  is(column: string, value: unknown): unknown;
}

/**
 * 为 Supabase query builder 添加 soft-delete 过滤（deleted_at IS NULL）。
 *
 * 仅返回未被软删除的记录。
 */
export function notDeleted<T extends SoftDeleteFilterable>(query: T): T {
  return query.is('deleted_at', null) as T;
}

/**
 * 反向过滤：仅返回已软删除的记录（deleted_at IS NOT NULL）。
 *
 * 用于 trash / recycle bin 功能。
 */
export function deletedOnly<T extends { not: (column: string, value: unknown) => T }>(
  query: T,
): T {
  return query.not('deleted_at', null);
}
