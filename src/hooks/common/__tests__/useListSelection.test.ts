// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useListSelection } from "../useListSelection";

const IDs = ["a", "b", "c", "d"];

describe("useListSelection", () => {
  it("初始无选中时:selectedCount 为 0,非全选非半选", () => {
    const { result } = renderHook(() => useListSelection(IDs));
    expect(result.current.selectionState).toEqual({
      selectedCount: 0,
      isAllSelected: false,
      isPartialSelected: false,
    });
  });

  it("toggleId 切换单条选中态", () => {
    const { result } = renderHook(() => useListSelection(IDs));
    act(() => result.current.toggleId("a"));
    expect(result.current.isSelected("a")).toBe(true);
    expect(result.current.selectedIds).toEqual(new Set(["a"]));
    act(() => result.current.toggleId("a"));
    expect(result.current.isSelected("a")).toBe(false);
    expect(result.current.selectedIds).toEqual(new Set());
  });

  it("部分选中时:isPartialSelected 为 true,isAllSelected 为 false", () => {
    const { result } = renderHook(() => useListSelection(IDs));
    act(() => {
      result.current.toggleId("a");
      result.current.toggleId("b");
    });
    expect(result.current.selectionState.selectedCount).toBe(2);
    expect(result.current.selectionState.isAllSelected).toBe(false);
    expect(result.current.selectionState.isPartialSelected).toBe(true);
  });

  it("全选后:toggleSelectAll 取消全选,selectionState 归零", () => {
    const { result } = renderHook(() => useListSelection(IDs));
    act(() => result.current.toggleSelectAll());
    expect(result.current.selectionState.isAllSelected).toBe(true);
    expect(result.current.selectionState.isPartialSelected).toBe(false);
    expect(result.current.selectedIds).toEqual(new Set(IDs));
    act(() => result.current.toggleSelectAll());
    expect(result.current.selectionState.selectedCount).toBe(0);
    expect(result.current.selectionState.isAllSelected).toBe(false);
  });

  it("半选状态下点击全选:切换为全选", () => {
    const { result } = renderHook(() => useListSelection(IDs));
    act(() => result.current.toggleId("a"));
    expect(result.current.selectionState.isPartialSelected).toBe(true);
    act(() => result.current.toggleSelectAll());
    expect(result.current.selectionState.isAllSelected).toBe(true);
  });

  it("clear 清空全部选中", () => {
    const { result } = renderHook(() => useListSelection(IDs));
    act(() => result.current.toggleSelectAll());
    act(() => result.current.clear());
    expect(result.current.selectedIds).toEqual(new Set());
    expect(result.current.selectionState.selectedCount).toBe(0);
  });

  it("setSelectedIds 直接替换选中集合", () => {
    const { result } = renderHook(() => useListSelection(IDs));
    act(() => result.current.setSelectedIds(new Set(["b", "d"])));
    expect(result.current.selectedIds).toEqual(new Set(["b", "d"]));
    expect(result.current.selectionState.selectedCount).toBe(2);
  });
});