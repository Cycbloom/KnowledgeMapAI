import { useCallback } from "react";

const STORAGE_KEY = "recent-graphs";
const MAX_RECENT = 5;

export interface RecentGraphEntry {
  id: string;
  topic: string;
  updated_at: string;
  is_favorite: boolean;
}

export function useRecentGraphs() {
  const getRecentGraphs = useCallback((): RecentGraphEntry[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }, []);

  const addRecentGraph = useCallback(
    (graph: {
      id: string;
      topic: string;
      updated_at?: string;
      is_favorite?: boolean;
    }) => {
      const recent = getRecentGraphs();
      // Remove if already exists
      const filtered = recent.filter((r) => r.id !== graph.id);
      // Add to front
      filtered.unshift({
        id: graph.id,
        topic: graph.topic,
        updated_at: graph.updated_at ?? new Date().toISOString(),
        is_favorite: graph.is_favorite ?? false,
      });
      // Keep only MAX_RECENT
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(filtered.slice(0, MAX_RECENT)),
      );
    },
    [getRecentGraphs],
  );

  // 删除指定 id 的最近编辑条目（用于图谱已被删除等场景的清理）
  const removeRecentGraph = useCallback((id: string) => {
    const recent = getRecentGraphs();
    const filtered = recent.filter((r) => r.id !== id);
    if (filtered.length !== recent.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    }
  }, [getRecentGraphs]);

  return { getRecentGraphs, addRecentGraph, removeRecentGraph };
}
