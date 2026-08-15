import type { SyncOperation } from "./types";

/** 跳过自动生成的字段，不参与冲突检测 */
const SKIP_FIELDS = new Set(["created_at", "updated_at", "id"]);

/**
 * 检测两个操作是否冲突
 */
export function detectConflict(local: SyncOperation, remote: SyncOperation): boolean {
  if (local.table !== remote.table || local.recordId !== remote.recordId) {
    return false;
  }

  // delete 与非 delete 冲突
  if ((local.action === "delete") !== (remote.action === "delete")) {
    return true;
  }

  // 两个 update 检查字段级冲突
  if (local.action === "update" && remote.action === "update") {
    return recordsConflict(local.data, remote.data);
  }

  return false;
}

/**
 * 检查两条记录是否存在字段级冲突
 */
function recordsConflict(
  localRecord: Record<string, unknown>,
  remoteRecord: Record<string, unknown>,
): boolean {
  const localKeys = Object.keys(localRecord);
  const remoteKeys = Object.keys(remoteRecord);

  // 预构建 key Set，将两层循环内的 includes O(n) 线性查找降为 O(1)
  const remoteKeySet = new Set(remoteKeys);
  const localKeySet = new Set(localKeys);

  for (const key of localKeys) {
    if (remoteKeySet.has(key) && localRecord[key] !== remoteRecord[key]) {
      if (!SKIP_FIELDS.has(key)) {
        return true;
      }
    }
  }

  for (const key of remoteKeys) {
    if (localKeySet.has(key) && localRecord[key] !== remoteRecord[key]) {
      if (!SKIP_FIELDS.has(key)) {
        return true;
      }
    }
  }

  return false;
}
