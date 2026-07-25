import { useState, useEffect } from "react";
import { schedulerApi } from "../services/api";

export interface LinkedTask {
  mainTaskId: string;
  graphName: string;
  totalNodes: number;
  completedNodes: number;
  progress: number;
  subtaskId?: string;
}

interface UseLinkedTaskOptions {
  graphId: string | null;
  nodeId: string | null;
}

export function useLinkedTask({ graphId, nodeId }: UseLinkedTaskOptions) {
  const [linkedTask, setLinkedTask] = useState<LinkedTask | null>(null);

  useEffect(() => {
    if (!graphId) return;

    const fetchLinkedTask = async () => {
      try {
        const data = await schedulerApi.linkTaskForGraph(graphId);
        if (data) {
          setLinkedTask({
            mainTaskId: data.mainTaskId,
            graphName: data.graphName,
            totalNodes: data.totalNodes,
            completedNodes: data.completedNodes,
            progress:
              data.totalNodes > 0
                ? Math.round((data.completedNodes / data.totalNodes) * 100)
                : 0,
            subtaskId: data.subtasks?.find(
              (s: { knowledgePointId: string }) =>
                s.knowledgePointId === nodeId,
            )?.id,
          });
        }
      } catch (error) {
        console.error("Failed to link task:", error);
      }
    };

    fetchLinkedTask();
  }, [graphId, nodeId]);

  return { linkedTask };
}
