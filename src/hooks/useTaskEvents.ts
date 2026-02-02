import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { EventSourcePolyfill } from 'event-source-polyfill';
import { useStore } from '../store/useStore';
import { Task } from '../types';

export const useTaskEvents = () => {
  const queryClient = useQueryClient();
  const token = useStore((state) => state.token);
  const setSSEStatus = useStore((state) => state.setSSEStatus);
  const eventSourceRef = useRef<EventSourcePolyfill | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000;

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

  const connect = useCallback(() => {
    if (!token) {
      console.warn('[SSE] No token available, skipping connection');
      return;
    }

    cleanup();
    setSSEStatus('connecting');
    reconnectAttemptsRef.current = 0;

    console.log('[SSE] Attempting to connect to /api/tasks/events');

    try {
      const es = new EventSourcePolyfill('/api/tasks/events', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        heartbeatTimeout: 120000,
        withCredentials: true
      });

      eventSourceRef.current = es;

      es.onopen = () => {
        console.log('[SSE] Connection established successfully');
        setSSEStatus('connected');
        reconnectAttemptsRef.current = 0;
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'connected') {
            console.log('[SSE] Connected message:', data.message);
            return;
          }

          if (data.type === 'task_update') {
            const { taskId, status, result, error } = data;
            console.log(`[SSE] Task Update: ${taskId} -> ${status}`);

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

        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          const delay = baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current - 1);
          
          console.log(`[SSE] Reconnection attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts} in ${delay}ms`);
          setSSEStatus('connecting', `Reconnecting... (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
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
  }, [token, queryClient, setSSEStatus, cleanup]);

  useEffect(() => {
    if (!token) {
      cleanup();
      setSSEStatus('disconnected');
      return;
    }

    connect();

    return () => {
      cleanup();
      setSSEStatus('disconnected');
      console.log('[SSE] Connection closed');
    };
  }, [token, connect, cleanup, setSSEStatus]);
};
