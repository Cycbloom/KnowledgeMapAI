import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { EventSourcePolyfill } from 'event-source-polyfill';
import { useStore } from '../store/useStore';
import { Task } from '../types';

export const useTaskEvents = () => {
  const queryClient = useQueryClient();
  const token = useStore((state) => state.token);
  const eventSourceRef = useRef<EventSourcePolyfill | null>(null);

  useEffect(() => {
    if (!token) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    // Initialize EventSource with Auth Header
    const es = new EventSourcePolyfill('/api/tasks/events', {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      heartbeatTimeout: 120000 // 2 minutes
    });

    eventSourceRef.current = es;

    es.onopen = () => {
      console.log('[SSE] Connection established');
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

          // Update React Query Cache directly
          queryClient.setQueryData(['tasks'], (oldTasks: Task[] | undefined) => {
            if (!oldTasks) return [];
            
            // Find and update the task
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
               // If task not found (e.g. newly created by another client?), fetch list?
               // Ideally we should have the task in list if it was created recently.
               // For now, let's just invalidate to be safe if not found.
               queryClient.invalidateQueries({ queryKey: ['tasks'] });
               return oldTasks;
            }
          });
          
          // Also invalidate 'task' detail query if it exists
          queryClient.invalidateQueries({ queryKey: ['task', taskId] });
        }

      } catch (err) {
        console.error('[SSE] Error parsing message:', err);
      }
    };

    es.onerror = (err) => {
      console.error('[SSE] Connection error:', err);
      // EventSourcePolyfill automatically attempts to reconnect,
      // but if 401, we should probably close it.
      if ((err as any)?.status === 401) {
        es.close();
      }
    };

    return () => {
      es.close();
      console.log('[SSE] Connection closed');
    };
  }, [token, queryClient]);
};
