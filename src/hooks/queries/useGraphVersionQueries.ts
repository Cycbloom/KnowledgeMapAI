import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api/adapter";
import {
  queryKeys,
  defaultQueryConfig,
  realtimeQueryConfig,
} from "./config";
import type { MergeResult } from "@shared/types/graphVersion";

export const useSnapshots = (graphId: string, page = 1, pageSize = 20) => {
  return useQuery({
    queryKey: [...queryKeys.graphSnapshots(graphId), page, pageSize],
    queryFn: () => api.graphVersions.listSnapshots(graphId, page, pageSize),
    enabled: !!graphId,
    ...defaultQueryConfig,
  });
};

export const useSnapshot = (graphId: string, snapshotId: string) => {
  return useQuery({
    queryKey: queryKeys.graphSnapshot(graphId, snapshotId),
    queryFn: () => api.graphVersions.getSnapshot(graphId, snapshotId),
    enabled: !!graphId && !!snapshotId,
    ...defaultQueryConfig,
  });
};

export const useGraphDiff = (
  graphId: string,
  sourceSnapshotId: string,
  targetSnapshotId?: string,
) => {
  return useQuery({
    queryKey: queryKeys.graphDiff(graphId, sourceSnapshotId, targetSnapshotId),
    queryFn: () =>
      api.graphVersions.diff(graphId, sourceSnapshotId, targetSnapshotId),
    enabled: !!graphId && !!sourceSnapshotId,
    ...realtimeQueryConfig,
  });
};

export const useGraphEvents = (
  graphId: string,
  page = 1,
  pageSize = 20,
) => {
  return useQuery({
    queryKey: [...queryKeys.graphEvents(graphId), page, pageSize],
    queryFn: () => api.graphVersions.listEvents(graphId, page, pageSize),
    enabled: !!graphId,
    ...defaultQueryConfig,
  });
};

export const useBranches = (graphId: string) => {
  return useQuery({
    queryKey: queryKeys.graphBranches(graphId),
    queryFn: () => api.graphVersions.listBranches(graphId),
    enabled: !!graphId,
    ...defaultQueryConfig,
  });
};

export const useMergePreview = (
  graphId: string,
  branchGraphId: string,
) => {
  return useQuery<MergeResult>({
    queryKey: queryKeys.graphMergePreview(graphId, branchGraphId),
    queryFn: () => api.graphVersions.mergePreview(graphId, branchGraphId),
    enabled: !!graphId && !!branchGraphId,
    ...realtimeQueryConfig,
  });
};
