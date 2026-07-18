import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { graphsApi, TopicCheckResult } from '../../services/api/graphs';
import { debounce } from '@/utils/performanceUtils';

interface UseTopicCheckOptions {
  debounceMs?: number;
  minLength?: number;
  excludeGraphId?: string;
}

interface UseTopicCheckResult {
  isChecking: boolean;
  isDuplicate: boolean;
  similarGraphs: TopicCheckResult['similar_graphs'];
  checkTopic: (topic: string) => void;
  reset: () => void;
}

export function useTopicCheck(options: UseTopicCheckOptions = {}): UseTopicCheckResult {
  const { debounceMs = 500, minLength = 2, excludeGraphId } = options;
  
  const [isChecking, setIsChecking] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [similarGraphs, setSimilarGraphs] = useState<TopicCheckResult['similar_graphs']>([]);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const debouncedCheck = useMemo(
    () =>
      debounce(async (topic: string) => {
        setIsChecking(true);

        try {
          abortControllerRef.current = new AbortController();
          const result = await graphsApi.checkTopic(topic.trim(), excludeGraphId);

          setIsDuplicate(result.is_duplicate);
          setSimilarGraphs(result.similar_graphs);
        } catch (error: unknown) {
          if (error instanceof Error && error.name !== 'AbortError') {
            console.error('Failed to check topic:', error);
          }
        } finally {
          setIsChecking(false);
        }
      }, debounceMs),
    [debounceMs, excludeGraphId],
  );

  const checkTopic = useCallback(
    async (topic: string) => {
      debouncedCheck.cancel();

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      if (!topic.trim() || topic.trim().length < minLength) {
        setIsDuplicate(false);
        setSimilarGraphs([]);
        return;
      }

      debouncedCheck(topic);
    },
    [debouncedCheck, minLength],
  );

  const reset = useCallback(() => {
    setIsDuplicate(false);
    setSimilarGraphs([]);
    setIsChecking(false);
  }, []);

  useEffect(() => {
    return () => {
      debouncedCheck.cancel();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [debouncedCheck]);

  return {
    isChecking,
    isDuplicate,
    similarGraphs,
    checkTopic,
    reset,
  };
}
