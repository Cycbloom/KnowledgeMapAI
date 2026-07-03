import type {
  Note,
  NoteTemplate,
  CreateNoteInput,
  UpdateNoteInput,
  NoteListParams,
  CreateNoteTemplateInput,
  UpdateNoteTemplateInput,
  GenerateDailySummaryResponse,
  ExtractConceptsResponse,
  CreateNodesFromConceptsRequest,
  CreateNodesFromConceptsResponse,
  UploadImageResponse,
} from '@shared/types/note';

/**
 * 笔记列表查询返回(含分页元信息)。
 * 与后端 notesService.list 的 NoteListResult 对齐。
 */
export interface NoteListResult {
  items: Note[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * 恢复笔记返回:笔记本体 + 挂载关系未恢复提示。
 * 对应 POST /notes/:id/restore 路由响应。
 */
export interface NoteRestoreResult extends Note {
  linksRestored: boolean;
  message: string;
}

export interface INotesApi {
  /** 列表查询(支持 type/date/tag/isArchived/isPinned/nodeId/search/includeDeleted 过滤与分页) */
  list(params?: NoteListParams): Promise<NoteListResult>;

  /** 查询单个笔记 */
  get(id: string): Promise<Note>;

  /** 创建笔记(daily 重复创建返回 409) */
  create(data: CreateNoteInput): Promise<Note>;

  /** 更新笔记(保存时同步 note_node_links) */
  update(id: string, data: UpdateNoteInput): Promise<Note>;

  /** 软删除笔记(同步清理 note_node_links) */
  delete(id: string): Promise<void>;

  /** 恢复软删除的笔记(挂载关系不自动恢复) */
  restore(id: string): Promise<NoteRestoreResult>;

  /** 获取或创建今日 Daily Note(不存在则按模板自动创建) */
  getOrCreateTodayDaily(): Promise<Note>;

  /** 查询用户可见模板(自有 + 系统默认) */
  listTemplates(): Promise<NoteTemplate[]>;

  /** 按节点查询关联笔记(用于节点详情侧边栏"关联笔记"区块) */
  getByNodeId(nodeId: string): Promise<Note[]>;

  // ----- P1: 模板 CRUD -----

  /** 创建自定义模板(POST /notes/templates) */
  createTemplate(data: CreateNoteTemplateInput): Promise<NoteTemplate>;

  /** 更新自定义模板(PUT /notes/templates/:id,系统模板不可改) */
  updateTemplate(
    id: string,
    data: UpdateNoteTemplateInput,
  ): Promise<NoteTemplate>;

  /** 删除自定义模板(DELETE /notes/templates/:id,系统模板不可删) */
  deleteTemplate(id: string): Promise<void>;

  /** 设为默认模板(POST /notes/templates/:id/set-default,事务保证唯一默认) */
  setDefaultTemplate(id: string): Promise<NoteTemplate>;

  // ----- P1: AI 端点 -----

  /** 生成今日学习总结(POST /notes/:id/summary) */
  generateDailySummary(noteId: string): Promise<GenerateDailySummaryResponse>;

  /** 从笔记正文提取候选知识点(POST /notes/:id/extract-concepts) */
  extractConcepts(noteId: string): Promise<ExtractConceptsResponse>;

  /** 反向建图:根据确认的知识点创建节点并挂载到本笔记(POST /notes/:id/create-nodes) */
  createNodesFromConcepts(
    noteId: string,
    data: CreateNodesFromConceptsRequest,
  ): Promise<CreateNodesFromConceptsResponse>;

  // ----- P1: 图片上传 -----

  /** 上传图片到笔记(POST /notes/:id/upload-image,multipart/form-data) */
  uploadImage(noteId: string, file: File): Promise<UploadImageResponse>;
}
