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
  /** 防抖实时检查（跟随输入过程，供即时反馈场景使用），不返回结果 */
  checkTopic: (topic: string) => void;
  /** 立即执行一次检查并返回是否重复，供「点击提交时再查重」的场景 await */
  checkTopicNow: (topic: string) => Promise<boolean>;
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

  const checkTopicNow = useCallback(
    async (topic: string): Promise<boolean> => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      if (!topic.trim() || topic.trim().length < minLength) {
        setIsDuplicate(false);
        setSimilarGraphs([]);
        return false;
      }

      setIsChecking(true);
      try {
        abortControllerRef.current = new AbortController();
        const result = await graphsApi.checkTopic(topic.trim(), excludeGraphId);
        setIsDuplicate(result.is_duplicate);
        setSimilarGraphs(result.similar_graphs);
        return result.is_duplicate;
      } catch (error: unknown) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Failed to check topic:', error);
        }
        setIsDuplicate(false);
        return false;
      } finally {
        setIsChecking(false);
      }
    },
    [minLength, excludeGraphId],
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
    checkTopicNow,
    reset,
  };
}
