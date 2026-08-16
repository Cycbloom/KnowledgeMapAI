import { useCallback, useMemo, useState } from "react";

export interface ListSelectionState {
  selectedCount: number;
  isAllSelected: boolean;
  isPartialSelected: boolean;
}

export interface UseListSelectionResult {
  /** 当前选中的 id 集合（可直接用于行级 isSelected 判断或批量操作取数） */
  selectedIds: Set<string>;
  /** 直接替换选中集合（批量删除成功后清空选中用） */
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectionState: ListSelectionState;
  /** 切换单条选中态 */
  toggleId: (id: string) => void;
  /** 全选/取消全选（基于传入的可选 id 列表） */
  toggleSelectAll: () => void;
  /** 清空选中 */
  clear: () => void;
  /** 判断某 id 是否选中 */
  isSelected: (id: string) => boolean;
}

/**
 * 通用列表选择状态管理。
 * `ids` 为当前可见/可选的 id 列表（应来自调用方 useMemo 保持稳定），
 * 用于推导全选/半选状态，并作为全选的目标集合。
 */
export const useListSelection = (
  ids: readonly string[],
): UseListSelectionResult => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 单趟遍历统计选中数，避免 every/some/filter 的多趟扫描
  const selectionState = useMemo<ListSelectionState>(() => {
    let selectedCount = 0;
    for (const id of ids) {
      if (selectedIds.has(id)) selectedCount++;
    }
    const isAllSelected = ids.length > 0 && selectedCount === ids.length;
    const isPartialSelected = !isAllSelected && selectedCount > 0;
    return { selectedCount, isAllSelected, isPartialSelected };
  }, [ids, selectedIds]);

  const toggleId = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      // 已全选则清空；否则全选（含半选态点击后全选）
      if (prev.size > 0 && prev.size === ids.length && ids.length > 0) {
        return new Set();
      }
      return new Set(ids);
    });
  }, [ids]);

  const clear = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds],
  );

  return {
    selectedIds,
    setSelectedIds,
    selectionState,
    toggleId,
    toggleSelectAll,
    clear,
    isSelected,
  };
};