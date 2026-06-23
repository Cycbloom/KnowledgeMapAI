import type { SyncOperation } from "./types";

/**
 * 合并同一记录的多次操作，减少同步数据量
 * 规则：
 * - create + update → 合并 update 字段到 create 数据中
 * - update + update → 后者字段覆盖前者
 * - create + delete → 移除操作（服务端从未见过此记录）
 * - update + delete → 保留 delete
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
    } else if (existing.action === "update" && op.action === "update") {
      // 连续 update：后者字段覆盖前者
      mergedOpsMap.set(key, {
        ...existing,
        data: { ...existing.data, ...op.data },
        timestamp: op.timestamp,
      });
    } else if (op.action === "delete") {
      // delete 覆盖一切；若前面是 create，服务端从未见过此记录，直接移除
      if (existing.action === "create") {
        mergedOpsMap.delete(key);
      } else {
        mergedOpsMap.set(key, op);
      }
    } else {
      // 默认：保留最新操作
      mergedOpsMap.set(key, op);
    }
  }

  return Array.from(mergedOpsMap.values());
}
