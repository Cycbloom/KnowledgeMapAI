import { useEffect, useRef } from "react";
import { useTimerStore } from "../../store/useTimerStore";
import { useActivityTracker } from "../scheduler/useActivityTracker";

interface UseLearningModeTimerOptions {
  nodeId: string | null;
  nodeTitle: string;
  linkedTaskMainTaskId?: string;
}

export function useLearningModeTimer({
  nodeId,
  nodeTitle,
  linkedTaskMainTaskId,
}: UseLearningModeTimerOptions) {
  const completeFocusTimer = useTimerStore((s) => s.complete);

  const { startActivity, endActivity } = useActivityTracker();
  const activityRef = useRef(false);
  const activityFnsRef = useRef({ startActivity, endActivity });

  useEffect(() => {
    activityFnsRef.current = { startActivity, endActivity };
  }, [startActivity, endActivity]);

  // Track activity for the current node
  useEffect(() => {
    if (nodeId && nodeTitle) {
      activityRef.current = true;
      activityFnsRef.current.startActivity(
        "focus_study",
        `阅读学习资料: ${nodeTitle}`,
        {
          knowledge_point_id: nodeId,
          task_id: linkedTaskMainTaskId,
        },
      );
    }
    return () => {
      if (activityRef.current) {
        activityFnsRef.current.endActivity();
        activityRef.current = false;
      }
    };
  }, [nodeId, nodeTitle, linkedTaskMainTaskId]);

  return {
    completeFocusTimer,
  };
}