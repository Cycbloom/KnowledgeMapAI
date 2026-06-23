export type {
  SyncOperation,
  SyncBatch,
  SyncConflict,
  SyncDevice,
  SyncConfig,
  PushOperation,
} from "./types";

export { mergeOperations } from "./operationMerger";
export { detectConflict } from "./conflictDetector";
export {
  autoResolveConflict,
  resolveConflict,
  autoResolveConflicts,
} from "./conflictResolver";
export type { ConflictResolution } from "./conflictResolver";
