import type { SyncOperation } from "./types";

/**
 * 合并同一记录的多次操作，减少同步数据量
 *
 * 完整 9 种 action 组合规则（3×3）：
 * - create + update → 合并 update 字段到 create 数据中
 * - create + delete → 移除操作（服务端从未见过此记录）
 * - create + create → 后者覆盖（视为重新创建）
 * - update + update → 后者字段覆盖前者
 * - update + delete → 保留 delete
 * - update + create → 视为重新创建，保留新 create 数据
 * - delete + update → 保留 delete（删除意图优先，避免已删记录被"复活"）
 * - delete + create → 视为重新创建，保留新 create 数据
 * - delete + delete → 保留 delete（幂等）
 */
export function mergeOperations(ops: SyncOperation[]): SyncOperation[] {
  const mergedOpsMap = new Map<string, SyncOperation>();

  for (const op of ops) {
    const key = `${op.table}:${op.recordId}`;
    const existing = mergedOpsMap.get(key);

    if (!existing) {
      mergedOpsMap.set(key, op);
      continue;
    }

    if (existing.action === "create" && op.action === "update") {
      // 合并 update 字段到 create 数据中，保留完整记录
      mergedOpsMap.set(key, {
        ...existing,
        data: { ...existing.data, ...op.data },
        timestamp: op.timestamp,
      });
    } else if (existing.action === "create" && op.action === "delete") {
      // 服务端从未见过此记录，直接移除
      mergedOpsMap.delete(key);
    } else if (existing.action === "create" && op.action === "create") {
      // 后者覆盖（视为重新创建）
      mergedOpsMap.set(key, op);
    } else if (existing.action === "update" && op.action === "update") {
      // 连续 update：后者字段覆盖前者
      mergedOpsMap.set(key, {
        ...existing,
        data: { ...existing.data, ...op.data },
        timestamp: op.timestamp,
      });
    } else if (existing.action === "update" && op.action === "delete") {
      // 保留 delete
      mergedOpsMap.set(key, op);
    } else if (existing.action === "update" && op.action === "create") {
      // 视为重新创建，保留新 create 数据
      mergedOpsMap.set(key, op);
    } else if (existing.action === "delete" && op.action === "update") {
      // 保留 delete（删除意图优先，避免已删记录被"复活"）
      // 注意：不修改 existing，保持 delete
    } else if (existing.action === "delete" && op.action === "create") {
      // 视为重新创建，保留新 create 数据
      mergedOpsMap.set(key, op);
    } else if (existing.action === "delete" && op.action === "delete") {
      // 保留 delete（幂等，不修改）
    }
  }

  return Array.from(mergedOpsMap.values());
}
