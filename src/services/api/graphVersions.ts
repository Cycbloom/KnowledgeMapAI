import { request } from "./client";
import type {
  GraphSnapshot,
  DiffResult,
  MergeResult,
  GraphEvent,
  PaginatedResult,
} from "@shared/types/graphVersion";

export const graphVersionsApi = {
  listSnapshots: (graphId: string, page = 1, pageSize = 20) =>
    request<PaginatedResult<GraphSnapshot>>(
      `/graphs/${graphId}/snapshots?page=${page}&pageSize=${pageSize}`,
    ),

  createSnapshot: (graphId: string, description?: string) =>
    request<GraphSnapshot>(`/graphs/${graphId}/snapshots`, {
      method: "POST",
      body: JSON.stringify({ description }),
    }),

  getSnapshot: (graphId: string, snapshotId: string) =>
    request<GraphSnapshot>(`/graphs/${graphId}/snapshots/${snapshotId}`),

  diff: (
    graphId: string,
    sourceSnapshotId: string,
    targetSnapshotId?: string,
  ) => {
    const params = new URLSearchParams({ sourceSnapshotId });
    if (targetSnapshotId) params.set("targetSnapshotId", targetSnapshotId);
    return request<DiffResult>(
      `/graphs/${graphId}/diff?${params.toString()}`,
    );
  },

  rollback: (graphId: string, snapshotId: string) =>
    request<{ success: boolean; preRollbackSnapshotId: string }>(
      `/graphs/${graphId}/rollback`,
      {
        method: "POST",
        body: JSON.stringify({ snapshotId }),
      },
    ),

  createBranch: (graphId: string, branchName: string) =>
    request<{ graphId: string; snapshotId: string }>(
      `/graphs/${graphId}/branches`,
      {
        method: "POST",
        body: JSON.stringify({ branchName }),
      },
    ),

  listBranches: (graphId: string) =>
    request<
      Array<{
        id: string;
        title: string;
        branch_name: string;
        created_at: string;
      }>
    >(`/graphs/${graphId}/branches`),

  merge: (
    graphId: string,
    branchGraphId: string,
    selectedChanges?: { nodeIds?: string[]; edgeIds?: string[] },
    conflictResolutions?: Record<string, "main" | "branch">,
  ) =>
    request(`/graphs/${graphId}/merge`, {
      method: "POST",
      body: JSON.stringify({
        branchGraphId,
        selectedChanges,
        conflictResolutions,
      }),
    }),

  mergePreview: (graphId: string, branchGraphId: string) =>
    request<MergeResult>(
      `/graphs/${graphId}/merge-preview?branchGraphId=${branchGraphId}`,
    ),

  listEvents: (
    graphId: string,
    page = 1,
    pageSize = 20,
    batchId?: string,
    eventType?: string,
  ) => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (batchId) params.set("batchId", batchId);
    if (eventType) params.set("eventType", eventType);
    return request<PaginatedResult<GraphEvent>>(
      `/graphs/${graphId}/events?${params.toString()}`,
    );
  },
};
