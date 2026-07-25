import { useCallback, useState } from "react";
import {
  activitiesApi,
  type RecordActivityData,
} from "../services/api/modules/scheduler/activities";
import type { ActivityEventType } from "../types/calendar";

interface ActivityTrackerOptions {
  onRecorded?: (activity: unknown) => void;
  onError?: (error: unknown) => void;
}

export function useActivityTracker(options?: ActivityTrackerOptions) {
  const [activeActivityId, setActiveActivityId] = useState<string | null>(null);

  const recordActivity = useCallback(
    async (data: RecordActivityData) => {
      try {
        const result = await activitiesApi.recordActivity(data);
        if (data.activity_type === "focus_study") {
          setActiveActivityId(result.id);
        }
        options?.onRecorded?.(result);
        return result;
      } catch (error) {
        options?.onError?.(error);
      }
    },
    [options],
  );

  const startActivity = useCallback(
    async (
      type: ActivityEventType,
      title: string,
      extra?: Partial<RecordActivityData>,
    ) => {
      return recordActivity({
        activity_type: type,
        title,
        started_at: new Date().toISOString(),
        ...extra,
      });
    },
    [recordActivity],
  );

  const endActivity = useCallback(
    async (duration?: number) => {
      if (!activeActivityId) return;
      try {
        const result = await activitiesApi.endActivity(
          activeActivityId,
          new Date().toISOString(),
          duration,
        );
        setActiveActivityId(null);
        options?.onRecorded?.(result);
        return result;
      } catch (error) {
        options?.onError?.(error);
      }
    },
    [activeActivityId, options],
  );

  return {
    recordActivity,
    startActivity,
    endActivity,
    activeActivityId,
  };
}
