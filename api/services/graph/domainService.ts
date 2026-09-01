import { SupabaseClient } from "@supabase/supabase-js";
import { DomainCrudService } from "./domainCrudService";
import { DomainAiService } from "./domainAiService";

// 类型 re-export：保持既有调用方从本文件导入类型
export type {
  DomainRecord,
  DomainTreeNode,
  AutoClassifiedDomain,
  AutoClassifyGraphInfo,
} from "./domainShared";
export {
  buildTree,
  detectCycle,
  ensureUncategorizedDomain,
} from "./domainShared";

/**
 * 领域服务：对外聚合入口（对象字面量，保持既有调用方式）。
 * 实现按职责拆分为 DomainCrudService / DomainAiService。
 */
const crudService = new DomainCrudService();
const aiService = new DomainAiService(crudService);

export const domainService = {
  // ── Delegated to DomainCrudService ──
  async listDomainsTree(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<import("./domainShared").DomainTreeNode[]> {
    return crudService.listDomainsTree(supabase, userId);
  },

  async getDomain(
    supabase: SupabaseClient,
    id: string,
    userId: string,
  ): Promise<import("./domainShared").DomainRecord & { graphCount: number; children: unknown[] }> {
    return crudService.getDomain(supabase, id, userId);
  },

  async createDomain(
    supabase: SupabaseClient,
    userId: string,
    data: {
      name: string;
      color: string;
      description?: string;
      parent_id?: string | null;
      icon?: string;
    },
  ): Promise<import("./domainShared").DomainRecord> {
    return crudService.createDomain(supabase, userId, data);
  },

  async updateDomain(
    supabase: SupabaseClient,
    id: string,
    userId: string,
    data: {
      name?: string;
      description?: string;
      color?: string;
      icon?: string;
      parent_id?: string | null;
      sort_order?: number;
    },
  ): Promise<import("./domainShared").DomainRecord> {
    return crudService.updateDomain(supabase, id, userId, data);
  },

  async deleteDomain(
    supabase: SupabaseClient,
    id: string,
    userId: string,
  ): Promise<void> {
    return crudService.deleteDomain(supabase, id, userId);
  },

  async reorderDomains(
    supabase: SupabaseClient,
    userId: string,
    items: Array<{ id: string; parent_id?: string | null; sort_order: number }>,
  ): Promise<{ success: boolean; updated_count: number }> {
    return crudService.reorderDomains(supabase, userId, items);
  },

  async ensureUncategorizedDomain(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<string> {
    return crudService.ensureUncategorizedDomain(supabase, userId);
  },

  // ── Delegated to DomainAiService ──
  async generateColor(
    name: string,
    description?: string,
  ): Promise<{ color: string; reason: string }> {
    return aiService.generateColor(name, description);
  },

  async recommendDomains(
    supabase: SupabaseClient,
    userId: string,
    title: string,
    description?: string,
  ): Promise<{
    recommendations: Array<{
      id: string;
      name: string;
      confidence: number;
      reason: string;
    }>;
  }> {
    return aiService.recommendDomains(supabase, userId, title, description);
  },

  async autoClassifyGraphs(
    supabase: SupabaseClient,
    userId: string,
    options?: { graph_ids?: string[]; max_domains?: number },
  ): Promise<{ domains: import("./domainShared").AutoClassifiedDomain[]; graphs: import("./domainShared").AutoClassifyGraphInfo[] }> {
    return aiService.autoClassifyGraphs(supabase, userId, options);
  },

  async applyClassifiedDomains(
    supabase: SupabaseClient,
    userId: string,
    items: Array<{
      name: string;
      description?: string;
      color?: string;
      graph_ids: string[];
    }>,
  ): Promise<{
    created: Array<{ id: string; name: string; graphCount: number }>;
  }> {
    return aiService.applyClassifiedDomains(supabase, userId, items);
  },
};
