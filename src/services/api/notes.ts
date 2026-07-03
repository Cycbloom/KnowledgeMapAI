import { request, getApiUrl, handleResponse, getCookie } from './client';
import { useStore } from '@/store/useStore';
import { isElectronProduction } from '@/config/electronConfig';
import type {
  Note,
  NoteTemplate,
  CreateNoteInput,
  UpdateNoteInput,
  NoteListParams,
  NoteListFilters,
  CreateNoteTemplateInput,
  UpdateNoteTemplateInput,
  GenerateDailySummaryResponse,
  ExtractConceptsResponse,
  CreateNodesFromConceptsRequest,
  CreateNodesFromConceptsResponse,
  UploadImageResponse,
} from '@shared/types/note';
import type { INotesApi, NoteListResult, NoteRestoreResult } from './contracts/INotesApi';

/**
 * 将列表过滤参数转换为后端 GET /notes 期望的 query string。
 * 后端路由读取:type/date/tag/isArchived/isPinned/nodeId/search/includeDeleted/page/pageSize。
 */
const buildListQuery = (params?: NoteListParams): string => {
  const filters: NoteListFilters = params?.filters ?? {};
  const searchParams = new URLSearchParams();
  if (filters.type) searchParams.set('type', filters.type);
  if (filters.date) searchParams.set('date', filters.date);
  if (filters.tag) searchParams.set('tag', filters.tag);
  if (typeof filters.isArchived === 'boolean') {
    searchParams.set('isArchived', String(filters.isArchived));
  }
  if (typeof filters.isPinned === 'boolean') {
    searchParams.set('isPinned', String(filters.isPinned));
  }
  if (filters.nodeId) searchParams.set('nodeId', filters.nodeId);
  if (filters.search) searchParams.set('search', filters.search);
  if (typeof filters.includeDeleted === 'boolean') {
    searchParams.set('includeDeleted', String(filters.includeDeleted));
  }
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

export const notesApi: INotesApi = {
  list: (params?: NoteListParams) =>
    request<NoteListResult>(`/notes${buildListQuery(params)}`),

  get: (id: string) => request<Note>(`/notes/${id}`),

  create: (data: CreateNoteInput) =>
    request<Note>('/notes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateNoteInput) =>
    request<Note>(`/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/notes/${id}`, { method: 'DELETE' }),

  restore: (id: string) =>
    request<NoteRestoreResult>(`/notes/${id}/restore`, { method: 'POST' }),

  getOrCreateTodayDaily: () => request<Note>('/notes/today-daily'),

  listTemplates: () => request<NoteTemplate[]>('/notes/templates'),

  getByNodeId: (nodeId: string) =>
    request<{ items: Note[]; total: number }>(`/notes/by-node/${nodeId}`).then(
      (res) => res.items,
    ),

  // ----- P1: 模板 CRUD -----

  createTemplate: (data: CreateNoteTemplateInput) =>
    request<NoteTemplate>('/notes/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateTemplate: (id: string, data: UpdateNoteTemplateInput) =>
    request<NoteTemplate>(`/notes/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteTemplate: (id: string) =>
    request<void>(`/notes/templates/${id}`, { method: 'DELETE' }),

  setDefaultTemplate: (id: string) =>
    request<NoteTemplate>(`/notes/templates/${id}/set-default`, {
      method: 'POST',
    }),

  // ----- P1: AI 端点 -----

  generateDailySummary: (noteId: string) =>
    request<GenerateDailySummaryResponse>(`/notes/${noteId}/summary`, {
      method: 'POST',
    }),

  extractConcepts: (noteId: string) =>
    request<ExtractConceptsResponse>(`/notes/${noteId}/extract-concepts`, {
      method: 'POST',
    }),

  createNodesFromConcepts: (
    noteId: string,
    data: CreateNodesFromConceptsRequest,
  ) =>
    request<CreateNodesFromConceptsResponse>(`/notes/${noteId}/create-nodes`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // ----- P1: 图片上传 -----
  // request 封装会对 body 做 JSON.parse,无法承载 FormData,
  // 此处参照 ai.documentToGraph / stt.transcribe 的 fetch 直传模式:
  // 由浏览器自动设置 multipart/form-data 边界,手动注入 auth/csrf 头。

  uploadImage: async (
    noteId: string,
    file: File,
  ): Promise<UploadImageResponse> => {
    const token = useStore.getState().token;
    const csrfToken = !isElectronProduction() ? getCookie('csrf-token') : null;
    const formData = new FormData();
    formData.append('file', file);

    const apiUrl = await getApiUrl();
    const response = await fetch(`${apiUrl}/notes/${noteId}/upload-image`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
        ...(isElectronProduction() ? { 'x-electron-client': 'true' } : {}),
      },
      credentials: 'include',
      body: formData,
    });
    return handleResponse<UploadImageResponse>(response);
  },
};
