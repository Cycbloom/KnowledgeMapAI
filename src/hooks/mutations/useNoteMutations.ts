import { api } from "../../services/api";
import {
  createInvalidationMutation,
  createSimpleMutation,
} from "./mutationFactory";
import type {
  Note,
  NoteTemplate,
  CreateNoteInput,
  UpdateNoteInput,
  CreateNoteTemplateInput,
  UpdateNoteTemplateInput,
  GenerateDailySummaryResponse,
  ExtractConceptsResponse,
  CreateNodesFromConceptsRequest,
  CreateNodesFromConceptsResponse,
  UploadImageResponse,
  WritingAssistResponse,
  WritingAssistRequest,
  RefreshDailyAggregationResponse,
} from "@shared/types/note";

/**
 * 创建普通笔记。成功后失效笔记列表缓存。
 */
export const useCreateNoteMutation = createInvalidationMutation(
  (data: CreateNoteInput) => api.notes.create(data),
  [["notes"]],
);

/**
 * 获取或创建今日 Daily Note(不存在则后端按模板自动创建)。
 * 成功后失效笔记列表缓存。
 * 显式声明 TVariables=void,使 mutateAsync() 可无参调用。
 */
export const useGetOrCreateTodayDailyMutation = createInvalidationMutation<Note, void>(
  () => api.notes.getOrCreateTodayDaily(),
  [["notes"]],
);

/**
 * 更新笔记(标题/正文/置顶/归档/标签等)。成功后失效笔记列表缓存。
 *
 * Bug 5: 标记为 silent,使 LoadingBar 的 useIsMutating 过滤掉自动保存触发的
 * mutation,避免每次自动保存都让顶部进度条闪现(saveStatus 文案已提供反馈)。
 */
export const useUpdateNoteMutation = createInvalidationMutation(
  ({ id, data }: { id: string; data: UpdateNoteInput }) =>
    api.notes.update(id, data),
  [["notes"]],
  { silent: true },
);

/**
 * 软删除笔记。成功后失效笔记列表缓存。
 */
export const useDeleteNoteMutation = createInvalidationMutation(
  (id: string) => api.notes.delete(id),
  [["notes"]],
);

/**
 * 恢复软删除的笔记(挂载关系不自动恢复)。成功后失效笔记列表缓存。
 */
export const useRestoreNoteMutation = createInvalidationMutation(
  (id: string) => api.notes.restore(id),
  [["notes"]],
);

// ============================================================
// P1: AI 辅助 mutations
// ============================================================

/**
 * 生成当日学习总结。
 *
 * 调用 notesApi.generateDailySummary 返回总结文本(由调用方插入编辑器)。
 * 不需要失效缓存——总结插入后由 BlockEditor 自动保存触发 notes 失效。
 */
export const useGenerateDailySummaryMutation = createSimpleMutation<
  GenerateDailySummaryResponse,
  string
>((noteId: string) => api.notes.generateDailySummary(noteId));

/**
 * 从笔记正文提取候选知识点。
 *
 * 调用 notesApi.extractConcepts 返回候选列表,由调用方弹出确认对话框。
 */
export const useExtractConceptsMutation = createSimpleMutation<
  ExtractConceptsResponse,
  string
>((noteId: string) => api.notes.extractConcepts(noteId));

/**
 * 反向建图:根据确认的知识点在目标图谱创建节点并挂载到本笔记。
 *
 * 成功后失效 ["graphs"](图谱查询缓存)与 ["notes"](笔记查询缓存,
 * 因 note_node_links 关联关系变化)。
 */
export const useCreateNodesFromConceptsMutation = createInvalidationMutation<
  CreateNodesFromConceptsResponse,
  { noteId: string; data: CreateNodesFromConceptsRequest }
>(
  ({ noteId, data }) => api.notes.createNodesFromConcepts(noteId, data),
  [["graphs"], ["notes"]],
);

