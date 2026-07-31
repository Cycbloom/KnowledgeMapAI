import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  Note,
  CreateNoteInput,
  UpdateNoteInput,
  NoteListParams,
  CreateNoteTemplateInput,
  UpdateNoteTemplateInput,
  CreateNodesFromConceptsRequest,
  WritingAssistRequest,
} from '@shared/types/note';

// --- Mocks ---

// Mock request 及 client 中 uploadImage 使用的辅助函数
vi.mock('../client', () => ({
  request: vi.fn(),
  getApiUrl: vi.fn(),
  handleResponse: vi.fn(),
  getCookie: vi.fn(),
}));

// Mock useStore(仅 uploadImage 使用)— 使用相对路径确保 vitest mock 解析正确
vi.mock('../../../store/useStore', () => ({
  useStore: {
    getState: vi.fn(() => ({ token: 'token-123' })),
  },
}));

// Mock isElectronProduction(仅 uploadImage 使用)
vi.mock('../../../config/electronConfig', () => ({
  isElectronProduction: vi.fn(() => false),
}));

// --- Imports (must be after vi.mock declarations) ---

import { notesApi } from '../notes';
import { request, getApiUrl, handleResponse, getCookie } from '../client';
import { useStore } from '../../../store/useStore';
import { isElectronProduction } from '../../../config/electronConfig';

// --- Test data ---

const mockNote: Note = {
  id: 'note-1',
  userId: 'user-1',
  title: '测试笔记',
  content: '正文内容',
  type: 'note',
  date: null,
  templateId: null,
  tags: ['react'],
  isPinned: false,
  isArchived: false,
  createdAt: '2026-07-23T00:00:00.000Z',
  updatedAt: '2026-07-23T00:00:00.000Z',
  deletedAt: null,
};

const createNoteInput: CreateNoteInput = {
  title: '新笔记',
  type: 'note',
  content: '初始内容',
};

const updateNoteInput: UpdateNoteInput = {
  title: '更新标题',
  content: '更新内容',
};

const createTemplateInput: CreateNoteTemplateInput = {
  name: '自定义模板',
  content: '# {{date}}',
};

const updateTemplateInput: UpdateNoteTemplateInput = {
  name: '更新模板',
};

const createNodesRequest: CreateNodesFromConceptsRequest = {
  graphId: 'graph-1',
  selectedConcepts: [
    { name: '概念A', description: '概念A描述', related: ['概念B'] },
  ],
};

// --- Tests ---

