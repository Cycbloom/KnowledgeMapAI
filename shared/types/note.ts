// 块编辑器 + Daily Notes 相关类型
// 对应数据库表: notes / note_node_links / note_templates (见 supabase/migrations/32_notes.sql)
//
// 注意: 字段采用 camelCase（与 backlink.ts 等现有类型风格一致）。
//   运行 npm run db:gen-types 后，shared/types/database.generated.ts 会生成
//   notes / note_node_links / note_templates 的 Row/Insert/Update 类型，
//   本文件中的手写类型可与生成类型的 Row 形态对齐使用。

/**
 * 笔记类型
 * - note: 普通笔记（读书笔记 / 主题笔记）
 * - daily: 每日反思（Daily Notes，按日期唯一）
 */
export type NoteType = 'note' | 'daily';

/**
 * 笔记实体（对应 notes 表 Row）
 */
export interface Note {
  /** 主键 UUID */
  id: string;
  /** 所属用户 ID（RLS 隔离） */
  userId: string;
  /** 笔记标题（daily 自动生成如 "2026-07-03 学习日志"） */
  title: string;
  /** Markdown 正文（块编辑器落盘内容） */
  content: string;
  /** 笔记类型 */
  type: NoteType;
  /** 对应日期（YYYY-MM-DD），仅 daily 使用 */
  date: string | null;
  /** 生成时所用模板 ID，引用 note_templates.id */
  templateId: string | null;
  /** 标签数组，用于列表筛选 */
  tags: string[] | null;
  /** 是否置顶（列表置顶优先） */
  isPinned: boolean;
  /** 是否归档（归档后不出现在"全部"视图） */
  isArchived: boolean;
  /** 创建时间（ISO 字符串） */
  createdAt: string;
  /** 更新时间（ISO 字符串） */
  updatedAt: string;
  /** 软删除时间，非 null 表示已进入回收站 */
  deletedAt: string | null;
}

/**
 * 笔记与图节点的挂载关系（对应 note_node_links 表 Row）
 * wiki 链接即挂载：笔记中 [[节点名]] 保存时自动建立挂载关系
 */
export interface NoteNodeLink {
  /** 主键 UUID */
  id: string;
  /** 笔记 ID，引用 notes.id */
  noteId: string;
  /** 图节点 ID，引用 graph_nodes.id */
  nodeId: string;
  /** 冗余图谱 ID，便于按图谱批量查询 */
  graphId: string;
  /** 创建时间（ISO 字符串） */
  createdAt: string;
}

/**
 * 笔记模板（对应 note_templates 表 Row）
 * 系统默认模板 user_id 为 null，不可删不可改
 */
export interface NoteTemplate {
  /** 主键 UUID */
  id: string;
  /** 所属用户 ID；null 表示系统默认模板 */
  userId: string | null;
  /** 模板名 */
  name: string;
  /** 模板 Markdown 正文，含 {{date}} 等变量占位 */
  content: string;
  /** 是否为该用户的默认模板（每个 user_id 同时只能一个） */
  isDefault: boolean;
  /** 是否为系统默认模板（不可删、不可改） */
  isSystem: boolean;
  /** 创建时间（ISO 字符串） */
  createdAt: string;
  /** 更新时间（ISO 字符串） */
  updatedAt: string;
}

/**
 * 创建笔记输入
 */
export interface CreateNoteInput {
  title: string;
  content?: string;
  type: NoteType;
  /** daily 必填（YYYY-MM-DD），note 不使用 */
  date?: string;
  templateId?: string;
  tags?: string[];
  isPinned?: boolean;
  isArchived?: boolean;
}

/**
 * 更新笔记输入（所有字段可选，deletedAt 用于软删除/恢复）
 */
export interface UpdateNoteInput {
  title?: string;
  content?: string;
  date?: string;
  templateId?: string | null;
  tags?: string[];
  isPinned?: boolean;
  isArchived?: boolean;
  /** 设置非 null 时间戳表示软删除，置 null 表示恢复 */
  deletedAt?: string | null;
}

/**
 * 笔记列表过滤条件
 */
export interface NoteListFilters {
  /** 按类型过滤 */
  type?: NoteType;
  /** 按日期过滤（daily） */
  date?: string;
  /** 按标签过滤 */
  tag?: string;
  /** 是否仅查归档 */
  isArchived?: boolean;
  /** 是否仅置换顶 */
  isPinned?: boolean;
  /** 按挂载节点过滤（节点详情页"关联笔记"用） */
  nodeId?: string;
  /** 标题/内容本地筛选 */
  search?: string;
  /** 是否包含已软删除（回收站用，默认 false） */
  includeDeleted?: boolean;
}

