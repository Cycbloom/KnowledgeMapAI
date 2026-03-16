export async function softDelete(supabase, table, id) {
    const { error } = await supabase
        .from(table)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, count: 1 };
}
export async function softDeleteBatch(supabase, table, ids) {
    if (!ids || ids.length === 0) {
        return { success: true, count: 0 };
    }
    const { error, count } = await supabase
        .from(table)
        .update({ deleted_at: new Date().toISOString() })
        .in('id', ids);
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, count: count ?? ids.length };
}
export async function softDeleteByCondition(supabase, table, condition) {
    if (!condition || Object.keys(condition).length === 0) {
        return { success: false, error: 'Condition cannot be empty' };
    }
    let query = supabase
        .from(table)
        .update({ deleted_at: new Date().toISOString() });
    for (const [key, value] of Object.entries(condition)) {
        query = query.eq(key, value);
    }
    const { error, count } = await query;
    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true, count: count ?? 0 };
}
//# sourceMappingURL=softDelete.js.map