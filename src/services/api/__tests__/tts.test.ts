import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Hoisted mock state ---
// 使用 vi.hoisted 确保 mockState 在 vi.mock 工厂执行前就已创建，
// 且每次 getState() 返回同一个稳定对象（便于修改 token 等字段）。
const { mockState, mockSetUser } = vi.hoisted(() => {
  const mockSetUser = vi.fn();
  const mockState = {
    token: null as string | null,
    setUser: mockSetUser,
  };
  return { mockState, mockSetUser };
});

vi.mock('../client', () => ({
  request: vi.fn(),
  getApiUrl: vi.fn(async () => 'http://api.test'),
}));

// 使用相对路径确保 vitest 正确拦截模块（@/ 别名在 vi.mock 中可能不被解析）
vi.mock('../../../store/useStore', () => ({
  useStore: { getState: () => mockState },
}));

// 同上，相对路径避免 @/ 别名解析问题
vi.mock('../../../utils/errors', () => {
  class AppError extends Error {
    name = 'AppError';
    constructor(message: string, _code?: string, _status?: number) {
      super(message);
    }
  }
  return { AppError, SharedErrorCodes: { SYSTEM_INTERNAL_ERROR: 'SYSTEM_INTERNAL_ERROR' } };
});

// --- Imports (must be after vi.mock declarations) ---

import { ttsApi } from '../tts';
import { request } from '../client';
import { AppError } from '../../../utils/errors';

// --- Tests ---

describe('ttsApi', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockState.token = null;
    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(new Blob()),
    } as unknown as Response);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
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

    it('应该发送 POST 请求到 /ai/tts', async () => {
      await ttsApi.synthesize(sampleData);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://api.test/ai/tts',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('应该传递 text, voice, speed 参数', async () => {
      await ttsApi.synthesize(sampleData);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(sampleData),
        }),
      );
    });

    it('应该在 token 存在时添加 Authorization 头', async () => {
      mockState.token = 'test-token';

      await ttsApi.synthesize(sampleData);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        }),
      );
    });

    it('应该在 token 不存在时省略 Authorization 头', async () => {
      await ttsApi.synthesize(sampleData);

      const [, options] = vi.mocked(globalThis.fetch).mock.calls[0];
      expect(options.headers.Authorization).toBeUndefined();
    });

    it('应该在 401 时调用 setUser 清除用户', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: false,
        status: 401,
        text: vi.fn().mockResolvedValue('Unauthorized'),
      } as unknown as Response);

      await expect(ttsApi.synthesize(sampleData)).rejects.toThrow();

      expect(mockSetUser).toHaveBeenCalledWith(null, null);
    });

    it('应该在 500 时抛出 AppError', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue('Server Error'),
      } as unknown as Response);

      await expect(ttsApi.synthesize(sampleData)).rejects.toThrow(AppError);
    });

    it('应该在成功时返回 blob', async () => {
      const mockBlob = new Blob(['audio data']);
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(mockBlob),
      } as unknown as Response);

      const result = await ttsApi.synthesize(sampleData);

      expect(result).toBe(mockBlob);
    });
  });
});