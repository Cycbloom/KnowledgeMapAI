import { useEffect, useState } from 'react';

export type SidebarMode = 'none' | 'create' | 'edit' | 'outline' | 'detail';

const SIDEBAR_WIDTH_KEY = 'graphEditor.sidebarWidth';
const DEFAULT_WIDTH = 340;
const MIN = 300;
const MAX = 800;

const clampWidth = (v: number) => Math.min(Math.max(v, MIN), MAX);

function readInitialWidth(): number {
  if (typeof window === 'undefined') return DEFAULT_WIDTH;
  const raw = window.localStorage.getItem(SIDEBAR_WIDTH_KEY);
  if (!raw) return DEFAULT_WIDTH;
  const n = Number(raw);
  if (Number.isNaN(n)) return DEFAULT_WIDTH;
  return clampWidth(n);
}

const WIDTH_STORAGE_FALLBACK = readInitialWidth(); // 模块级求值

export interface SidebarState {
  sidebarMode: SidebarMode;
  setSidebarMode: React.Dispatch<React.SetStateAction<SidebarMode>>;
  prevSidebarMode: SidebarMode;
  setPrevSidebarMode: React.Dispatch<React.SetStateAction<SidebarMode>>;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  sidebarWidth: number;
  setSidebarWidth: React.Dispatch<React.SetStateAction<number>>;
}

export const useSidebarState = (): SidebarState => {
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('none');
  const [prevSidebarMode, setPrevSidebarMode] = useState<SidebarMode>('none');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState<number>(WIDTH_STORAGE_FALLBACK);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth));
    } catch {
      /* 忽略存储失败 */
    }
  }, [sidebarWidth]);

  return {
    sidebarMode,
    setSidebarMode,
    prevSidebarMode,
    setPrevSidebarMode,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    sidebarWidth,
    setSidebarWidth,
  };
};