describe('notesApi', () => {
  beforeEach(() => {
    vi.mocked(request).mockClear();
  });

  // ============================================================
  // 基础 CRUD
  // ============================================================

  describe('list', () => {
    it('应该通过 GET /notes 获取笔记列表(无参数)', async () => {
      const mockResult = {
        items: [mockNote],
        total: 1,
        page: 1,
        pageSize: 20,
      };
      vi.mocked(request).mockResolvedValue(mockResult);

      const result = await notesApi.list();

      expect(request).toHaveBeenCalledWith('/notes');
      expect(result).toEqual(mockResult);
    });

    it('应该通过 GET /notes?... 获取笔记列表(带过滤与分页)', async () => {
      const mockResult = {
        items: [mockNote],
        total: 1,
        page: 2,
        pageSize: 10,
      };
      vi.mocked(request).mockResolvedValue(mockResult);

      const params: NoteListParams = {
        filters: {
          type: 'daily',
          date: '2026-07-23',
          tag: 'react',
          isArchived: false,
          isPinned: true,
          nodeId: 'node-1',
          search: 'test',
          includeDeleted: true,
        },
        page: 2,
        pageSize: 10,
      };

      const result = await notesApi.list(params);

      expect(request).toHaveBeenCalledWith(
        '/notes?type=daily&date=2026-07-23&tag=react&isArchived=false&isPinned=true&nodeId=node-1&search=test&includeDeleted=true&page=2&pageSize=10',
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('get', () => {
    it('应该通过 GET /notes/:id 获取单个笔记', async () => {
      vi.mocked(request).mockResolvedValue(mockNote);

      const result = await notesApi.get('note-1');

      expect(request).toHaveBeenCalledWith('/notes/note-1');
      expect(result).toEqual(mockNote);
    });
  });

  describe('create', () => {
    it('应该通过 POST /notes 创建笔记', async () => {
      vi.mocked(request).mockResolvedValue(mockNote);

      const result = await notesApi.create(createNoteInput);

      expect(request).toHaveBeenCalledWith('/notes', {
        method: 'POST',
        body: JSON.stringify(createNoteInput),
      });
      expect(result).toEqual(mockNote);
    });
  });

  describe('update', () => {
    it('应该通过 PUT /notes/:id 更新笔记', async () => {
      vi.mocked(request).mockResolvedValue(mockNote);

      const result = await notesApi.update('note-1', updateNoteInput);

      expect(request).toHaveBeenCalledWith('/notes/note-1', {
        method: 'PUT',
        body: JSON.stringify(updateNoteInput),
      });
      expect(result).toEqual(mockNote);
    });
  });

  describe('delete', () => {
    it('应该通过 DELETE /notes/:id 删除笔记', async () => {
      vi.mocked(request).mockResolvedValue(undefined);

      await notesApi.delete('note-1');

      expect(request).toHaveBeenCalledWith('/notes/note-1', {
        method: 'DELETE',
      });
    });
  });

  describe('restore', () => {
    it('应该通过 POST /notes/:id/restore 恢复笔记', async () => {
      const mockRestoreResult = {
        ...mockNote,
        linksRestored: false,
        message: '恢复成功',
      };
      vi.mocked(request).mockResolvedValue(mockRestoreResult);

      const result = await notesApi.restore('note-1');

      expect(request).toHaveBeenCalledWith('/notes/note-1/restore', {
        method: 'POST',
      });
      expect(result).toEqual(mockRestoreResult);
    });
  });

  // ============================================================
  // Daily / Templates / ByNode
  // ============================================================

  describe('getOrCreateTodayDaily', () => {
    it('应该通过 GET /notes/today-daily 获取或创建今日 Daily', async () => {
      vi.mocked(request).mockResolvedValue(mockNote);

      const result = await notesApi.getOrCreateTodayDaily();

      expect(request).toHaveBeenCalledWith('/notes/today-daily');
      expect(result).toEqual(mockNote);
    });
  });

  describe('listTemplates', () => {
    it('应该通过 GET /notes/templates 查询模板列表', async () => {
      const mockTemplates = [
        {
          id: 'tpl-1',
          userId: 'user-1',
          name: '模板1',
          content: '# T1',
          isDefault: true,
          isSystem: false,
          createdAt: '',
          updatedAt: '',
        },
      ];
      vi.mocked(request).mockResolvedValue(mockTemplates);

      const result = await notesApi.listTemplates();

      expect(request).toHaveBeenCalledWith('/notes/templates');
      expect(result).toEqual(mockTemplates);
    });
  });

  describe('getByNodeId', () => {
    it('应该通过 GET /notes/by-node/:nodeId 查询关联笔记并提取 items', async () => {
      const mockResponse = { items: [mockNote], total: 1 };
      vi.mocked(request).mockResolvedValue(mockResponse);

      const result = await notesApi.getByNodeId('node-1');

      expect(request).toHaveBeenCalledWith('/notes/by-node/node-1');
      expect(result).toEqual([mockNote]);
    });
  });

  // ============================================================
  // P1: 模板 CRUD
  // ============================================================

  describe('createTemplate', () => {
    it('应该通过 POST /notes/templates 创建模板', async () => {
      const mockTemplate = {
        id: 'tpl-1',
        userId: 'user-1',
        name: '自定义模板',
        content: '# {{date}}',
        isDefault: false,
        isSystem: false,
        createdAt: '',
        updatedAt: '',
      };
      vi.mocked(request).mockResolvedValue(mockTemplate);

      const result = await notesApi.createTemplate(createTemplateInput);

      expect(request).toHaveBeenCalledWith('/notes/templates', {
        method: 'POST',
        body: JSON.stringify(createTemplateInput),
      });
      expect(result).toEqual(mockTemplate);
    });
  });

  describe('updateTemplate', () => {
    it('应该通过 PUT /notes/templates/:id 更新模板', async () => {
      const mockTemplate = {
        id: 'tpl-1',
        userId: 'user-1',
        name: '更新模板',
        content: '# {{date}}',
        isDefault: false,
        isSystem: false,
        createdAt: '',
        updatedAt: '',
      };
      vi.mocked(request).mockResolvedValue(mockTemplate);

      const result = await notesApi.updateTemplate('tpl-1', updateTemplateInput);

      expect(request).toHaveBeenCalledWith('/notes/templates/tpl-1', {
        method: 'PUT',
        body: JSON.stringify(updateTemplateInput),
      });
      expect(result).toEqual(mockTemplate);
    });
  });

  describe('deleteTemplate', () => {
    it('应该通过 DELETE /notes/templates/:id 删除模板', async () => {
      vi.mocked(request).mockResolvedValue(undefined);

      await notesApi.deleteTemplate('tpl-1');

      expect(request).toHaveBeenCalledWith('/notes/templates/tpl-1', {
        method: 'DELETE',
      });
    });
  });

  describe('setDefaultTemplate', () => {
    it('应该通过 POST /notes/templates/:id/set-default 设为默认模板', async () => {
      const mockTemplate = {
        id: 'tpl-1',
        userId: 'user-1',
        name: '模板',
        content: '# T',
        isDefault: true,
        isSystem: false,
        createdAt: '',
        updatedAt: '',
      };
      vi.mocked(request).mockResolvedValue(mockTemplate);

      const result = await notesApi.setDefaultTemplate('tpl-1');

      expect(request).toHaveBeenCalledWith(
        '/notes/templates/tpl-1/set-default',
        { method: 'POST' },
      );
      expect(result).toEqual(mockTemplate);
    });
  });

  // ============================================================
  // P1: AI 端点
  // ============================================================

  describe('generateDailySummary', () => {
    it('应该通过 POST /notes/:noteId/summary 生成学习总结', async () => {
      const mockResponse = { summary: '今日总结', tokensUsed: 100 };
      vi.mocked(request).mockResolvedValue(mockResponse);

      const result = await notesApi.generateDailySummary('note-1');

      expect(request).toHaveBeenCalledWith('/notes/note-1/summary', {
        method: 'POST',
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('extractConcepts', () => {
    it('应该通过 POST /notes/:noteId/extract-concepts 提取知识点', async () => {
      const mockResponse = {
        concepts: [{ name: '概念A', description: '描述A' }],
      };
      vi.mocked(request).mockResolvedValue(mockResponse);

      const result = await notesApi.extractConcepts('note-1');

      expect(request).toHaveBeenCalledWith('/notes/note-1/extract-concepts', {
        method: 'POST',
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('createNodesFromConcepts', () => {
    it('应该通过 POST /notes/:noteId/create-nodes 反向建图', async () => {
      const mockResponse = {
        results: [
          { conceptName: '概念A', nodeId: 'node-new', success: true },
        ],
      };
      vi.mocked(request).mockResolvedValue(mockResponse);

      const result = await notesApi.createNodesFromConcepts(
        'note-1',
        createNodesRequest,
      );

      expect(request).toHaveBeenCalledWith('/notes/note-1/create-nodes', {
        method: 'POST',
        body: JSON.stringify(createNodesRequest),
      });
      expect(result).toEqual(mockResponse);
    });
  });

  // ============================================================
  // P1: 图片上传(直接 fetch,不走 request)
  // ============================================================

  describe('uploadImage', () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      vi.mocked(getApiUrl).mockResolvedValue('/api/v1');
      vi.mocked(getCookie).mockReturnValue('csrf-abc');
      vi.mocked(isElectronProduction).mockReturnValue(false);
      vi.mocked(handleResponse).mockResolvedValue({ url: 'http://img.png' });
      vi.mocked(useStore.getState).mockReturnValue({
        user: null,
        token: 'token-123',
        refreshToken: null,
        setUser: () => {},
        clearAuth: () => {},
      });
      fetchSpy = vi.spyOn(globalThis, 'fetch');
    });

    afterEach(() => {
      fetchSpy.mockRestore();
    });

    it('应该通过 POST /notes/:noteId/upload-image 上传图片(含 auth/csrf 头)', async () => {
      const mockResponse = new Response('{}', { status: 200 });
      fetchSpy.mockResolvedValue(mockResponse);

      const file = new File(['image-content'], 'test.png', {
        type: 'image/png',
      });
      const result = await notesApi.uploadImage('note-1', file);

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/v1/notes/note-1/upload-image',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: 'Bearer token-123',
            'x-csrf-token': 'csrf-abc',
          },
          credentials: 'include',
        }),
      );
      const callArgs = fetchSpy.mock.calls[0];
      expect(callArgs?.[1]?.body).toBeInstanceOf(FormData);
      expect(handleResponse).toHaveBeenCalledWith(mockResponse);
      expect(result).toEqual({ url: 'http://img.png' });
    });
  });

  // ============================================================
  // P2: 写作辅助与刷新聚合
  // ============================================================

  describe('writingAssist', () => {
    it('应该通过 POST /notes/:noteId/writing-assist 发起写作辅助(无上下文)', async () => {
      const data: WritingAssistRequest = {
        noteId: 'note-1',
        action: 'continue',
        selectedText: '选中文本',
      };
      const mockResponse = { suggestion: '续写内容' };
      vi.mocked(request).mockResolvedValue(mockResponse);

      const result = await notesApi.writingAssist('note-1', data);

      expect(request).toHaveBeenCalledWith('/notes/note-1/writing-assist', {
        method: 'POST',
        body: JSON.stringify({
          action: 'continue',
          selectedText: '选中文本',
          contextBefore: undefined,
          contextAfter: undefined,
        }),
      });
      expect(result).toEqual(mockResponse);
    });

    it('应该通过 POST /notes/:noteId/writing-assist 发起写作辅助(带上下文)', async () => {
      const data: WritingAssistRequest = {
        noteId: 'note-1',
        action: 'rewrite',
        selectedText: '选中文本',
        contextBefore: '前文',
        contextAfter: '后文',
      };
      const mockResponse = { suggestion: '改写内容' };
      vi.mocked(request).mockResolvedValue(mockResponse);

      const result = await notesApi.writingAssist('note-1', data);

      expect(request).toHaveBeenCalledWith('/notes/note-1/writing-assist', {
        method: 'POST',
        body: JSON.stringify({
          action: 'rewrite',
          selectedText: '选中文本',
          contextBefore: '前文',
          contextAfter: '后文',
        }),
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('refreshDailyAggregation', () => {
    it('应该通过 POST /notes/:noteId/refresh-aggregation 刷新聚合', async () => {
      const mockResponse = { note: mockNote, refreshed: true };
      vi.mocked(request).mockResolvedValue(mockResponse);

      const result = await notesApi.refreshDailyAggregation('note-1');

      expect(request).toHaveBeenCalledWith(
        '/notes/note-1/refresh-aggregation',
        { method: 'POST' },
      );
      expect(result).toEqual(mockResponse);
    });
  });

  // ============================================================
  // P3: 块引用 / 块嵌入
  // ============================================================

  describe('getBlock', () => {
    it('应该通过 GET /notes/:noteId/blocks/:blockId 获取块内容', async () => {
      const mockBlock = {
        noteId: 'note-1',
        blockId: 'blk-1',
        content: '块正文',
        noteTitle: '笔记',
        isStale: false,
      };
      vi.mocked(request).mockResolvedValue(mockBlock);

      const result = await notesApi.getBlock('note-1', 'blk-1');

      expect(request).toHaveBeenCalledWith('/notes/note-1/blocks/blk-1');
      expect(result).toEqual(mockBlock);
    });
  });

  describe('getInboundBlockRefs', () => {
    it('应该通过 GET /notes/:noteId/block-refs/inbound 查询入向引用', async () => {
      const mockRefs = [
        {
          id: 'ref-1',
          sourceNoteId: 'note-2',
          sourceBlockId: 'blk-2',
          targetNoteId: 'note-1',
          targetBlockId: 'blk-1',
          type: 'ref' as const,
          createdAt: '',
        },
      ];
      vi.mocked(request).mockResolvedValue(mockRefs);

      const result = await notesApi.getInboundBlockRefs('note-1');

      expect(request).toHaveBeenCalledWith('/notes/note-1/block-refs/inbound');
      expect(result).toEqual(mockRefs);
    });
  });

  describe('getOutboundBlockRefs', () => {
    it('应该通过 GET /notes/:noteId/block-refs/outbound 查询出向引用', async () => {
      const mockRefs = [
        {
          id: 'ref-1',
          sourceNoteId: 'note-1',
          sourceBlockId: 'blk-1',
          targetNoteId: 'note-2',
          targetBlockId: 'blk-2',
          type: 'embed' as const,
          createdAt: '',
        },
      ];
      vi.mocked(request).mockResolvedValue(mockRefs);

      const result = await notesApi.getOutboundBlockRefs('note-1');

      expect(request).toHaveBeenCalledWith(
        '/notes/note-1/block-refs/outbound',
      );
      expect(result).toEqual(mockRefs);
    });
  });

  describe('searchBlocks', () => {
    it('应该通过 GET /notes/block-search?q= 搜索块(无 limit)', async () => {
      const mockTargets = [
        {
          noteId: 'note-1',
          noteTitle: '笔记',
          blockId: 'blk-1',
          blockSummary: '摘要',
          blockType: 'paragraph',
          updatedAt: '',
        },
      ];
      vi.mocked(request).mockResolvedValue(mockTargets);

      const result = await notesApi.searchBlocks('test');

      expect(request).toHaveBeenCalledWith('/notes/block-search?q=test');
      expect(result).toEqual(mockTargets);
    });

    it('应该通过 GET /notes/block-search?q=&limit= 搜索块(带 limit)', async () => {
      const mockTargets = [
        {
          noteId: 'note-1',
          noteTitle: '笔记',
          blockId: 'blk-1',
          blockSummary: '摘要',
          blockType: 'paragraph',
          updatedAt: '',
        },
      ];
      vi.mocked(request).mockResolvedValue(mockTargets);

      const result = await notesApi.searchBlocks('test', 5);

      expect(request).toHaveBeenCalledWith(
        '/notes/block-search?q=test&limit=5',
      );
      expect(result).toEqual(mockTargets);
    });
  });
});
