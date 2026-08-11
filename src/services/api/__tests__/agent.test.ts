import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Mocks ---

vi.mock('../client', () => ({
  request: vi.fn(),
  getApiUrl: vi.fn(async () => 'http://api.test'),
  getHeaders: vi.fn(() => ({ 'Content-Type': 'application/json' })),
}));

vi.mock('@/utils/errors', () => {
  class AppError extends Error {
    name = 'AppError';
    constructor(message: string, _code: string, _status?: number) {
      super(message);
    }
  }
  return {
    AppError,
    SharedErrorCodes: {
      AI_INVALID_RESPONSE: 'AI_INVALID_RESPONSE',
      AI_PROVIDER_ERROR: 'AI_PROVIDER_ERROR',
    },
  };
});

// --- Imports ---

import { agentApi, type AgentSSEEvent } from '../agent';
import { request, getApiUrl } from '../client';

// --- Helpers ---

/** Create a mock Response object with an SSE stream body. */
function createSSEMockResponse(events: AgentSSEEvent[]): Response {
  const encoder = new TextEncoder();
  const chunks = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
  let read = false;
  return {
    ok: true,
    body: {
      getReader: () => ({
        read: async () => {
          if (!read) {
            read = true;
            return { done: false, value: encoder.encode(chunks) };
          }
          return { done: true, value: undefined };
        },
      }),
    },
  } as unknown as Response;
}

// --- Tests ---

