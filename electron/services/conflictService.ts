import { SyncOperation, SyncConflict } from './syncTypes.js';

export class ConflictService {
  detectConflicts(localOperations: SyncOperation[], remoteOperations: SyncOperation[]): SyncConflict[] {
    const conflicts: SyncConflict[] = [];
    const localOpsByKey = this.groupOperationsByKey(localOperations);
    const remoteOpsByKey = this.groupOperationsByKey(remoteOperations);

    // Check for conflicts between local and remote operations
    for (const [key, localOps] of localOpsByKey.entries()) {
      const remoteOpsForKey = remoteOpsByKey.get(key);
      if (remoteOpsForKey) {
        const conflict = this.detectConflictForKey(key, localOps, remoteOpsForKey);
        if (conflict) {
          conflicts.push(conflict);
        }
      }
    }

    return conflicts;
  }

  private groupOperationsByKey(operations: SyncOperation[]): Map<string, SyncOperation[]> {
    const grouped = new Map<string, SyncOperation[]>();
    
    for (const op of operations) {
      const key = `${op.table}:${op.recordId}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(op);
    }

    return grouped;
  }

  private detectConflictForKey(
    key: string,
    localOps: SyncOperation[],
    remoteOps: SyncOperation[]
  ): SyncConflict | null {
    // Get the latest operations for each side
    const latestLocalOp = this.getLatestOperation(localOps);
    const latestRemoteOp = this.getLatestOperation(remoteOps);

    if (!latestLocalOp || !latestRemoteOp) {
      return null;
    }

    // Check if there's a conflict
    if (this.isConflict(latestLocalOp, latestRemoteOp)) {
      return {
        id: `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        table: latestLocalOp.table,
        recordId: latestLocalOp.recordId,
        localVersion: latestLocalOp,
        remoteVersion: latestRemoteOp,
        resolved: false
      };
    }

    return null;
  }

  private getLatestOperation(operations: SyncOperation[]): SyncOperation | null {
    if (operations.length === 0) {
      return null;
    }

    return operations.reduce((latest, current) => {
      return new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest;
    });
  }

  private isConflict(localOp: SyncOperation, remoteOp: SyncOperation): boolean {
    // Check if both operations are modifying the same record
    if (localOp.table !== remoteOp.table || localOp.recordId !== remoteOp.recordId) {
      return false;
    }

    // Check if the operations are different types or modify different fields
    if (localOp.type !== remoteOp.type) {
      return true;
    }

    // For update operations, check if they modify the same fields
    if (localOp.type === 'update' && remoteOp.type === 'update') {
      return this.haveConflictingFields(localOp.record, remoteOp.record);
    }

    return false;
  }

  private haveConflictingFields(localRecord: any, remoteRecord: any): boolean {
    const localFields = Object.keys(localRecord);
    const remoteFields = Object.keys(remoteRecord);

    // Check if there are any common fields being modified
    for (const field of localFields) {
      if (remoteFields.includes(field)) {
        // Check if the values are different
        if (JSON.stringify(localRecord[field]) !== JSON.stringify(remoteRecord[field])) {
          return true;
        }
      }
    }

    return false;
  }

  resolveConflict(conflict: SyncConflict, resolution: 'local' | 'remote' | 'merge'): SyncOperation {
    switch (resolution) {
      case 'local':
        return this.resolveWithLocalVersion(conflict);
      case 'remote':
        return this.resolveWithRemoteVersion(conflict);
      case 'merge':
        return this.mergeVersions(conflict);
      default:
        throw new Error(`Invalid resolution strategy: ${resolution}`);
    }
  }

  private resolveWithLocalVersion(conflict: SyncConflict): SyncOperation {
    return {
      ...conflict.localVersion,
      id: `resolved-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString()
    };
  }

  private resolveWithRemoteVersion(conflict: SyncConflict): SyncOperation {
    return {
      ...conflict.remoteVersion,
      id: `resolved-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString()
    };
  }

  private mergeVersions(conflict: SyncConflict): SyncOperation {
    if (conflict.localVersion.type !== 'update' || conflict.remoteVersion.type !== 'update') {
      // If either operation is not an update, fall back to local version
      return this.resolveWithLocalVersion(conflict);
    }

    // Merge the fields, giving priority to newer values
    const mergedRecord = this.mergeRecords(
      conflict.localVersion.record,
      conflict.remoteVersion.record,
      new Date(conflict.localVersion.timestamp),
      new Date(conflict.remoteVersion.timestamp)
    );

    return {
      id: `merged-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'update',
      table: conflict.localVersion.table,
      record: mergedRecord,
      recordId: conflict.localVersion.recordId,
      timestamp: new Date().toISOString(),
      userId: conflict.localVersion.userId
    };
  }

  private mergeRecords(
    localRecord: any,
    remoteRecord: any,
    localTimestamp: Date,
    remoteTimestamp: Date
  ): any {
    const merged: any = { ...localRecord };

    for (const [key, remoteValue] of Object.entries(remoteRecord)) {
      if (!(key in merged)) {
        // Remote has a new field, add it
        merged[key] = remoteValue;
      } else if (typeof merged[key] === 'object' && typeof remoteValue === 'object' && merged[key] !== null && remoteValue !== null) {
        // Both have objects, recursively merge
        merged[key] = this.mergeRecords(
          merged[key],
          remoteValue,
          localTimestamp,
          remoteTimestamp
        );
      } else if (remoteTimestamp > localTimestamp) {
        // Remote is newer, use remote value
        merged[key] = remoteValue;
      }
    }

    return merged;
  }

  autoResolveConflicts(conflicts: SyncConflict[]): SyncOperation[] {
    const resolvedOperations: SyncOperation[] = [];

    for (const conflict of conflicts) {
      // Try to auto-resolve based on timestamps
      const localTime = new Date(conflict.localVersion.timestamp);
      const remoteTime = new Date(conflict.remoteVersion.timestamp);

      let resolution: 'local' | 'remote' | 'merge';
      if (localTime > remoteTime) {
        resolution = 'local';
      } else if (remoteTime > localTime) {
        resolution = 'remote';
      } else {
        // Same timestamp, try to merge
        resolution = 'merge';
      }

      const resolvedOp = this.resolveConflict(conflict, resolution);
      resolvedOperations.push(resolvedOp);
    }

    return resolvedOperations;
  }

  getConflictStats(conflicts: SyncConflict[]): {
    total: number;
    byTable: Record<string, number>;
    byType: Record<string, number>;
  } {
    const stats = {
      total: conflicts.length,
      byTable: {} as Record<string, number>,
      byType: {} as Record<string, number>
    };

    for (const conflict of conflicts) {
      // By table
      if (!stats.byTable[conflict.table]) {
        stats.byTable[conflict.table] = 0;
      }
      stats.byTable[conflict.table]++;

      // By type combination
      const typeKey = `${conflict.localVersion.type}_vs_${conflict.remoteVersion.type}`;
      if (!stats.byType[typeKey]) {
        stats.byType[typeKey] = 0;
      }
      stats.byType[typeKey]++;
    }

    return stats;
  }
}

export const conflictService = new ConflictService();