/**
 * 笔记列表查询参数（含分页）
 */
export interface NoteListParams {
  /** 过滤条件 */
  filters?: NoteListFilters;
  /** 页码（从 1 开始，默认 1） */
  page?: number;
  /** 每页条数（默认 20） */
  pageSize?: number;
  /** 排序字段 */
  sortBy?: 'updated_at' | 'created_at' | 'title';
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
}

// ============================================================
// P1 类型扩展 (AI 辅助 / 搜索 / 模板 / 图片)
// 对应 spec: add-notes-p1-ai-search-templates
// ============================================================

/**
 * 笔记 Embedding 实体（对应 note_embeddings 表 Row）
 * 单笔记单 embedding，用于笔记内容语义检索
 */
export interface NoteEmbedding {
  /** 主键 UUID */
  id: string;
  /** 笔记 ID，引用 notes.id */
  noteId: string;
  /** 笔记内容向量嵌入，维度 1024（与 document_chunks 一致） */
  embedding: number[];
  /** 笔记正文快照（截断前 N 字符），用于检索结果摘要展示 */
  chunkText: string | null;
  /** 首次生成 embedding 的时间（ISO 字符串） */
  createdAt: string;
  /** 最近一次刷新 embedding 的时间（ISO 字符串） */
  updatedAt: string;
}

// ----- 模板 CRUD -----

/**
 * 创建笔记模板输入
 */
export interface CreateNoteTemplateInput {
  name: string;
  /** 模板 Markdown 正文，含变量占位（{{date}} 等） */
  content: string;
}

/**
 * 更新笔记模板输入（所有字段可选）
 * 注意：系统默认模板（is_system=true）不可改
 */
export interface UpdateNoteTemplateInput {
  name?: string;
  content?: string;
}

// ----- AI 当日学习总结 -----

/**
 * 生成当日学习总结响应
 */
export interface GenerateDailySummaryResponse {
  /** AI 生成的结构化总结文本（Markdown） */
  summary: string;
  /** 可选：本次调用的 token 使用量（性能监控） */
  tokensUsed?: number;
}

// ----- 笔记提取要点反向建图 -----

/**
 * AI 从笔记中提取的候选知识点
 *
 * 注意：本接口与 graph-literature.ts 中的 ExtractedConcept（用于文献提取）
 * 含义不同，故采用 Note 前缀以避免命名冲突。
 */
export interface NoteExtractedConcept {
  /** 知识点名称 */
  name: string;
  /** 知识点描述 */
  description: string;
  /** 建议关联的已有概念名（用于合并提示） */
  related?: string[];
}

/**
 * 提取知识点响应
 */
export interface ExtractConceptsResponse {
  /** 候选知识点列表（含建议关系） */
  concepts: NoteExtractedConcept[];
}

/**
 * 用户确认创建/合并的单个知识点
 */
export interface CreateNodeFromConcept {
  /** 知识点名称 */
  name: string;
  /** 知识点描述 */
  description: string;
  /** 建议关联的已有概念名 */
  related?: string[];
}

/**
 * 反向建图请求（用户确认后调用）
 */
export interface CreateNodesFromConceptsRequest {
  /** 目标图谱 ID */
  graphId: string;
  /** 用户勾选要创建的知识点列表 */
  selectedConcepts: CreateNodeFromConcept[];
}

/**
 * 单个知识点创建结果
 */
export interface CreatedNodeResult {
  /** 对应的概念名（用于关联请求与结果） */
  conceptName: string;
  /** 成功创建时返回的节点 ID */
  nodeId: string;
  /** 是否成功 */
  success: boolean;
  /** 失败原因（success=false 时） */
  error?: string;
}

/**
 * 反向建图响应
 */
export interface CreateNodesFromConceptsResponse {
  /** 每个知识点的创建结果 */
  results: CreatedNodeResult[];
}

// ----- 图片上传 -----

/**
 * 图片上传响应
 */
export interface UploadImageResponse {
  /** 上传后的图片访问 URL */
  url: string;
  /** 可选：文件名 */
  filename?: string;
  /** 可选：文件大小（字节） */
  size?: number;
}
