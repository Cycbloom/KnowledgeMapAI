// =====================================================
// Learning Material Chapter Schema Types
// =====================================================
// 用于可视化自由组合学习材料章节结构的共享类型

import type { Json } from "./database.generated";

/** 单个章节定义 */
export interface LearningMaterialSection {
  /** 章节唯一 ID（在 schema 内唯一） */
  id: string;
  /** 章节标题（将用作 Markdown 二级或三级标题） */
  title: string;
  /** 给 AI 的写作指令，描述该章节应该写什么内容 */
  instruction: string;
  /** 排序序号（从 1 开始） */
  order: number;
  /** 建议最小字数（AI 生成时的提示参考，非强制） */
  min_words?: number;
  /** 建议最大字数（AI 生成时的提示参考，非强制） */
  max_words?: number;
}

/** 作用域类型，复用 prompt_scope */
export type LearningSchemaScope = "system" | "user" | "graph";

/** 学习材料章节配置方案（数据库行） */
export interface LearningMaterialSchema {
  id: string;
  name: string;
  description: string | null;
  scope: LearningSchemaScope;
  user_id: string | null;
  graph_id: string | null;
  /** 章节数组 */
  sections: LearningMaterialSection[];
  /** 是否为该作用域的默认方案 */
  is_default: boolean;
  created_at: string | null;
  updated_at: string | null;
}

/** 创建 schema 入参 */
export interface LearningMaterialSchemaCreate {
  name: string;
  description?: string;
  scope: LearningSchemaScope;
  graph_id?: string;
  sections: LearningMaterialSection[];
  is_default?: boolean;
}

/** 更新 schema 入参 */
export interface LearningMaterialSchemaUpdate {
  name?: string;
  description?: string;
  sections?: LearningMaterialSection[];
  is_default?: boolean;
}

/** 查询列表过滤 */
export interface LearningMaterialSchemaListOptions {
  graph_id?: string;
  scope?: LearningSchemaScope;
}

/** 将数据库返回的 JSONB 安全解析为强类型 sections */
export function parseSections(raw: Json | LearningMaterialSection[] | null | undefined): LearningMaterialSection[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as LearningMaterialSection[];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? (parsed as LearningMaterialSection[]) : [];
  } catch {
    return [];
  }
}
