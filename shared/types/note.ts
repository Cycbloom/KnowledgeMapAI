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

// ============================================================
// AI 自动归档（捕获 → 图谱）
// ============================================================

/**
 * 单条捕获 AI 归档请求
 * 自动提取知识点 → 在目标图谱创建节点并挂载到该笔记 → 移除捕获箱 tag
 */
export interface AutoArchiveRequest {
  /** 目标图谱 ID（节点创建到哪个图谱） */
  graphId: string;
  /** 本次自动挑选的最大知识点数量（默认 CAPTURE_DEFAULT_MAX_CONCEPTS） */
  maxConcepts?: number;
}

/**
 * 单条捕获归档结果
 */
export interface AutoArchiveResult {
  /** 被归档的笔记 ID */
  noteId: string;
  /** 被归档的笔记标题 */
  title: string;
  /** 实际创建的节点（创建失败的条目 success=false） */
  createdNodes: CreatedNodeResult[];
  /** 成功创建的节点数量 */
  nodeCount: number;
  /** 是否确实提取到了知识点（false 表示无知识点，仅清除捕获箱标记） */
  created: boolean;
}

/**
 * 批量归档请求
 */
export interface BatchArchiveRequest {
  /** 目标图谱 ID */
  graphId: string;
  /** 要归档的捕获笔记 ID 列表 */
  noteIds: string[];
}

/**
 * 批量归档结果
 */
export interface BatchArchiveResult {
  /** 每条捕获的归档结果（顺序与请求一致） */
  results: AutoArchiveResult[];
  /** 成功归档（含"无知识点仅清除标记"）的条数 */
  archivedCount: number;
  /** 失败条数 */
  failedCount: number;
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

// ============================================================
// P2 类型扩展 (写作辅助 / Daily 聚合刷新)
// 对应 spec: extend-notes-p2-writing-refresh-search
// ============================================================

// ----- 写作辅助（continue / rewrite / expand）-----

/**
 * 写作辅助动作类型
 * - continue: 续写后续内容
 * - rewrite: 改写优化表达
 * - expand: 扩写补充细节
 */
export type WritingAssistAction = 'continue' | 'rewrite' | 'expand';

/**
 * 写作辅助请求
 */
export interface WritingAssistRequest {
  /** 目标笔记 ID */
  noteId: string;
  /** 写作辅助动作 */
  action: WritingAssistAction;
  /** 用户选中的文字（必填） */
  selectedText: string;
  /** 选中文字之前的前文上下文（可选） */
  contextBefore?: string;
  /** 选中文字之后的后文上下文（可选） */
  contextAfter?: string;
}

/**
 * 写作辅助响应
 */
export interface WritingAssistResponse {
  /** AI 生成的写作建议文本 */
  suggestion: string;
  /** 可选：本次调用的 token 使用量（性能监控） */
  tokensUsed?: number;
}

// ----- Daily 聚合刷新 -----

/**
 * Daily 笔记聚合刷新响应
 * 用于在打开 daily 笔记时，按需触发今日学习数据聚合刷新
 */
export interface RefreshDailyAggregationResponse {
  /** 刷新后的 daily 笔记（含最新聚合内容） */
  note: Note;
  /** 是否实际触发了刷新（无变化时为 false，直接返回缓存笔记） */
  refreshed: boolean;
}

// ============================================================
// P3 类型扩展 (块引用 / 块嵌入)
// 对应 spec: extend-notes-p3-block-refs-embeds
// 对应迁移: supabase/migrations/35_note_block_refs.sql
// ============================================================

// ============ P3: 块引用/块嵌入 ============

/** 块 ID，10 位 [a-z0-9] 串（对齐 Obsidian ^block-id 风格） */
export type BlockId = string;

/** 块引用类型：ref=inline 引用，embed=块嵌入 */
export type BlockRefType = 'ref' | 'embed';

/** 块引用关系记录（对应 note_block_refs 表 Row） */
export interface BlockRef {
  id: string;
  sourceNoteId: string;
  sourceBlockId: BlockId;
  targetNoteId: string;
  targetBlockId: BlockId;
  type: BlockRefType;
  createdAt: string;
  /** P3: 查询时 JOIN 获取的源笔记标题（getInboundRefs 填充，便于前端展示来源） */
  sourceNoteTitle?: string;
  /** P3: 查询时 JOIN 获取的目标笔记标题（getOutboundRefs 填充，便于前端展示目标） */
  targetNoteTitle?: string;
}

/** 块搜索补全结果项（供 BlockRefPopover 使用） */
export interface BlockRefTarget {
  noteId: string;
  noteTitle: string;
  blockId: BlockId;
  blockSummary: string;
  blockType: string;
  updatedAt: string;
}

/** 块内容查询结果（供 BlockReference/BlockEmbed 渲染使用） */
export interface BlockContent {
  noteId: string;
  blockId: BlockId;
  content: string;
  noteTitle: string;
  isStale: boolean;
}