describe('agentApi', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ========== request-based methods ==========

  describe('createSession', () => {
    it('should call POST /agent/sessions with empty object body', () => {
      agentApi.createSession();

      expect(request).toHaveBeenCalledWith('/agent/sessions', {
        method: 'POST',
        body: JSON.stringify({}),
      });
    });

    it('should pass skill_id and graph_ids in body', () => {
      agentApi.createSession({ skill_id: 's1', graph_ids: ['g1', 'g2'] });

      expect(request).toHaveBeenCalledWith('/agent/sessions', {
        method: 'POST',
        body: JSON.stringify({ skill_id: 's1', graph_ids: ['g1', 'g2'] }),
      });
    });
  });

  describe('getSession', () => {
    it('should call GET /agent/sessions/:id', () => {
      agentApi.getSession('session-1');

      expect(request).toHaveBeenCalledWith('/agent/sessions/session-1');
    });
  });

  describe('executeSession', () => {
    it('should call POST /agent/sessions/:id/execute', () => {
      agentApi.executeSession('session-1');

      expect(request).toHaveBeenCalledWith('/agent/sessions/session-1/execute', {
        method: 'POST',
        body: JSON.stringify({ custom_prompt: undefined }),
      });
    });
  });

  describe('getSkills', () => {
    it('should call GET /agent/skills', () => {
      agentApi.getSkills();

      expect(request).toHaveBeenCalledWith('/agent/skills');
    });
  });

  describe('getTools', () => {
    it('should call GET /agent/tools', () => {
      agentApi.getTools();

      expect(request).toHaveBeenCalledWith('/agent/tools');
    });
  });

  describe('request error', () => {
    it('should propagate request errors', async () => {
      vi.mocked(request).mockRejectedValue(new Error('Network error'));

      await expect(agentApi.createSession()).rejects.toThrow('Network error');
    });
  });

  // ========== fetch-based methods ==========

  describe('getSessions', () => {
    it('should fetch sessions and return data', async () => {
      const mockSessions = [{ id: 's1', status: 'completed' }];
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ sessions: mockSessions }),
      });

      const result = await agentApi.getSessions();

      expect(getApiUrl).toHaveBeenCalled();
      expect(globalThis.fetch).toHaveBeenCalledWith('http://api.test/agent/sessions', {
        headers: { 'Content-Type': 'application/json' },
      });
      expect(result).toEqual({ sessions: mockSessions });
    });
  });

  describe('deleteSession', () => {
    it('should send DELETE request via fetch', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });

      await agentApi.deleteSession('session-1');

      expect(getApiUrl).toHaveBeenCalled();
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://api.test/agent/sessions/session-1',
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
        },
      );
    });
  });

  describe('executeSessionStream', () => {
    it('should parse SSE events and call onEvent callback', async () => {
      const sseEvents: AgentSSEEvent[] = [
        { type: 'agent_message', data: { content: 'hello' } },
        { type: 'session_completed', data: { session: { id: 's1' } } },
      ];
      globalThis.fetch = vi.fn().mockResolvedValue(createSSEMockResponse(sseEvents));

      const onEvent = vi.fn();
      const onComplete = vi.fn();

      await agentApi.executeSessionStream('session-1', undefined, onEvent, undefined, onComplete);

      // Wait for the .then() chain to complete
      await vi.waitFor(() => {
        expect(onEvent).toHaveBeenCalledTimes(2);
      });

      expect(onEvent).toHaveBeenNthCalledWith(1, sseEvents[0]);
      expect(onEvent).toHaveBeenNthCalledWith(2, sseEvents[1]);
      expect(onComplete).toHaveBeenCalledOnce();
    });

    it('should call onError on HTTP error', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

      const onError = vi.fn();

      await agentApi.executeSessionStream('session-1', undefined, vi.fn(), onError);

      await vi.waitFor(() => {
        expect(onError).toHaveBeenCalledOnce();
      });

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ========== 补充的 request-based methods ==========

  describe('applyRecommendations', () => {
    it('should call POST /agent/recommendations/apply', () => {
      const recommendations = [{
        id: 'r1',
        source_graph_idx: 0,
        source_graph_title: 'Graph1',
        target_graph_idx: 1,
        target_graph_title: 'Graph2',
        relation_type: 'related' as const,
        reason: 'similar',
        confidence: 0.9,
      }];
      agentApi.applyRecommendations(recommendations);

      expect(request).toHaveBeenCalledWith('/agent/recommendations/apply', {
        method: 'POST',
        body: JSON.stringify({ recommendations, graphIndex: undefined }),
      });
    });
  });

  describe('mergeGraphs', () => {
    it('should call POST /graphs/merge', () => {
      agentApi.mergeGraphs(['g1', 'g2'], 'Merged Graph');

      expect(request).toHaveBeenCalledWith('/graphs/merge', {
        method: 'POST',
        body: JSON.stringify({ graph_ids: ['g1', 'g2'], target_title: 'Merged Graph' }),
      });
    });
  });

  describe('linkGraphs', () => {
    it('should call POST /graphs/batch-link', () => {
      agentApi.linkGraphs(['g1', 'g2'], 'prerequisite');

      expect(request).toHaveBeenCalledWith('/graphs/batch-link', {
        method: 'POST',
        body: JSON.stringify({ graph_ids: ['g1', 'g2'], relation_type: 'prerequisite' }),
      });
    });

    it('should default relation_type to "related"', () => {
      agentApi.linkGraphs(['g1', 'g2']);

      expect(request).toHaveBeenCalledWith('/graphs/batch-link', {
        method: 'POST',
        body: JSON.stringify({ graph_ids: ['g1', 'g2'], relation_type: 'related' }),
      });
    });
  });

  describe('dismissMergeSuggestion', () => {
    it('should call POST /agent/merge-suggestions/dismiss', () => {
      agentApi.dismissMergeSuggestion(['g1', 'g2']);

      expect(request).toHaveBeenCalledWith('/agent/merge-suggestions/dismiss', {
        method: 'POST',
        body: JSON.stringify({ graph_ids: ['g1', 'g2'] }),
      });
    });
  });

  describe('executeAutonomous', () => {
    it('should call POST /agent/sessions/:id/autonomous', () => {
      const goal = { type: 'analyze', description: 'test' };
      agentApi.executeAutonomous('session-1', goal);

      expect(request).toHaveBeenCalledWith('/agent/sessions/session-1/autonomous', {
        method: 'POST',
        body: JSON.stringify({ goal }),
      });
    });
  });

  describe('getPendingActions', () => {
    it('should call GET /agent/sessions/:id/pending-actions', () => {
      agentApi.getPendingActions('session-1');

      expect(request).toHaveBeenCalledWith('/agent/sessions/session-1/pending-actions');
    });
  });

  describe('confirmAction', () => {
    it('should call POST /agent/sessions/:id/actions/:actionId/confirm', () => {
      agentApi.confirmAction('session-1', 'action-1');

      expect(request).toHaveBeenCalledWith('/agent/sessions/session-1/actions/action-1/confirm', {
        method: 'POST',
      });
    });
  });

  describe('rejectAction', () => {
    it('should call POST /agent/sessions/:id/actions/:actionId/reject', () => {
      agentApi.rejectAction('session-1', 'action-1');

      expect(request).toHaveBeenCalledWith('/agent/sessions/session-1/actions/action-1/reject', {
        method: 'POST',
      });
    });
  });

  describe('batchConfirmActions', () => {
    it('should call POST /agent/sessions/:id/actions/batch-confirm', () => {
      agentApi.batchConfirmActions('session-1', ['a1', 'a2']);

      expect(request).toHaveBeenCalledWith('/agent/sessions/session-1/actions/batch-confirm', {
        method: 'POST',
        body: JSON.stringify({ action_ids: ['a1', 'a2'] }),
      });
    });
  });

  describe('batchRejectActions', () => {
    it('should call POST /agent/sessions/:id/actions/batch-reject', () => {
      agentApi.batchRejectActions('session-1', ['a1', 'a2']);

      expect(request).toHaveBeenCalledWith('/agent/sessions/session-1/actions/batch-reject', {
        method: 'POST',
        body: JSON.stringify({ action_ids: ['a1', 'a2'] }),
      });
    });
  });

  // ========== resumeSessionStream ==========

  describe('resumeSessionStream', () => {
    it('should parse SSE events and call onEvent callback', async () => {
      const sseEvents: AgentSSEEvent[] = [
        { type: 'agent_message', data: { content: 'resumed' } },
        { type: 'session_completed', data: { session: { id: 's1' } } },
      ];
      globalThis.fetch = vi.fn().mockResolvedValue(createSSEMockResponse(sseEvents));

      const onEvent = vi.fn();
      const onComplete = vi.fn();

      await agentApi.resumeSessionStream('session-1', onEvent, undefined, onComplete);

      await vi.waitFor(() => {
        expect(onEvent).toHaveBeenCalledTimes(2);
      });

      expect(onEvent).toHaveBeenNthCalledWith(1, sseEvents[0]);
      expect(onEvent).toHaveBeenNthCalledWith(2, sseEvents[1]);
      expect(onComplete).toHaveBeenCalledOnce();
    });

    it('should call onError on HTTP error', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

      const onError = vi.fn();

      await agentApi.resumeSessionStream('session-1', vi.fn(), onError);

      await vi.waitFor(() => {
        expect(onError).toHaveBeenCalledOnce();
      });

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});