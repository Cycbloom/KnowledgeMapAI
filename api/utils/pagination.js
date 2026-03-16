export const DEFAULT_PAGE_SIZE = 20;
export function getPaginationParams(options) {
    const limit = options?.limit ?? DEFAULT_PAGE_SIZE;
    const offset = options?.offset ?? 0;
    return {
        limit,
        offset,
        end: offset + limit - 1,
    };
}
export function buildPaginationQuery(query, options) {
    const { offset, end } = getPaginationParams(options);
    return query.range(offset, end);
}
//# sourceMappingURL=pagination.js.map