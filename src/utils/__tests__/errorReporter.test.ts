import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AxiosError } from 'axios';
import { captureMessage, flushErrorsNow, getErrorQueue } from '../errorReporter';
import { request } from '../../services/api/client';

vi.mock('../../services/api/client', () => ({
  request: vi.fn(),
}));

const mockedRequest = vi.mocked(request);

const makeResponse = (status: number) =>
  ({ status, statusText: 'x', headers: {}, data: {}, config: {} }) as never;

const drainQueue = async () => {
  mockedRequest.mockResolvedValue({ success: true });
  await flushErrorsNow();
};

describe('errorReporter flushErrors reliability', () => {
  beforeEach(async () => {
    vi.stubGlobal('window', { location: { href: 'http://localhost' } });
    vi.stubGlobal('navigator', { userAgent: 'vitest' });
    vi.clearAllMocks();
    await drainQueue();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('clears the queue on a successful flush', async () => {
    mockedRequest.mockResolvedValue({ success: true });
    captureMessage('a');
    captureMessage('b');
    expect(getErrorQueue()).toHaveLength(2);

    await flushErrorsNow();

    expect(getErrorQueue()).toHaveLength(0);
    expect(mockedRequest).toHaveBeenCalledWith(
      '/analytics/errors',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('requeues errors on a transient network failure (no response)', async () => {
    mockedRequest.mockRejectedValue(new AxiosError('Network Error'));
    captureMessage('a');
    captureMessage('b');

    await flushErrorsNow();

    expect(getErrorQueue()).toHaveLength(2);
  });

  it('requeues errors on a 5xx server failure', async () => {
    mockedRequest.mockRejectedValue(
      new AxiosError('Server Error', 'ERR_BAD_RESPONSE', undefined, undefined, makeResponse(500)),
    );
    captureMessage('a');

    await flushErrorsNow();

    expect(getErrorQueue()).toHaveLength(1);
  });

  it('drops errors on a 4xx client failure to avoid infinite retries', async () => {
    mockedRequest.mockRejectedValue(
      new AxiosError('Bad Request', 'ERR_BAD_REQUEST', undefined, undefined, makeResponse(400)),
    );
    captureMessage('a');

    await flushErrorsNow();

    expect(getErrorQueue()).toHaveLength(0);
  });

  it('bounds the queue back to MAX_QUEUE_SIZE when requeueing', async () => {
    mockedRequest.mockRejectedValue(new AxiosError('Network Error'));
    // Push more than MAX_QUEUE_SIZE (10) items
    for (let i = 0; i < 12; i++) {
      captureMessage(`err-${i}`);
    }

    await flushErrorsNow();

    expect(getErrorQueue().length).toBeLessThanOrEqual(10);
  });
});