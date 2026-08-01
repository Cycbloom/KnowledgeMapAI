// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSearch } from '../useSearch';

// 使用相对路径 mock，与 useSearch.ts 中的 import 路径匹配
vi.mock('../../../services/api/search', () => ({
  searchApi: {
    search: vi.fn().mockResolvedValue({ graphs: [], nodes: [], notes: [] }),
    semanticSearch: vi.fn().mockResolvedValue({ graphs: [], nodes: [], notes: [] }),
  },
}));

import { searchApi } from '../../../services/api/search';

describe('useSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('setQuery 应更新 query 状态', () => {
    const { result } = renderHook(() => useSearch());

    act(() => {
      result.current.setQuery('test');
    });

    expect(result.current.query).toBe('test');
  });

  it('clear 应将 query 重置为空字符串', () => {
    const { result } = renderHook(() => useSearch());

    act(() => {
      result.current.setQuery('test');
    });
    expect(result.current.query).toBe('test');

    act(() => {
      result.current.clear();
    });
    expect(result.current.query).toBe('');
  });

  it('查询更新后应在防抖延迟后触发搜索回调', () => {
    const { result } = renderHook(() => useSearch());

    act(() => {
      result.current.setQuery('test');
    });

    // 防抖期内搜索不应被调用
    expect(searchApi.search).not.toHaveBeenCalled();

    // 推进 300ms（默认防抖延迟）
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // 防抖结束后应调用 searchApi.search
    expect(searchApi.search).toHaveBeenCalledWith('test');
  });
});