import { useState, useEffect, useCallback } from 'react';

interface UseMenuNavigationOptions {
  /** 菜单项数量 */
  itemCount: number;
  /** 菜单是否打开/激活 */
  enabled: boolean;
  /** 选中项变化时的回调（可选） */
  onSelect?: (index: number) => void;
  /** 关闭回调（Escape 键） */
  onClose: () => void;
  /** 初始选中索引，默认 0 */
  initialIndex?: number;
}

/**
 * 通用菜单键盘导航 hook
 * 支持 ArrowUp/ArrowDown 上下移动、Enter 激活、Escape 关闭
 */
export function useMenuNavigation({
  itemCount,
  enabled,
  onSelect,
  onClose,
  initialIndex = 0,
}: UseMenuNavigationOptions) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  // 菜单打开时重置到初始索引
  useEffect(() => {
    if (enabled) {
      setActiveIndex(initialIndex);
    }
  }, [enabled, initialIndex]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled || itemCount === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((prev) => (prev + 1) % itemCount);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((prev) => (prev - 1 + itemCount) % itemCount);
          break;
        case 'Enter':
          e.preventDefault();
          if (onSelect) {
            onSelect(activeIndex);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [enabled, itemCount, activeIndex, onSelect, onClose]
  );

  // 全局监听 keydown（菜单打开时）
  useEffect(() => {
    if (!enabled) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);

  return { activeIndex, setActiveIndex };
}
