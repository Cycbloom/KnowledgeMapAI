import { useState } from 'react';

export type SidebarMode = 'none' | 'create' | 'edit' | 'outline' | 'detail';

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
  const [sidebarWidth, setSidebarWidth] = useState(340);

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