// ============================================================
// P1 Task 9: 图片上传
// ============================================================

/**
 * 上传图片到笔记并返回访问 URL。
 *
 * 调用 notesApi.uploadImage(noteId, file) 上传文件,返回 { url }。
 * 不失效笔记缓存——图片上传不修改笔记 content,仅返回 URL 由调用方
 * 插入 ![](url) 到编辑器(插入后由 BlockEditor 自动保存触发 notes 失效)。
 */
export const useUploadNoteImageMutation = createSimpleMutation<
  UploadImageResponse,
  { noteId: string; file: File }
>(({ noteId, file }) => api.notes.uploadImage(noteId, file));

// ============================================================
// P1 Task 11: 模板 CRUD mutations
// ============================================================

/**
 * 创建笔记模板(自定义)。成功后失效 ["notes", "templates"] 与 ["notes"] 前缀:
 * 模板变更会影响下次 daily 自动创建流程,故同时失效 ["notes"] 前缀。
 */
export const useCreateNoteTemplateMutation = createInvalidationMutation<
  NoteTemplate,
  CreateNoteTemplateInput
>((data) => api.notes.createTemplate(data), [["notes", "templates"], ["notes"]]);

/**
 * 更新笔记模板。成功后失效 ["notes", "templates"] 与 ["notes"] 前缀
 * (系统模板后端会拒绝修改,前端按钮已禁用)。
 */
export const useUpdateNoteTemplateMutation = createInvalidationMutation<
  NoteTemplate,
  { id: string; data: UpdateNoteTemplateInput }
>(({ id, data }) => api.notes.updateTemplate(id, data), [
  ["notes", "templates"],
  ["notes"],
]);

/**
 * 删除笔记模板。成功后失效 ["notes", "templates"] 与 ["notes"] 前缀。
 */
export const useDeleteNoteTemplateMutation = createInvalidationMutation<
  void,
  string
>((id) => api.notes.deleteTemplate(id), [["notes", "templates"], ["notes"]]);

/**
 * 设为默认模板。成功后失效 ["notes", "templates"] 与 ["notes"] 前缀:
 * 默认模板影响下次 daily 自动创建时所选模板。
 */
export const useSetDefaultNoteTemplateMutation = createInvalidationMutation<
  NoteTemplate,
  string
>((id) => api.notes.setDefaultTemplate(id), [
  ["notes", "templates"],
  ["notes"],
]);

// ============================================================
// P2 Task 7: 写作辅助与 Daily 聚合刷新
// ============================================================

/**
 * 写作辅助(续写/改写/扩写)。
 *
 * 调用 notesApi.writingAssist 返回 AI 建议文本,由调用方(BlockEditor)
 * 弹出 WritingAssistPopover 供用户采纳/放弃。不失效缓存——
 * 采纳后由 BlockEditor 自动保存触发 notes 失效。
 *
 * 变量采用 { noteId, data } 结构,与 useUpdateNoteMutation 风格一致;
 * data.noteId 与外层 noteId 一致(类型要求 WritingAssistRequest 含 noteId)。
 */
export const useWritingAssistMutation = createSimpleMutation<
  WritingAssistResponse,
  { noteId: string; data: WritingAssistRequest }
>(({ noteId, data }) => api.notes.writingAssist(noteId, data));

/**
 * 刷新 Daily 笔记的今日聚合数据。
 *
 * 调用 notesApi.refreshDailyAggregation 后端重新渲染"## 今日数据"段并落盘,
 * 返回刷新后的笔记。由于修改了 note.content,需失效 ["notes"] 缓存
 * 让列表与详情查询刷新,故用 createInvalidationMutation。
 */
export const useRefreshDailyAggregationMutation = createInvalidationMutation<
  RefreshDailyAggregationResponse,
  string
>((noteId) => api.notes.refreshDailyAggregation(noteId), [["notes"]]);
