import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

// Mock request 与 getAIConfig from ../client（literature.ts 同时使用两者）
vi.mock('../client', () => ({
  request: vi.fn(),
  getAIConfig: vi.fn(),
}));

// --- Imports (must be after vi.mock declarations) ---

import { literatureApi } from '../literature';
import { request, getAIConfig } from '../client';
import type {
  LiteratureExtractRequest,
  LiteratureApplyRequest,
} from '@shared/types/graph';

// --- Tests ---

describe('literatureApi', () => {
  beforeEach(() => {
    vi.mocked(request).mockClear();
    vi.mocked(getAIConfig).mockClear();
    // 默认 config，避免方法内部访问 undefined 报错
    vi.mocked(getAIConfig).mockReturnValue({
      provider: 'openai',
      model: 'gpt-4',
    });
  });

  describe('extractMetadata - 文件上传分支', () => {
    it('应该在传入 file 时以 POST 请求 /literature/metadata，body 为 FormData（含 file/provider/model）', async () => {
      const appendSpy = vi.spyOn(FormData.prototype, 'append');
      const file = new File(['content'], 'test.pdf', {
        type: 'application/pdf',
      });

      await literatureApi.extractMetadata({ file });

      expect(request).toHaveBeenCalledWith('/literature/metadata', {
        method: 'POST',
        body: expect.any(FormData),
      });
      expect(appendSpy).toHaveBeenCalledWith('file', file);
      expect(appendSpy).toHaveBeenCalledWith('provider', 'openai');
      expect(appendSpy).toHaveBeenCalledWith('model', 'gpt-4');
      appendSpy.mockRestore();
    });

    it('应该在 config 无 provider/model 时不向 FormData 追加这两个字段', async () => {
      vi.mocked(getAIConfig).mockReturnValue({
        provider: undefined,
        model: undefined,
      });
      const appendSpy = vi.spyOn(FormData.prototype, 'append');
      const file = new File(['content'], 'test.pdf', {
        type: 'application/pdf',
      });

      await literatureApi.extractMetadata({ file });

      expect(appendSpy).toHaveBeenCalledWith('file', file);
      expect(appendSpy).not.toHaveBeenCalledWith('provider', expect.anything());
      expect(appendSpy).not.toHaveBeenCalledWith('model', expect.anything());
      appendSpy.mockRestore();
    });
  });

  describe('extractMetadata - JSON 分支', () => {
    it('应该在传入 content 与 url 时以 POST 请求 /literature/metadata，body 为 JSON', async () => {
      await literatureApi.extractMetadata({
        content: '论文正文',
        url: 'https://example.com/paper.pdf',
      });

      expect(request).toHaveBeenCalledWith('/literature/metadata', {
        method: 'POST',
        body: JSON.stringify({
          content: '论文正文',
          url: 'https://example.com/paper.pdf',
          provider: 'openai',
          model: 'gpt-4',
        }),
      });
    });

    it('应该在 config 无 provider/model 时 JSON body 中 provider/model 为 undefined', async () => {
      vi.mocked(getAIConfig).mockReturnValue({
        provider: undefined,
        model: undefined,
      });

      await literatureApi.extractMetadata({ content: '论文正文' });

      expect(request).toHaveBeenCalledWith('/literature/metadata', {
        method: 'POST',
        body: JSON.stringify({
          content: '论文正文',
          url: undefined,
          provider: undefined,
          model: undefined,
        }),
      });
    });

    it('应该在仅传入空对象时仍以 JSON 请求', async () => {
      await literatureApi.extractMetadata({});

      expect(request).toHaveBeenCalledWith('/literature/metadata', {
        method: 'POST',
        body: JSON.stringify({
          content: undefined,
          url: undefined,
          provider: 'openai',
          model: 'gpt-4',
        }),
      });
    });
  });

  describe('extractConcepts - 文件上传分支', () => {
    it('应该在传入 file 时以 POST 请求 /literature/extract，body 为 FormData（含 graph_id 与 file）', async () => {
      const appendSpy = vi.spyOn(FormData.prototype, 'append');
      const file = new File(['content'], 'paper.pdf', {
        type: 'application/pdf',
      });

      await literatureApi.extractConcepts({
        graph_id: 'graph-1',
        file,
      });

      expect(request).toHaveBeenCalledWith('/literature/extract', {
        method: 'POST',
        body: expect.any(FormData),
      });
      expect(appendSpy).toHaveBeenCalledWith('graph_id', 'graph-1');
      expect(appendSpy).toHaveBeenCalledWith('file', file);
      expect(appendSpy).toHaveBeenCalledWith('provider', 'openai');
      expect(appendSpy).toHaveBeenCalledWith('model', 'gpt-4');
      appendSpy.mockRestore();
    });

    it('应该在 file 分支同时传入 content/url/options/literature/autoDetectMetadata 时追加全部字段', async () => {
      const appendSpy = vi.spyOn(FormData.prototype, 'append');
      const file = new File(['content'], 'paper.pdf', {
        type: 'application/pdf',
      });
      const literature = { title: '论文标题', year: 2024 };
      const options = { maxConcepts: 10 };

      await literatureApi.extractConcepts({
        graph_id: 'graph-1',
        file,
        content: '正文内容',
        url: 'https://example.com/paper.pdf',
        literature,
        options,
        autoDetectMetadata: true,
      });

      expect(appendSpy).toHaveBeenCalledWith('content', '正文内容');
      expect(appendSpy).toHaveBeenCalledWith(
        'url',
        'https://example.com/paper.pdf',
      );
      expect(appendSpy).toHaveBeenCalledWith('options', JSON.stringify(options));
      expect(appendSpy).toHaveBeenCalledWith(
        'literature',
        JSON.stringify(literature),
      );
      expect(appendSpy).toHaveBeenCalledWith('autoDetectMetadata', 'true');
      appendSpy.mockRestore();
    });

    it('应该在 autoDetectMetadata 为 false 时追加字符串 "false"', async () => {
      const appendSpy = vi.spyOn(FormData.prototype, 'append');
      const file = new File(['content'], 'paper.pdf', {
        type: 'application/pdf',
      });

      await literatureApi.extractConcepts({
        graph_id: 'graph-1',
        file,
        autoDetectMetadata: false,
      });

      expect(appendSpy).toHaveBeenCalledWith('autoDetectMetadata', 'false');
      appendSpy.mockRestore();
    });

    it('应该在未传 content/url/options/literature/autoDetectMetadata 时不追加这些字段', async () => {
      const appendSpy = vi.spyOn(FormData.prototype, 'append');
      const file = new File(['content'], 'paper.pdf', {
        type: 'application/pdf',
      });

      await literatureApi.extractConcepts({
        graph_id: 'graph-1',
        file,
      });

      expect(appendSpy).not.toHaveBeenCalledWith('content', expect.anything());
      expect(appendSpy).not.toHaveBeenCalledWith('url', expect.anything());
      expect(appendSpy).not.toHaveBeenCalledWith('options', expect.anything());
      expect(appendSpy).not.toHaveBeenCalledWith(
        'literature',
        expect.anything(),
      );
      expect(appendSpy).not.toHaveBeenCalledWith(
        'autoDetectMetadata',
        expect.anything(),
      );
      appendSpy.mockRestore();
    });

    it('应该在 config 无 provider/model 时不向 FormData 追加这两个字段', async () => {
      vi.mocked(getAIConfig).mockReturnValue({
        provider: undefined,
        model: undefined,
      });
      const appendSpy = vi.spyOn(FormData.prototype, 'append');
      const file = new File(['content'], 'paper.pdf', {
        type: 'application/pdf',
      });

      await literatureApi.extractConcepts({
        graph_id: 'graph-1',
        file,
      });

      expect(appendSpy).not.toHaveBeenCalledWith('provider', expect.anything());
      expect(appendSpy).not.toHaveBeenCalledWith('model', expect.anything());
      appendSpy.mockRestore();
    });
  });

  describe('extractConcepts - JSON 分支', () => {
    it('应该在未传 file 时以 POST 请求 /literature/extract，body 为 JSON（含 graph_id 与 config）', async () => {
      const data: LiteratureExtractRequest = {
        graph_id: 'graph-1',
        content: '论文正文',
      };

      await literatureApi.extractConcepts(data);

      expect(request).toHaveBeenCalledWith('/literature/extract', {
        method: 'POST',
        body: JSON.stringify({
          graph_id: 'graph-1',
          content: '论文正文',
          url: undefined,
          literature: undefined,
          options: undefined,
          autoDetectMetadata: undefined,
          provider: 'openai',
          model: 'gpt-4',
        }),
      });
    });

    it('应该将 literature/options/autoDetectMetadata/url 一并序列化到 JSON body', async () => {
      const literature = { title: '论文标题' };
      const options = { maxConcepts: 5 };

      await literatureApi.extractConcepts({
        graph_id: 'graph-1',
        url: 'https://example.com',
        literature,
        options,
        autoDetectMetadata: true,
      });

      expect(request).toHaveBeenCalledWith('/literature/extract', {
        method: 'POST',
        body: JSON.stringify({
          graph_id: 'graph-1',
          content: undefined,
          url: 'https://example.com',
          literature,
          options,
          autoDetectMetadata: true,
          provider: 'openai',
          model: 'gpt-4',
        }),
      });
    });

    it('应该在 config 无 provider/model 时 JSON body 中 provider/model 为 undefined', async () => {
      vi.mocked(getAIConfig).mockReturnValue({
        provider: undefined,
        model: undefined,
      });

      await literatureApi.extractConcepts({ graph_id: 'graph-1' });

      expect(request).toHaveBeenCalledWith('/literature/extract', {
        method: 'POST',
        body: JSON.stringify({
          graph_id: 'graph-1',
          content: undefined,
          url: undefined,
          literature: undefined,
          options: undefined,
          autoDetectMetadata: undefined,
          provider: undefined,
          model: undefined,
        }),
      });
    });
  });

  describe('applyConcepts', () => {
    it('应该以 POST 请求 /literature/apply 并将 data 作为 JSON body', async () => {
      const data: LiteratureApplyRequest = {
        graph_id: 'graph-1',
        concepts: [],
        relations: [],
        literature: {
          title: '论文标题',
          type: 'paper',
          processedAt: '2026-07-23T00:00:00Z',
        },
      };

      await literatureApi.applyConcepts(data);

      expect(request).toHaveBeenCalledWith('/literature/apply', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });
  });
});
