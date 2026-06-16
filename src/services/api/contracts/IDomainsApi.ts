import type { Domain } from "@shared/types/graph";

export interface DomainTreeNode {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  parent_id?: string | null;
  sort_order: number;
  is_system: boolean;
  children: DomainTreeNode[];
  graphCount?: number;
}

export interface IDomainsApi {
  getTree(): Promise<DomainTreeNode[]>;

  getById(domainId: string): Promise<Domain>;

  create(data: {
    name: string;
    color: string;
    description?: string;
    parent_id?: string;
    icon?: string;
  }): Promise<Domain>;

  update(
    domainId: string,
    data: {
      name?: string;
      color?: string;
      description?: string;
      parent_id?: string;
      icon?: string;
      sort_order?: number;
    },
  ): Promise<Domain>;

  delete(domainId: string): Promise<void>;

  ensureUncategorized(): Promise<{ id: string; name: string }>;

  reorder(data: {
    reorder_items: Array<{
      id: string;
      parent_id?: string | null;
      sort_order: number;
    }>;
  }): Promise<{ success: boolean; updated_count: number }>;

  generateColor(
    name: string,
    description?: string,
  ): Promise<{ color: string; reason: string }>;

  recommendDomains(
    title: string,
    description?: string,
  ): Promise<{
    recommendations: Array<{
      id: string;
      name: string;
      confidence: number;
      reason: string;
    }>;
  }>;
}

export interface IGraphDomainsApi {
  getByGraphId(graphId: string): Promise<Array<Domain & { is_primary: boolean }>>;

  updateByGraphId(
    graphId: string,
    domains: Array<{ domain_id: string; is_primary?: boolean }>,
  ): Promise<void>;
}
