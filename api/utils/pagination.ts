export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

export interface PaginationResult {
  limit: number;
  offset: number;
  end: number;
}

export const DEFAULT_PAGE_SIZE = 20;

/** 单页最大条数，防止非法 limit 导致资源耗尽 */
export const MAX_PAGE_SIZE = 100;

export function getPaginationParams(options?: PaginationOptions): PaginationResult {
  const limit = Math.min(Math.max(options?.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const offset = Math.max(options?.offset ?? 0, 0);
  return {
    limit,
    offset,
    end: offset + limit - 1,
  };
}

interface RangeableQuery<T> {
  range(from: number, to: number): T;
}

export function buildPaginationQuery<T extends RangeableQuery<T>>(
  query: T,
  options?: PaginationOptions
): T {
  const { offset, end } = getPaginationParams(options);
  return query.range(offset, end);
}
