import { SyncConflict, SyncOperation } from "./syncTypes";

class ConflictService {
  // 自动解决冲突
  autoResolveConflicts(conflicts: SyncConflict[]): SyncOperation[] {
    const resolvedOperations: SyncOperation[] = [];

    for (const conflict of conflicts) {
      const resolvedOperation = this.autoResolveConflict(conflict);
      if (resolvedOperation) {
        resolvedOperations.push(resolvedOperation);
        conflict.resolved = true;
        conflict.resolution = "remote"; // 默认使用远程版本
      }
    }

    return resolvedOperations;
  }

  // 自动解决单个冲突
  private autoResolveConflict(conflict: SyncConflict): SyncOperation | null {
    // 默认策略：使用较新的版本
    const localTime = new Date(conflict.localVersion.timestamp).getTime();
    const remoteTime = new Date(conflict.remoteVersion.timestamp).getTime();

    if (remoteTime > localTime) {
      // 远程版本更新，使用远程版本
      return conflict.remoteVersion;
    } else if (localTime > remoteTime) {
      // 本地版本更新，使用本地版本
      return conflict.localVersion;
    } else {
      // 时间相同，默认使用远程版本
      return conflict.remoteVersion;
    }
  }

  // 手动解决冲突
  resolveConflict(
    conflict: SyncConflict,
    resolution: "local" | "remote" | "merge",
  ): SyncOperation {
    let resolvedOperation: SyncOperation;

    switch (resolution) {
      case "local":
        resolvedOperation = conflict.localVersion;
        break;
      case "remote":
        resolvedOperation = conflict.remoteVersion;
        break;
      case "merge":
        resolvedOperation = this.mergeOperations(
          conflict.localVersion,
          conflict.remoteVersion,
        );
        break;
      default:
        resolvedOperation = conflict.remoteVersion;
    }

    conflict.resolved = true;
    conflict.resolution = resolution;

    return resolvedOperation;
  }

  // 合并操作
  private mergeOperations(
    localOp: SyncOperation,
    remoteOp: SyncOperation,
  ): SyncOperation {
    // 合并两个操作的记录
    const mergedRecord = {
      ...localOp.record,
      ...remoteOp.record,
      // 保留本地的创建时间
      created_at: localOp.record.created_at || remoteOp.record.created_at,
      // 使用较新的更新时间
      updated_at: new Date().toISOString(),
    };

    return {
      id: `merged-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: "update",
      table: localOp.table,
      record: mergedRecord,
      recordId: localOp.recordId,
      timestamp: new Date().toISOString(),
      userId: localOp.userId,
    };
  }

  // 检测冲突
  detectConflict(localOp: SyncOperation, remoteOp: SyncOperation): boolean {
    // 检查是否是同一个记录的操作
    if (
      localOp.table !== remoteOp.table ||
      localOp.recordId !== remoteOp.recordId
    ) {
      return false;
    }

    // 检查操作类型是否冲突
    if (
      (localOp.type === "delete" && remoteOp.type !== "delete") ||
      (remoteOp.type === "delete" && localOp.type !== "delete")
    ) {
      return true;
    }

    // 检查记录内容是否冲突
    if (localOp.type === "update" && remoteOp.type === "update") {
      return this.recordsConflict(localOp.record, remoteOp.record);
    }

    return false;
  }

  // 检查记录是否冲突
  private recordsConflict(localRecord: any, remoteRecord: any): boolean {
    // 比较两个记录的内容
    const localKeys = Object.keys(localRecord);
    const remoteKeys = Object.keys(remoteRecord);

    // 检查是否有相同的键但不同的值
    for (const key of localKeys) {
      if (remoteKeys.includes(key) && localRecord[key] !== remoteRecord[key]) {
        // 跳过自动生成的字段
        if (!["created_at", "updated_at", "id"].includes(key)) {
          return true;
        }
      }
    }

    for (const key of remoteKeys) {
      if (localKeys.includes(key) && localRecord[key] !== remoteRecord[key]) {
        // 跳过自动生成的字段
        if (!["created_at", "updated_at", "id"].includes(key)) {
          return true;
        }
      }
    }

    return false;
  }
}

export const conflictService = new ConflictService();
