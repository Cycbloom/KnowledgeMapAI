export type VersionGraphEventType =
  | "node_created"
  | "node_updated"
  | "node_deleted"
  | "edge_created"
  | "edge_updated"
  | "edge_deleted"
  | "graph_updated"
  | "graph_rollback"
  | "graph_branch_created"
  | "graph_merged";

export type GraphSnapshotType =
  | "auto"
  | "manual"
  | "pre_rollback"
  | "pre_ai_expand"
  | "pre_batch_delete";

export interface GraphEvent {
  id: string;
  graphId: string;
  eventType: VersionGraphEventType;
  eventData: Record<string, unknown>;
  operatorId: string | null;
  batchId: string | null;
  snapshotId: string | null;
  createdAt: string;
}

export interface SnapshotNodeData {
  id: string;
  knowledgePointId: string;
  title: string;
  content: string;
  summary: string | null;
  xPosition: number;
  yPosition: number;
  level: string;
  isAccepted: boolean;
}

export interface SnapshotEdgeData {
  id: string;
  sourceKnowledgePointId: string;
  targetKnowledgePointId: string;
  relationshipType: string;
  weight: number;
  customLabel: string | null;
  customColor: string | null;
  customLineStyle: string | null;
  showArrow: boolean | null;
}

export interface SnapshotData {
  nodes: SnapshotNodeData[];
  edges: SnapshotEdgeData[];
}

export interface GraphSnapshot {
  id: string;
  graphId: string;
  snapshotData: SnapshotData;
  description: string | null;
  snapshotType: GraphSnapshotType;
  nodeCount: number;
  edgeCount: number;
  operatorId: string | null;
  createdAt: string;
}

export type DiffChangeType = "added" | "removed" | "modified";

export interface NodeDiff {
  id: string;
  knowledgePointId: string;
  changeType: DiffChangeType;
  before: SnapshotNodeData | null;
  after: SnapshotNodeData | null;
  changedFields: string[];
}

export interface EdgeDiff {
  id: string;
  changeType: DiffChangeType;
  before: SnapshotEdgeData | null;
  after: SnapshotEdgeData | null;
  changedFields: string[];
}

export interface DiffResult {
  nodes: {
    added: SnapshotNodeData[];
    removed: SnapshotNodeData[];
    modified: NodeDiff[];
  };
  edges: {
    added: SnapshotEdgeData[];
    removed: SnapshotEdgeData[];
    modified: EdgeDiff[];
  };
  summary: {
    totalChanges: number;
    nodesAdded: number;
    nodesRemoved: number;
    nodesModified: number;
    edgesAdded: number;
    edgesRemoved: number;
    edgesModified: number;
  };
}

export interface MergeConflict {
  entityType: "node" | "edge";
  entityId: string;
  knowledgePointId?: string;
  mainChange: NodeDiff | EdgeDiff;
  branchChange: NodeDiff | EdgeDiff;
}

export interface MergeResult {
  diff: DiffResult;
  conflicts: MergeConflict[];
}

export interface CreateSnapshotRequest {
  description?: string;
}

export interface RollbackRequest {
  snapshotId: string;
}

export interface CreateBranchRequest {
  branchName: string;
}

export interface MergeRequest {
  branchGraphId: string;
  selectedChanges?: {
    nodeIds: string[];
    edgeIds: string[];
    removedNodeIds: string[];
    removedEdgeIds: string[];
  };
  conflictResolutions?: Record<string, "main" | "branch">;
}

export interface BranchInfo {
  id: string;
  title: string;
  branchName: string;
  createdAt: string;
  nodeCount: number;
  edgeCount: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
