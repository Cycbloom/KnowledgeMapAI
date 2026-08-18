import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import { queryKeys } from "../queries/config";
import i18n from "../../i18n";
import type { ExecutionEvent } from "../../types/calendar";
import type { ExecutionFilters, TaskExecution } from "@shared/types";

const DEFAULT_STALE_TIME = 1000 * 60 * 5;
const GC_TIME = 1000 * 60 * 60;

const defaultQueryConfig = {
  staleTime: DEFAULT_STALE_TIME,
  gcTime: GC_TIME,
  retry: 2,
  retryDelay: (attemptIndex: number) =>
    Math.min(1000 * 2 ** attemptIndex, 30000),
};

export function useCalendarExecutions(filters?: ExecutionFilters) {
  return useQuery({
    queryKey: queryKeys.calendarExecutions(filters),
    queryFn: async (): Promise<ExecutionEvent[]> => {
      const res = await api.scheduler.getExecutions(filters);
      const executions: TaskExecution[] = res ?? [];
      return executions.map((exec: TaskExecution) => ({
        id: exec.id,
        task_id: exec.task_id,
        task_title: i18n.t("calendar.unknownTask"),
        started_at: exec.started_at,
        ended_at: exec.ended_at,
        duration: exec.duration,
        status: exec.status,
      }));
    },
    ...defaultQueryConfig,
  });
}
