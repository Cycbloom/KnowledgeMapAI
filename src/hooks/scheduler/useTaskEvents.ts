import { useEffect, useRef, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { EventSourcePolyfill } from 'event-source-polyfill';
import { useStore } from '../../store/useStore';
import { Task } from '../../types';
import { isElectronProduction, getElectronApiUrl } from '../../config/electronConfig';

const SSE_HEARTBEAT_TIMEOUT = 300000;
const SSE_RECONNECT_DELAY_BASE = 1000;
const SSE_RECONNECT_MAX_ATTEMPTS = 10;

export const useTaskEvents = () => {
  const queryClient = useQueryClient();
  const token = useStore((state) => state.token);
  const setSSEStatus = useStore((state) => state.setSSEStatus);
  const [apiUrl, setApiUrl] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSourcePolyfill | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const connectRef = useRef<((isReconnect?: boolean) => void) | null>(null);
  const lastActivityRef = useRef<number>(0);
  const wasHiddenRef = useRef<boolean>(false);

  useEffect(() => {
    const initApiUrl = async () => {
      if (isElectronProduction()) {
        const url = await getElectronApiUrl();
        setApiUrl(url);
      } else {
        setApiUrl('/api');
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

  const connect = useCallback((isReconnect = false) => {
    if (!token) {
      console.warn('[SSE] No token available, skipping connection');
      return;
    }
    if (!apiUrl) {
      console.warn('[SSE] API URL not ready, skipping connection');
      return;
    }

    cleanup();
    setSSEStatus('connecting');
    
    if (!isReconnect) {
      reconnectAttemptsRef.current = 0;
    }
    lastActivityRef.current = Date.now();

    const sseUrl = `${apiUrl}/tasks/events`;
    console.info('[SSE] Attempting to connect to', sseUrl);

    try {
      const es = new EventSourcePolyfill(sseUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        heartbeatTimeout: SSE_HEARTBEAT_TIMEOUT,
        withCredentials: true
      });

      eventSourceRef.current = es;

      es.onopen = () => {
        console.info('[SSE] Connection established successfully');
        setSSEStatus('connected');
        reconnectAttemptsRef.current = 0;
        lastActivityRef.current = Date.now();
      };

      es.onmessage = (event) => {
        lastActivityRef.current = Date.now();
        
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'connected') {
            console.info('[SSE] Connected message:', data.message);
            return;
          }

          if (data.type === 'task_update') {
            const { taskId, status, result, error } = data;
            console.info(`[SSE] Task Update: ${taskId} -> ${status}`);

            queryClient.setQueryData(['tasks'], (oldTasks: Task[] | undefined) => {
              if (!oldTasks) return [];
              
              const existingTaskIndex = oldTasks.findIndex(t => t.id === taskId);
              
              if (existingTaskIndex !== -1) {
                const newTasks = [...oldTasks];
                newTasks[existingTaskIndex] = {
                  ...newTasks[existingTaskIndex],
                  status,
                  result: result !== undefined ? result : newTasks[existingTaskIndex].result,
                  error: error !== undefined ? error : newTasks[existingTaskIndex].error,
                  updated_at: new Date().toISOString()
                };
                return newTasks;
              } else {
               queryClient.invalidateQueries({ queryKey: ['tasks'] });
               return oldTasks;
              }
            });
            
            queryClient.invalidateQueries({ queryKey: ['task', taskId] });
          }

        } catch (err) {
          console.error('[SSE] Error parsing message:', err);
        }
      };

      es.onerror = (err) => {
        console.error('[SSE] Connection error:', err);
        
        const errorStatus = (err as { status?: number; type?: string })?.status;
        const errorType = (err as { status?: number; type?: string })?.type;

        if (errorStatus === 401 || errorType === 'authorization') {
          console.error('[SSE] Authentication failed, closing connection');
          setSSEStatus('error', 'Authentication failed. Please login again.');
          cleanup();
          return;
        }

        if (reconnectAttemptsRef.current < SSE_RECONNECT_MAX_ATTEMPTS) {
          reconnectAttemptsRef.current++;
          const delay = SSE_RECONNECT_DELAY_BASE * Math.pow(2, Math.min(reconnectAttemptsRef.current - 1, 5));
          
          console.info(`[SSE] Reconnection attempt ${reconnectAttemptsRef.current}/${SSE_RECONNECT_MAX_ATTEMPTS} in ${delay}ms`);
          setSSEStatus('connecting', `Reconnecting... (${reconnectAttemptsRef.current}/${SSE_RECONNECT_MAX_ATTEMPTS})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (connectRef.current) {
              connectRef.current(true);
            }
          }, delay);
        } else {
          console.error('[SSE] Max reconnection attempts reached');
          setSSEStatus('error', 'Connection failed. Please refresh the page.');
          cleanup();
        }
      };

    } catch (error) {
      console.error('[SSE] Failed to create EventSource:', error);
      setSSEStatus('error', 'Failed to establish connection');
      cleanup();
    }
  }, [token, apiUrl, queryClient, setSSEStatus, cleanup]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && wasHiddenRef.current) {
        wasHiddenRef.current = false;
        const timeSinceLastActivity = Date.now() - lastActivityRef.current;
        const connectionStale = timeSinceLastActivity > 60000;
        
        if (connectionStale || !eventSourceRef.current) {
          console.info('[SSE] Page became visible, reconnecting stale connection');
          reconnectAttemptsRef.current = 0;
          connect();
        }
      } else if (document.visibilityState === 'hidden') {
        wasHiddenRef.current = true;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [connect]);

  useEffect(() => {
    if (!token) {
      cleanup();
      setSSEStatus('disconnected');
      return;
    }
    if (!apiUrl) {
      return;
    }

    connect();

    return () => {
      cleanup();
      setSSEStatus('disconnected');
      console.info('[SSE] Connection closed');
    };
  }, [token, apiUrl, connect, cleanup, setSSEStatus]);
};
