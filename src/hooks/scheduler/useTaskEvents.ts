import { useEffect, useRef, useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { EventSourcePolyfill } from "event-source-polyfill";
import { useStore } from "../../store/useStore";
import { queryKeys } from "../queries/config";
import { Task } from "../../types";
import {
  isElectronProduction,
  getElectronApiUrl,
} from "../../config/electronConfig";
import { isCapacitorMobile } from "../../config/mobileApiConfig";
import { frontendEventBus } from "../../services/timer/FrontendEventBus";

const SSE_HEARTBEAT_TIMEOUT = 300000;
const SSE_RECONNECT_DELAY_BASE = 1000;
const SSE_RECONNECT_MAX_ATTEMPTS = 10;

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

              // 旧状态检测：从调度器单任务缓存读取（["scheduler","task",id]），
              // 避免依赖从未被填充的 ["tasks"] 死缓存键。
              const cachedTask = queryClient.getQueryData<Task>(
                queryKeys.schedulerTask(taskId),
              );
              const oldStatus = cachedTask?.status;

              if (oldStatus && oldStatus !== status) {
                frontendEventBus.publish("scheduler_task_status_changed", {
                  taskId,
                  oldStatus,
                  newStatus: status,
                  taskType: cachedTask?.task_type,
                });
              }

              // 调度器任务列表为多过滤器变体，无法精确 setQueryData，统一按
              // ["scheduler","tasks"] 前缀失效以刷新所有变体。
              queryClient.invalidateQueries({ queryKey: ["scheduler", "tasks"] });
              // 单任务详情失效（注意键为 ["scheduler","task",id]，非 ["task",id]）。
              queryClient.invalidateQueries({
                queryKey: queryKeys.schedulerTask(taskId),
              });
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
