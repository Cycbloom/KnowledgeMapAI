import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "recent-nodes";
const MAX_RECENT = 10;

export interface RecentNode {
  id: string;
  title: string;
  graphId: string;
  graphTopic: string;
  visitedAt: number; // 时间戳
}

function readStorage(): RecentNode[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as RecentNode[]) : [];
  } catch {
    return [];
  }
}

function writeStorage(nodes: RecentNode[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes));
  } catch {
    // 写入失败时静默忽略
  }
}

export function getRecentNodes(): RecentNode[] {
  return readStorage();
}

export function addRecentNode(node: Omit<RecentNode, "visitedAt">): void {
  const recent = readStorage();
  // 去重：相同 id 移除后再插入顶部
  const filtered = recent.filter((r) => r.id !== node.id);
  filtered.unshift({ ...node, visitedAt: Date.now() });
  // 超出 MAX_RECENT 截断
  writeStorage(filtered.slice(0, MAX_RECENT));
}

export function removeRecentNode(id: string): void {
  const recent = readStorage();
  const filtered = recent.filter((r) => r.id !== id);
  if (filtered.length !== recent.length) {
    writeStorage(filtered);
  }
}

export function clearRecentNodes(): void {
  writeStorage([]);
}

export function useRecentNodes() {
  const [recentNodes, setRecentNodes] = useState<RecentNode[]>(() =>
    readStorage(),
  );

  // 监听跨标签页 storage 事件以保持状态同步
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setRecentNodes(readStorage());
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const addRecent = useCallback((node: Omit<RecentNode, "visitedAt">) => {
    addRecentNode(node);
    setRecentNodes(readStorage());
  }, []);

  const removeRecent = useCallback((id: string) => {
    removeRecentNode(id);
    setRecentNodes(readStorage());
  }, []);

  const clearRecent = useCallback(() => {
    clearRecentNodes();
    setRecentNodes([]);
  }, []);

  return {
    recentNodes,
    addRecentNode: addRecent,
    removeRecentNode: removeRecent,
    clearRecentNodes: clearRecent,
  };
}