import { describe, it, expect, vi, beforeEach } from 'vitest';

// tts.ts 全部经统一出口（request/requestBlob），鉴权与 401 由 createApiClient 拦截器负责
// （拦截器行为由 createApiClient.test.ts 覆盖），此处仅断言服务层的接线与传参。
vi.mock('../client', () => ({
  request: vi.fn(),
  requestBlob: vi.fn(),
}));

// --- Imports (must be after vi.mock declarations) ---

import { ttsApi } from '../tts';
import { request, requestBlob } from '../client';

// --- Tests ---

describe('ttsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('health', () => {
    it('应该发送 GET 请求到 /ai/tts/health', () => {
      ttsApi.health();

      expect(request).toHaveBeenCalledWith('/ai/tts/health');
    });
  });

  describe('voices', () => {
    it('应该发送 GET 请求到 /ai/tts/voices', () => {
      ttsApi.voices();

      expect(request).toHaveBeenCalledWith('/ai/tts/voices');
    });

    it('应该返回 TTSVoice 数组', async () => {
      const mockVoices = [
        { id: 'v1', name: 'Voice1', lang: 'zh-CN' },
        { id: 'v2', name: 'Voice2', lang: 'en-US' },
      ];
      vi.mocked(request).mockResolvedValue(mockVoices);

      const result = await ttsApi.voices();

      expect(result).toEqual(mockVoices);
    });
  });

  describe('synthesize', () => {
    const sampleData = { text: '你好', voice: 'v1', speed: 1.0 };

    it('应该以 POST /ai/tts 经 requestBlob 请求音频', async () => {
      await ttsApi.synthesize(sampleData);

      expect(requestBlob).toHaveBeenCalledWith('/ai/tts', {
        method: 'POST',
        data: sampleData,
      });
    });

    it('应该在成功时返回 blob', async () => {
      const mockBlob = new Blob(['audio data']);
      vi.mocked(requestBlob).mockResolvedValue(mockBlob);

      const result = await ttsApi.synthesize(sampleData);

      expect(result).toBe(mockBlob);
    });
  });
});
