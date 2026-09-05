import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

vi.mock('../../../store/useStore', () => ({
  useStore: {
    getState: vi.fn(),
  },
}));

vi.mock('../../api/client', () => ({
  getApiUrl: vi.fn(),
  getCsrfToken: vi.fn(),
}));

vi.mock('../../../config/mobileApiConfig', () => ({
  isCapacitorMobile: vi.fn(),
}));

import { createStreamHandler } from '../streamHandler';
import { getApiUrl, getCsrfToken } from '../../api/client';
import { isCapacitorMobile } from '../../../config/mobileApiConfig';
import { useStore } from '../../../store/useStore';
import { AppError, SharedErrorCodes } from '../../../utils/errors';

// --- Helpers ---

const sseBody = (events: string[]): string =>
  events.map((e) => `data: ${e}\n\n`).join('');

const mockFetch = (body: string, status = 200): ReturnType<typeof vi.spyOn> => {
  const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(body, {
      status,
      headers: { 'Content-Type': 'text/event-stream' },
    }),
  );
  return spy;
};

// --- Tests ---

describe('createStreamHandler（唯一 SSE 出口）', () => {
  beforeEach(() => {
    vi.mocked(getApiUrl).mockResolvedValue('/api/v1');
    vi.mocked(getCsrfToken).mockReturnValue('csrf-1');
    vi.mocked(isCapacitorMobile).mockReturnValue(false);
    vi.mocked(useStore.getState).mockReturnValue({
      token: 'token-123',
      setUser: vi.fn(),
    });
  });

  it('应该经 getApiUrl 解析完整地址并携带鉴权/CSRF 头发起 SSE POST', async () => {
    const fetchSpy = mockFetch(sseBody(['[DONE]']));

    await createStreamHandler('/ai/chat', { message: 'hi' }, () => {});

    expect(fetchSpy).toHaveBeenCalledWith('/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-123',
        'x-csrf-token': 'csrf-1',
      },
      credentials: 'include',
      body: JSON.stringify({ message: 'hi' }),
    });
  });

  it('应该在移动端请求携带 x-mobile-client 头（后端 CSRF 豁免）', async () => {
    vi.mocked(isCapacitorMobile).mockReturnValue(true);
    const fetchSpy = mockFetch(sseBody(['[DONE]']));

    await createStreamHandler('/ai/chat', {}, () => {});

    const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers['x-mobile-client']).toBe('true');
  });

  it('应该把 data: 事件中的 content 逐块回调 onChunk 并在 [DONE] 结束', async () => {
    mockFetch(sseBody(['{"content":"你"}', '{"content":"好"}', '[DONE]']));
    const onChunk = vi.fn();

    await createStreamHandler('/ai/chat', {}, onChunk);

    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk).toHaveBeenNthCalledWith(1, '你');
    expect(onChunk).toHaveBeenNthCalledWith(2, '好');
  });

  it('应该在收到 error 事件时抛 AppError（AI_INVALID_RESPONSE）而非静默吞掉', async () => {
    mockFetch(sseBody(['{"error":"上游超时"}']));

    await expect(createStreamHandler('/ai/chat', {}, () => {})).rejects.toMatchObject({
      message: '上游超时',
      code: SharedErrorCodes.AI_INVALID_RESPONSE,
      statusCode: 502,
    });
  });

  it('应该在 401 响应时调用 onUnauthorized 并抛出包含响应文本的 AppError', async () => {
    mockFetch('Unauthorized access', 401);
    const onUnauthorized = vi.fn();

    await expect(
      createStreamHandler('/ai/chat', {}, () => {}, { onUnauthorized }),
    ).rejects.toThrow('Unauthorized access');
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('默认 401 处理应清除登录态', async () => {
    mockFetch('Unauthorized access', 401);
    const setUser = vi.fn();
    vi.mocked(useStore.getState).mockReturnValue({ token: 'token-123', setUser });

    await expect(createStreamHandler('/ai/chat', {}, () => {})).rejects.toThrow();
    expect(setUser).toHaveBeenCalledWith(null, null);
  });

  it('应该把扩展事件字段透传给 onEvent', async () => {
    mockFetch(sseBody(['{"content":"a","sources":["s1"]}', '[DONE]']));
    const onEvent = vi.fn();

    await createStreamHandler('/ai/chat', {}, () => {}, { onEvent });

    expect(onEvent).toHaveBeenCalledWith({ content: 'a', sources: ['s1'] });
  });
});
