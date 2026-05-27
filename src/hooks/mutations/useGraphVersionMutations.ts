import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api/adapter";
import { queryKeys } from "../queries/config";
import { frontendEventBus } from "../../services/timer/FrontendEventBus";
import toast from "react-hot-toast";

export const useCreateSnapshot = (graphId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (description?: string) =>
      api.graphVersions.createSnapshot(graphId, description),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.graphSnapshots(graphId),
      });
      toast.success("快照创建成功");
    },
    onError: () => {
      toast.error("快照创建失败");
    },
  });
};

export const useRollback = (graphId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (snapshotId: string) =>
      api.graphVersions.rollback(graphId, snapshotId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.graphSnapshots(graphId),
      });
      queryClient.invalidateQueries({
        queryKey: ["graphData", graphId],
      });
      queryClient.invalidateQueries({
        queryKey: ["graph", graphId],
      });
      queryClient.invalidateQueries({
        queryKey: ["graphs"],
      });
      frontendEventBus.publish("graph_data_changed", {
        graphId,
        changeType: "graph_rollback",
      });
      toast.success("回滚成功");
    },
    onError: () => {
      toast.error("回滚失败");
    },
  });
};

export const useCreateBranch = (graphId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (branchName: string) =>
      api.graphVersions.createBranch(graphId, branchName),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.graphBranches(graphId),
      });
      frontendEventBus.publish("graph_list_changed", {
        graphId,
        changeType: "graph_created",
      });
      toast.success("分支创建成功");
    },
    onError: () => {
      toast.error("分支创建失败");
    },
  });
};

export const useMergeBranch = (graphId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
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
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["graphData", graphId],
      });
      frontendEventBus.publish("graph_data_changed", {
        graphId,
        changeType: "ai_action_executed",
      });
      toast.success("合并成功");
    },
    onError: () => {
      toast.error("合并失败");
    },
  });
};

export const useDeleteBranch = (graphId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (branchId: string) => api.graphs.delete(branchId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.graphBranches(graphId),
      });
      frontendEventBus.publish("graph_list_changed", {
        graphId,
        changeType: "graph_deleted",
      });
      toast.success("分支已删除");
    },
    onError: () => {
      toast.error("分支删除失败");
    },
  });
};
