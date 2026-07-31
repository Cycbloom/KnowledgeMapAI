import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "recent-notes";
const MAX_RECENT = 10;

export interface RecentNote {
  id: string;
  title: string;
  visitedAt: number; // 时间戳
}

function readStorage(): RecentNote[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as RecentNote[]) : [];
  } catch {
    return [];
  }
}

function writeStorage(notes: RecentNote[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

// 获取最近访问的笔记列表
export function getRecentNotes(): RecentNote[] {
  return readStorage();
}

// 添加最近访问的笔记（自动填充 visitedAt；相同 id 移到顶部并更新时间戳；超出 10 条截断）
export function addRecentNote(note: Omit<RecentNote, "visitedAt">): void {
  const recent = readStorage();
  // 移除已存在的相同 id 条目
  const filtered = recent.filter((r) => r.id !== note.id);
  // 添加到顶部
  filtered.unshift({
    id: note.id,
    title: note.title,
    visitedAt: Date.now(),
  });
  // 最多保存 MAX_RECENT 条
  writeStorage(filtered.slice(0, MAX_RECENT));
}

// 删除指定 id 的最近笔记条目
export function removeRecentNote(id: string): void {
  const recent = readStorage();
  const filtered = recent.filter((r) => r.id !== id);
  if (filtered.length !== recent.length) {
    writeStorage(filtered);
  }
}

// 清空所有最近笔记
export function clearRecentNotes(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function useRecentNotes() {
  const [recentNotes, setRecentNotes] = useState<RecentNote[]>(() =>
    getRecentNotes(),
  );

  // 挂载时同步 localStorage 到 state
  useEffect(() => {
    setRecentNotes(getRecentNotes());
  }, []);

  const addNote = useCallback((note: Omit<RecentNote, "visitedAt">) => {
    addRecentNote(note);
    setRecentNotes(getRecentNotes());
  }, []);

  const removeNote = useCallback((id: string) => {
    removeRecentNote(id);
    setRecentNotes(getRecentNotes());
  }, []);

  const clearNotes = useCallback(() => {
    clearRecentNotes();
    setRecentNotes([]);
  }, []);

  return {
    recentNotes,
    addRecentNote: addNote,
    removeRecentNote: removeNote,
    clearRecentNotes: clearNotes,
  };
}