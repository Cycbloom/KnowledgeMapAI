import type { SyncConflict, SyncOperation } from "./types";

export type ConflictResolution = "local" | "remote" | "merge";

/**
 * 自动解决冲突 - 默认 Cloud Wins（remote 优先）
 */
export function autoResolveConflict(conflict: SyncConflict): SyncOperation | null {
  // Cloud Wins: 使用远程版本
  return conflict.remoteVersion;
}

/**
 * 手动解决冲突
 */
export function resolveConflict(
  conflict: SyncConflict,
  resolution: ConflictResolution,
): SyncOperation {
  switch (resolution) {
    case "local":
      return conflict.localVersion;
    case "remote":
      return conflict.remoteVersion;
    case "merge":
      return mergeConflictOperations(conflict.localVersion, conflict.remoteVersion);
    default:
      return conflict.remoteVersion;
  }
}

/**
 * 合并两个冲突操作的记录数据
 */
function mergeConflictOperations(local: SyncOperation, remote: SyncOperation): SyncOperation {
  const mergedData: Record<string, unknown> = {
    ...local.data,
    ...remote.data,
  };
  // 保留本地的创建时间
  if (local.data.created_at || remote.data.created_at) {
    mergedData.created_at = local.data.created_at || remote.data.created_at;
  }
  // 使用当前时间作为更新时间
  mergedData.updated_at = new Date().toISOString();

  return {
    id: `merged-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    action: "update",
    table: local.table,
    recordId: local.recordId,
    data: mergedData,
    timestamp: new Date().toISOString(),
    userId: local.userId,
  };
}

/**
 * 批量自动解决冲突
 */
export function autoResolveConflicts(
  conflicts: SyncConflict[],
): { resolved: SyncOperation[]; unresolved: SyncConflict[] } {
  const resolved: SyncOperation[] = [];
  const unresolved: SyncConflict[] = [];

  for (const conflict of conflicts) {
    const resolvedOp = autoResolveConflict(conflict);
    if (resolvedOp) {
      resolved.push(resolvedOp);
      conflict.resolved = true;
      conflict.resolution = "remote";
    } else {
      unresolved.push(conflict);
    }
  }

  return { resolved, unresolved };
}
