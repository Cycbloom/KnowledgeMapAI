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

export function getPaginationParams(options?: PaginationOptions): PaginationResult {
  const limit = options?.limit ?? DEFAULT_PAGE_SIZE;
  const offset = options?.offset ?? 0;
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
