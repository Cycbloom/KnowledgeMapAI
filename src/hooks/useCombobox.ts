import { useState, useCallback } from 'react';

interface UseComboboxOptions<T> {
  /** 可选项列表 */
  options: T[];
  /** 下拉是否展开 */
  isOpen: boolean;
  /** 设置下拉展开状态 */
  setIsOpen: (open: boolean) => void;
  /** 选中某项时的回调 */
  onSelect: (option: T) => void;
  /** 根据索引返回选项对应的 DOM id，用于 aria-activedescendant */
  getOptionId: (index: number) => string;
  /** 根据选项返回展示标签（供消费方扩展使用，可选） */
  getOptionLabel?: (option: T) => string;
  /** 是否启用键盘导航，默认 true */
  enabled?: boolean;
}

interface UseComboboxReturn {
  /** 当前活动选项索引，null 表示无活动项 */
  activeIndex: number | null;
  /** 设置活动选项索引 */
  setActiveIndex: (index: number | null) => void;
  /** 活动选项的 DOM id（用于 aria-activedescendant），无活动项时为 undefined */
  activeId: string | undefined;
  /** 键盘事件处理函数 */
  handleKeyDown: (e: KeyboardEvent) => void;
  /** 重置活动项为 null */
  resetActive: () => void;
}

/**
 * 通用 Combobox 键盘导航 hook
 *
 * 实现 WAI-ARIA Authoring Practices 中 combobox 模式的键盘交互：
 * - ArrowDown：未展开则展开；已展开则活动项移到下一个（循环到最后一个后回到第一个）
 * - ArrowUp：未展开则展开并定位到最后一项；已展开则活动项移到上一个（循环到第一个后回到最后一个）
 * - Home：活动项移到第一个
 * - End：活动项移到最后一个
 * - Enter：执行当前活动项的 onSelect；无活动项则不操作
 * - Escape：关闭下拉并重置活动项
 */
export function useCombobox<T>({
  options,
  isOpen,
  setIsOpen,
  onSelect,
  getOptionId,
  enabled = true,
}: UseComboboxOptions<T>): UseComboboxReturn {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const resetActive = useCallback(() => {
    setActiveIndex(null);
  }, []);

  const activeId =
    activeIndex !== null ? getOptionId(activeIndex) : undefined;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      const count = options.length;

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
            return;
          }
          if (count === 0) return;
          setActiveIndex((prev) =>
            prev === null ? 0 : (prev + 1) % count,
          );
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
            setActiveIndex(count > 0 ? count - 1 : null);
            return;
          }
          if (count === 0) return;
          setActiveIndex((prev) =>
            prev === null ? count - 1 : (prev - 1 + count) % count,
          );
          break;
        }
        case 'Home': {
          if (!isOpen || count === 0) return;
          e.preventDefault();
          setActiveIndex(0);
          break;
        }
        case 'End': {
          if (!isOpen || count === 0) return;
          e.preventDefault();
          setActiveIndex(count - 1);
          break;
        }
        case 'Enter': {
          if (!isOpen || activeIndex === null) return;
          e.preventDefault();
          const option = options[activeIndex];
          if (option !== undefined) {
            onSelect(option);
          }
          break;
        }
        case 'Escape': {
          if (!isOpen) return;
          e.preventDefault();
          setIsOpen(false);
          setActiveIndex(null);
          break;
        }
        default:
          break;
      }
    },
    [enabled, isOpen, options, activeIndex, setIsOpen, onSelect],
  );

  return {
    activeIndex,
    setActiveIndex,
    activeId,
    handleKeyDown,
    resetActive,
  };
}
