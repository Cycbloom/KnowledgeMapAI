import type { StudyCard } from "./common";
import type { QuizSet, QuizSetCard } from "./quiz";

/** 离线数据包当前版本号。bundle.version 高于本地已导入版本时触发内容表刷新。 */
export const OFFLINE_BUNDLE_VERSION = 1;

/** 知识图谱表行（离线数据包内透传的原始行，title/description 为语言 key 化 JSONB 或标量） */
export interface OfflineGraphRow {
  id: string;
  user_id: string;
  title: unknown;
  description?: unknown;
  domain?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
  [key: string]: unknown;
}

/** 知识点表行（title/summary 为语言 key 化 JSONB 或标量） */
export interface OfflineKnowledgePointRow {
  id: string;
  owner_id: string;
  title: unknown;
  content?: unknown;
  summary?: unknown;
  mastery_level?: number | null;
  last_study_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

/** graph_nodes 表行（图谱节点关联，离线组装 Node 用） */
export interface OfflineGraphNodeRow {
  id: string;
  graph_id: string;
  knowledge_point_id: string;
  x_position: number;
  y_position: number;
  level: string;
  is_accepted: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
  [key: string]: unknown;
}

/** edges 表行（图谱边，离线大纲展示用） */
export interface OfflineEdgeRow {
  id: string;
  graph_id: string;
  source_knowledge_point_id?: string | null;
  target_knowledge_point_id?: string | null;
  relationship_type?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
  [key: string]: unknown;
}

/** 数据包归属用户（离线版本地身份与 FSRS 参数来源） */
export interface OfflineOwner {
  id: string;
  email: string;
  name?: string | null;
  level?: number | null;
  xp?: number | null;
  settings?: Record<string, unknown> | null;
}

/** 电脑端导出、随 APK 内置的离线学习数据包 */
export interface OfflineBundle {
  version: number;
  exportedAt: string;
  owner: OfflineOwner;
  graphs: OfflineGraphRow[];
  knowledgePoints: OfflineKnowledgePointRow[];
  graphNodes: OfflineGraphNodeRow[];
  edges: OfflineEdgeRow[];
  studyCards: StudyCard[];
  quizSets: QuizSet[];
  quizSetCards: QuizSetCard[];
}
