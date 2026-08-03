import { useEffect, useRef, useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { EventSourcePolyfill } from "event-source-polyfill";
import { useStore } from "../../store/useStore";
import { queryKeys } from "../queries/config";
import { Task, TaskRuntimeProgress } from "../../types";
import {
  isElectronProduction,
  getElectronApiUrl,
} from "../../config/electronConfig";
import { isCapacitorMobile } from "../../config/mobileApiConfig";
import { frontendEventBus } from "../../services/timer/FrontendEventBus";

const SSE_HEARTBEAT_TIMEOUT = 300000;
const SSE_RECONNECT_DELAY_BASE = 1000;
const SSE_RECONNECT_MAX_ATTEMPTS = 10;

/**
 * 将后端 SSE 推送的 progress payload（字段名：stage/progress/current_node/processed/total）
 * 映射为前端 TaskRuntimeProgress（字段名：stage/percent/current/completed/total）。
 *
 * 后端 TaskProgress 接口带 [key: string]: unknown 索引签名，processor 可能传任意字段组合。
 * 同时兼容前端字段名（percent/current/completed），便于未来后端统一命名后无需改动此处。
 * 返回 undefined 表示无可识别的进度字段（前端降级为原 spinner，不抛错）。
 */
const mapToRuntimeProgress = (
  raw: unknown,
): TaskRuntimeProgress | undefined => {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const p = raw as Record<string, unknown>;

  const stage = typeof p.stage === "string" ? p.stage : undefined;
  const stageLabel =
    typeof p.stageLabel === "string" ? p.stageLabel : undefined;
  const percent =
    typeof p.progress === "number"
      ? p.progress
      : typeof p.percent === "number"
        ? p.percent
        : undefined;
  const current =
    typeof p.current_node === "string"
      ? p.current_node
      : typeof p.current === "string"
        ? p.current
        : undefined;
  const completed =
    typeof p.processed === "number"
      ? p.processed
      : typeof p.completed === "number"
        ? p.completed
        : undefined;
  const total = typeof p.total === "number" ? p.total : undefined;

  const runtime: TaskRuntimeProgress = {};
  if (stage !== undefined) runtime.stage = stage;
  if (stageLabel !== undefined) runtime.stageLabel = stageLabel;
  if (percent !== undefined) runtime.percent = percent;
  if (current !== undefined) runtime.current = current;
  if (completed !== undefined) runtime.completed = completed;
  if (total !== undefined) runtime.total = total;

  return Object.keys(runtime).length > 0 ? runtime : undefined;
};

export const useTaskEvents = () => {
  const queryClient = useQueryClient();
  const token = useStore((state) => state.token);
  const [apiUrl, setApiUrl] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSourcePolyfill | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const connectRef = useRef<((isReconnect?: boolean) => void) | null>(null);
  const lastActivityRef = useRef<number>(0);
  const wasHiddenRef = useRef<boolean>(false);
  const isMobileRef = useRef(isCapacitorMobile());

  useEffect(() => {
    if (isMobileRef.current) {
      return;
    }

    const initApiUrl = async () => {
      if (isElectronProduction()) {
        const url = await getElectronApiUrl();
        setApiUrl(url);
      } else {
        setApiUrl("/api");
      }
    };
    initApiUrl();
  }, []);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(
    (isReconnect = false) => {
      if (isMobileRef.current) {
        return;
      }
      if (!token) {
        console.warn("[SSE] No token available, skipping connection");
        return;
      }
      if (!apiUrl) {
        console.warn("[SSE] API URL not ready, skipping connection");
        return;
      }

      cleanup();
      frontendEventBus.publish("sse_status_changed", { status: "connecting" });

      if (!isReconnect) {
        reconnectAttemptsRef.current = 0;
      }
      lastActivityRef.current = Date.now();

      const sseUrl = `${apiUrl}/tasks/events`;

      try {
        const es = new EventSourcePolyfill(sseUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          heartbeatTimeout: SSE_HEARTBEAT_TIMEOUT,
          withCredentials: true,
        });

        eventSourceRef.current = es;

        es.onopen = () => {
          frontendEventBus.publish("sse_status_changed", { status: "connected" });
          reconnectAttemptsRef.current = 0;
          lastActivityRef.current = Date.now();
        };

        es.onmessage = (event) => {
          lastActivityRef.current = Date.now();

          try {
            const data = JSON.parse(event.data);

            if (data.type === "connected") {
              return;
            }

            frontendEventBus.publish("sse_message", data);

            if (data.type === "task_update") {
              frontendEventBus.publish("sse_task_update", { taskId: data.taskId, status: data.status, ...data });
            }
            if (data.type === "task_completed") {
              frontendEventBus.publish("sse_task_completed", data);
            }
            if (data.type === "focus_session_ended") {
              frontendEventBus.publish("sse_focus_session_ended", data);
            }
            if (data.type === "review_completed") {
              frontendEventBus.publish("sse_review_completed", data);
            }
            if (data.type === "notification_needed") {
              frontendEventBus.publish("sse_notification_needed", data);
            }

            if (data.cacheKeys && Array.isArray(data.cacheKeys)) {
              for (const key of data.cacheKeys) {
                if (Array.isArray(key)) {
                  queryClient.invalidateQueries({ queryKey: key });
                }
              }
            }

            if (data.type === "task_update") {
              const { taskId, status } = data;
              const runtimeProgress = mapToRuntimeProgress(data.progress);

              const cachedTasks = queryClient.getQueryData<Task[]>(["tasks"]);
              const existingTask = cachedTasks?.find((t) => t.id === taskId);
              const oldStatus = existingTask?.status;

              if (oldStatus && oldStatus !== status) {
                frontendEventBus.publish("scheduler_task_status_changed", {
                  taskId,
                  oldStatus,
                  newStatus: status,
                  taskType: existingTask?.task_type,
                });
              }

              queryClient.setQueryData(
                ["tasks"],
                (oldTasks: Task[] | undefined) => {
                  if (!oldTasks) return [];

                  const existingTaskIndex = oldTasks.findIndex(
                    (t) => t.id === taskId,
                  );

                  if (existingTaskIndex !== -1) {
                    const newTasks = [...oldTasks];
                    newTasks[existingTaskIndex] = {
                      ...newTasks[existingTaskIndex],
                      status,
                      updated_at: new Date().toISOString(),
                      ...(runtimeProgress !== undefined
                        ? { runtime_progress: runtimeProgress }
                        : {}),
                    };
                    return newTasks;
                  } else {
                    queryClient.invalidateQueries({ queryKey: queryKeys.tasksPrefix });
                    return oldTasks;
                  }
                },
              );

              queryClient.invalidateQueries({ queryKey: ["task", taskId] });
            }
          } catch (err) {
            console.error("[SSE] Error parsing message:", err);
          }
        };

        es.onerror = (err) => {
          console.error("[SSE] Connection error:", err);

          const errorStatus = (err as { status?: number; type?: string })
            ?.status;
          const errorType = (err as { status?: number; type?: string })?.type;

          if (errorStatus === 401 || errorType === "authorization") {
            console.error("[SSE] Authentication failed, closing connection");
            frontendEventBus.publish("sse_status_changed", { status: "error", error: "Authentication failed. Please login again." });
            cleanup();
            return;
          }

          if (reconnectAttemptsRef.current < SSE_RECONNECT_MAX_ATTEMPTS) {
            reconnectAttemptsRef.current++;
            const delay =
              SSE_RECONNECT_DELAY_BASE *
              Math.pow(2, Math.min(reconnectAttemptsRef.current - 1, 5));

            frontendEventBus.publish("sse_status_changed", { status: "connecting", error: `Reconnecting... (${reconnectAttemptsRef.current}/${SSE_RECONNECT_MAX_ATTEMPTS})` });

            reconnectTimeoutRef.current = setTimeout(() => {
              if (connectRef.current) {
                connectRef.current(true);
              }
            }, delay);
          } else {
            console.error("[SSE] Max reconnection attempts reached");
            frontendEventBus.publish("sse_status_changed", { status: "error", error: "Connection failed. Please refresh the page." });
            cleanup();
          }
        };
      } catch (error) {
        console.error("[SSE] Failed to create EventSource:", error);
        frontendEventBus.publish("sse_status_changed", { status: "error", error: "Failed to establish connection" });
        cleanup();
      }
    },
    [token, apiUrl, queryClient, cleanup],
  );

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    if (isMobileRef.current) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && wasHiddenRef.current) {
        wasHiddenRef.current = false;
        const timeSinceLastActivity = Date.now() - lastActivityRef.current;
        const connectionStale = timeSinceLastActivity > 60000;

        if (connectionStale || !eventSourceRef.current) {
          reconnectAttemptsRef.current = 0;
          connect();
        }
      } else if (document.visibilityState === "hidden") {
        wasHiddenRef.current = true;
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [connect]);

  useEffect(() => {
    if (isMobileRef.current) {
      return;
    }

    if (!token) {
      cleanup();
      frontendEventBus.publish("sse_status_changed", { status: "disconnected" });
      return;
    }
    if (!apiUrl) {
      return;
    }

    connect();

    return () => {
      cleanup();
      frontendEventBus.publish("sse_status_changed", { status: "disconnected" });
    };
  }, [token, apiUrl, connect, cleanup]);
};
