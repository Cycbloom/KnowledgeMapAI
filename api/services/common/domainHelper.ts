import type { SupabaseClient } from '@supabase/supabase-js';

interface GraphDomainWithDomain {
  graph_id: string;
  is_primary: boolean;
  domains: { name: string; deleted_at: string | null } | null;
}

/**
 * 获取图谱主领域名称映射。
 * 从 graph_domains + domains 关联表读取主领域（is_primary = true）名称，
 * 替代已废弃的 knowledge_graphs.domain 列。
 *
 * 若图谱无 is_primary = true 的领域，则回退到第一个关联领域。
 *
 * @returns Map<graphId, domainName>
 */
export async function fetchPrimaryDomainMap(
  supabase: SupabaseClient,
  graphIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (graphIds.length === 0) return map;

  const { data, error } = await supabase
    .from('graph_domains')
    .select('graph_id, is_primary, domains(name, deleted_at)')
    .in('graph_id', graphIds);

  if (error || !data) return map;

  const rows = data as unknown as GraphDomainWithDomain[];

  for (const row of rows) {
    const domain = row.domains;
    if (!domain || !domain.name || domain.deleted_at !== null) continue;
    if (row.is_primary) {
      map.set(row.graph_id, domain.name);
    } else if (!map.has(row.graph_id)) {
      map.set(row.graph_id, domain.name);
    }
  }

  return map;
}

/**
 * 获取单个图谱的主领域名称。
 */
export async function fetchPrimaryDomain(
  supabase: SupabaseClient,
  graphId: string,
): Promise<string | null> {
  const map = await fetchPrimaryDomainMap(supabase, [graphId]);
  return map.get(graphId) ?? null;
}
