// 领域（Domain）相关类型
// Domain, DomainTreeNode, GraphDomain

export interface Domain {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  parent_id?: string | null;
  sort_order: number;
  user_id?: string;
  is_system: boolean;
  children?: DomainTreeNode[];
  graphCount?: number;
  created_at: string;
  updated_at: string;
}

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

export interface GraphDomain {
  id: string;
  graph_id: string;
  domain_id: string;
  is_primary: boolean;
  created_at: string;
}
