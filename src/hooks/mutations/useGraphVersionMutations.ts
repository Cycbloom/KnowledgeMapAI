import { api } from "../../services/api/adapter";
import { queryKeys } from "../queries/config";
import { frontendEventBus } from "../../services/timer/FrontendEventBus";
import { createToastMutation } from "./mutationFactory";

export const useCreateSnapshot = (graphId: string) =>
  createToastMutation({
    mutationFn: (description?: string) =>
      api.graphVersions.createSnapshot(graphId, description),
    successMessage: "toast.graph.snapshotCreated",
    errorMessage: "toast.graph.snapshotCreateFailed",
    invalidateQueries: [queryKeys.graphSnapshots(graphId)],
  })();

export const useRollback = (graphId: string) =>
  createToastMutation({
    mutationFn: (snapshotId: string) =>
      api.graphVersions.rollback(graphId, snapshotId),
    successMessage: "toast.graph.snapshotRestored",
    errorMessage: "toast.graph.snapshotRestoreFailed",
    invalidateQueries: [
      queryKeys.graphSnapshots(graphId),
      queryKeys.graphData(graphId),
      queryKeys.graph(graphId),
      queryKeys.graphs,
    ],
    onSuccess: () => {
      frontendEventBus.publish("graph_data_changed", {
        graphId,
        changeType: "graph_rollback",
      });
    },
  })();

export const useCreateBranch = (graphId: string) =>
  createToastMutation({
    mutationFn: (branchName: string) =>
      api.graphVersions.createBranch(graphId, branchName),
    successMessage: "toast.graph.branchCreated",
    errorMessage: "toast.graph.branchCreateFailed",
    invalidateQueries: [queryKeys.graphBranches(graphId)],
    onSuccess: () => {
      frontendEventBus.publish("graph_list_changed", {
        graphId,
        changeType: "graph_created",
      });
    },
  })();

export const useMergeBranch = (graphId: string) =>
  createToastMutation({
    mutationFn: (params: {
      branchGraphId: string;
      selectedChanges?: { nodeIds?: string[]; edgeIds?: string[] };
      conflictResolutions?: Record<string, "main" | "branch">;
    }) =>
      api.graphVersions.merge(
        graphId,
        params.branchGraphId,
        params.selectedChanges,
        params.conflictResolutions,
      ),
    successMessage: "toast.graph.branchMerged",
    errorMessage: "toast.graph.branchMergeFailed",
    invalidateQueries: [queryKeys.graphData(graphId)],
    onSuccess: () => {
      frontendEventBus.publish("graph_data_changed", {
        graphId,
        changeType: "ai_action_executed",
      });
    },
  })();

export const useDeleteBranch = (graphId: string) =>
  createToastMutation({
    mutationFn: (branchId: string) => api.graphs.delete(branchId),
    successMessage: "toast.graph.branchDeleted",
    errorMessage: "toast.graph.branchDeleteFailed",
    invalidateQueries: [queryKeys.graphBranches(graphId)],
    onSuccess: () => {
      frontendEventBus.publish("graph_list_changed", {
        graphId,
        changeType: "graph_deleted",
      });
    },
  })();
