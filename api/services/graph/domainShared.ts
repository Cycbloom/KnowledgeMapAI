import { SupabaseClient } from "@supabase/supabase-js";

// 余弦相似度：用于领域名 embedding 语义去重
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export interface DomainRecord {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  parent_id: string | null;
  sort_order: number;
  user_id: string;
  is_system: boolean;
  deleted_at: string | null;
  created_at: string;
}

export interface DomainTreeNode extends DomainRecord {
  children: DomainTreeNode[];
  graphCount?: number;
}

// 自动分类：候选领域（一个图谱可同时出现在多个领域，多对多）
export interface AutoClassifiedDomain {
  suggestion_id: string;
  name: string;
  description: string;
  graph_ids: string[];
  graph_titles: string[];
}

export interface AutoClassifyGraphInfo {
  id: string;
  title: string;
  description: string;
  existing_domains: string[];
}

export function buildTree(domains: DomainRecord[]): DomainTreeNode[] {
  const domainMap = new Map<string, DomainTreeNode>();
  const roots: DomainTreeNode[] = [];

  domains.forEach((domain) => {
    domainMap.set(domain.id, { ...domain, children: [] });
  });

  domains.forEach((domain) => {
    const node = domainMap.get(domain.id);
    if (!node) return;
    if (domain.parent_id && domainMap.has(domain.parent_id)) {
      const parent = domainMap.get(domain.parent_id);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  });

  roots.sort((a, b) => a.sort_order - b.sort_order);
  const sortChildren = (nodes: DomainTreeNode[]) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order);
    nodes.forEach((n) => sortChildren(n.children));
  };
  sortChildren(roots);

  return roots;
}

export function detectCycle(
  items: Array<{ id: string; parent_id?: string | null }>,
): boolean {
  const graph = new Map<string, string | null>();
  items.forEach((item) => {
    graph.set(item.id, item.parent_id ?? null);
  });

  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(nodeId: string, path: string[]): boolean {
    if (recursionStack.has(nodeId)) {
      return true;
    }

    if (visited.has(nodeId)) {
      return false;
    }

    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const parent = graph.get(nodeId);
    if (parent && graph.has(parent)) {
      if (dfs(parent, path)) {
        return true;
      }
    }

    path.pop();
    recursionStack.delete(nodeId);
    return false;
  }

  for (const nodeId of graph.keys()) {
    visited.clear();
    recursionStack.clear();
    if (dfs(nodeId, [])) {
      return true;
    }
  }

  return false;
}

export const UNCATEGORIZED_DOMAIN_ICON = "FolderOpen";
export const UNCATEGORIZED_DOMAIN_COLOR = "#94A3B8";
// 后端 i18next 无翻译资源，i18next.t() 对缺失 key 会原样返回 key 字符串，
// 不能用于写入数据库的文案；系统内置领域文案用常量硬编码（与路由一致）。
export const UNCATEGORIZED_DOMAIN_NAME = "未分类";
export const UNCATEGORIZED_DOMAIN_DESCRIPTION = "未归类到任何领域的图谱";

export async function ensureUncategorizedDomain(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from("domains")
    .select("id")
    .eq("is_system", true)
    .eq("icon", UNCATEGORIZED_DOMAIN_ICON)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: newDomain, error } = await supabase
    .from("domains")
    .insert({
      name: UNCATEGORIZED_DOMAIN_NAME,
      description: UNCATEGORIZED_DOMAIN_DESCRIPTION,
      color: UNCATEGORIZED_DOMAIN_COLOR,
      icon: UNCATEGORIZED_DOMAIN_ICON,
      is_system: true,
      user_id: userId,
    })
    .select("id")
    .single();

  if (error) throw error;
  return newDomain.id;
}
