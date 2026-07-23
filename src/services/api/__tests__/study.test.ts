import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

// Mock request function from ./client
vi.mock('../client', () => ({
  request: vi.fn(),
}));

// --- Imports (must be after vi.mock declarations) ---

import { studyApi, dashboardApi, statisticsApi } from '../study';
import { request } from '../client';

// --- Tests ---

describe('studyApi', () => {
  beforeEach(() => {
    vi.mocked(request).mockClear();
  });

  describe('getCards', () => {
    it('应该在无参数时调用 /study/cards', () => {
      studyApi.getCards();
      expect(request).toHaveBeenCalledWith('/study/cards');
    });

    it('应该将 graph_id 拼接到查询参数', () => {
      studyApi.getCards({ graph_id: 'g1' });
      expect(request).toHaveBeenCalledWith('/study/cards?graph_id=g1');
    });

    it('应该将 knowledge_point_id 拼接到查询参数', () => {
      studyApi.getCards({ knowledge_point_id: 'kp1' });
      expect(request).toHaveBeenCalledWith(
        '/study/cards?knowledge_point_id=kp1',
      );
    });

    it('应该将 knowledge_point_ids 数组以逗号分隔拼接到查询参数', () => {
      studyApi.getCards({ knowledge_point_ids: ['kp1', 'kp2', 'kp3'] });
      expect(request).toHaveBeenCalledWith(
        '/study/cards?knowledge_point_ids=kp1%2Ckp2%2Ckp3',
      );
    });

    it('应该将 source_graph_id 拼接到查询参数', () => {
      studyApi.getCards({ source_graph_id: 'sg1' });
      expect(request).toHaveBeenCalledWith(
        '/study/cards?source_graph_id=sg1',
      );
    });

    it('应该在 due 为 true 时拼接 due=true', () => {
      studyApi.getCards({ due: true });
      expect(request).toHaveBeenCalledWith('/study/cards?due=true');
    });

    it('应该在 due 为 false 时不拼接 due 参数', () => {
      studyApi.getCards({ due: false });
      expect(request).toHaveBeenCalledWith('/study/cards');
    });

    it('应该将全部参数按顺序拼接到查询参数', () => {
      studyApi.getCards({
        graph_id: 'g1',
        knowledge_point_id: 'kp1',
        knowledge_point_ids: ['kp1', 'kp2'],
        source_graph_id: 'sg1',
        due: true,
      });
      expect(request).toHaveBeenCalledWith(
        '/study/cards?graph_id=g1&knowledge_point_id=kp1&knowledge_point_ids=kp1%2Ckp2&source_graph_id=sg1&due=true',
      );
    });
  });

  describe('getCardsByKnowledgePoint', () => {
    it('应该使用 knowledge_point_id 调用 /study/cards', () => {
      studyApi.getCardsByKnowledgePoint('kp1');
      expect(request).toHaveBeenCalledWith(
        '/study/cards?knowledge_point_id=kp1',
      );
    });

    it('应该将 source_graph_id 拼接到查询参数', () => {
      studyApi.getCardsByKnowledgePoint('kp1', { source_graph_id: 'sg1' });
      expect(request).toHaveBeenCalledWith(
        '/study/cards?knowledge_point_id=kp1&source_graph_id=sg1',
      );
    });

    it('应该在 due 为 true 时拼接 due=true', () => {
      studyApi.getCardsByKnowledgePoint('kp1', { due: true });
      expect(request).toHaveBeenCalledWith(
        '/study/cards?knowledge_point_id=kp1&due=true',
      );
    });

    it('应该将全部参数按顺序拼接到查询参数', () => {
      studyApi.getCardsByKnowledgePoint('kp1', {
        source_graph_id: 'sg1',
        due: true,
      });
      expect(request).toHaveBeenCalledWith(
        '/study/cards?knowledge_point_id=kp1&source_graph_id=sg1&due=true',
      );
    });
  });

  describe('createCardsBatch', () => {
    it('应该以 POST 方法调用 /study/cards/batch 并携带 cards 请求体', () => {
      const cards = [{ front: '问题', back: '答案' }];
      studyApi.createCardsBatch(cards);
      expect(request).toHaveBeenCalledWith('/study/cards/batch', {
        method: 'POST',
        body: JSON.stringify({ cards }),
      });
    });

    it('应该以空数组调用 /study/cards/batch', () => {
      studyApi.createCardsBatch([]);
      expect(request).toHaveBeenCalledWith('/study/cards/batch', {
        method: 'POST',
        body: JSON.stringify({ cards: [] }),
      });
    });
  });

  describe('update', () => {
    it('应该以 PUT 方法调用 /study/cards/:id 并携带请求体', () => {
      const data = { front: '更新后的问题' };
      studyApi.update('card-1', data);
      expect(request).toHaveBeenCalledWith('/study/cards/card-1', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    });

    it('应该将 id 正确插值到 URL', () => {
      studyApi.update('abc-123', { state: 'Review' });
      expect(request).toHaveBeenCalledWith('/study/cards/abc-123', {
        method: 'PUT',
        body: JSON.stringify({ state: 'Review' }),
      });
    });
  });

  describe('delete', () => {
    it('应该以 DELETE 方法调用 /study/cards/:id', () => {
      studyApi.delete('card-1');
      expect(request).toHaveBeenCalledWith('/study/cards/card-1', {
        method: 'DELETE',
      });
    });

    it('应该将 id 正确插值到 URL', () => {
      studyApi.delete('xyz-789');
      expect(request).toHaveBeenCalledWith('/study/cards/xyz-789', {
        method: 'DELETE',
      });
    });
  });

  describe('deleteBatch', () => {
    it('应该以 DELETE 方法调用 /study/cards/batch 并携带 ids 请求体', () => {
      const ids = ['card-1', 'card-2'];
      studyApi.deleteBatch(ids);
      expect(request).toHaveBeenCalledWith('/study/cards/batch', {
        method: 'DELETE',
        body: JSON.stringify({ ids }),
      });
    });

    it('应该以空数组调用 /study/cards/batch', () => {
      studyApi.deleteBatch([]);
      expect(request).toHaveBeenCalledWith('/study/cards/batch', {
        method: 'DELETE',
        body: JSON.stringify({ ids: [] }),
      });
    });
  });

  describe('updateProgress', () => {
    it('应该以 PUT 方法调用 /study/cards/:id/progress 并携带 quality 请求体', () => {
      studyApi.updateProgress('card-1', 4);
      expect(request).toHaveBeenCalledWith('/study/cards/card-1/progress', {
        method: 'PUT',
        body: JSON.stringify({ quality: 4 }),
      });
    });

    it('应该将 quality=0 正确传递', () => {
      studyApi.updateProgress('card-1', 0);
      expect(request).toHaveBeenCalledWith('/study/cards/card-1/progress', {
        method: 'PUT',
        body: JSON.stringify({ quality: 0 }),
      });
    });
  });

  describe('getCardGroups', () => {
    it('应该调用 /study/cards/groups/:knowledgePointId', () => {
      studyApi.getCardGroups('kp1');
      expect(request).toHaveBeenCalledWith(
        '/study/cards/groups/kp1',
      );
    });

    it('应该将 knowledgePointId 正确插值到 URL', () => {
      studyApi.getCardGroups('kp-abc-123');
      expect(request).toHaveBeenCalledWith(
        '/study/cards/groups/kp-abc-123',
      );
    });
  });

  describe('getStats', () => {
    it('应该在无参数时调用 /study/stats', () => {
      studyApi.getStats();
      expect(request).toHaveBeenCalledWith('/study/stats');
    });

    it('应该将 graphId 拼接到查询参数', () => {
      studyApi.getStats('g1');
      expect(request).toHaveBeenCalledWith('/study/stats?graph_id=g1');
    });
  });

  describe('getFsrsParameters', () => {
    it('应该调用 /study/fsrs-parameters', () => {
      studyApi.getFsrsParameters();
      expect(request).toHaveBeenCalledWith('/study/fsrs-parameters');
    });
  });

  describe('setFsrsParameters', () => {
    it('应该以 PUT 方法调用 /study/fsrs-parameters 并携带 w 请求体', () => {
      const w = [0.4, 0.6, 2.4, 5.8];
      studyApi.setFsrsParameters(w);
      expect(request).toHaveBeenCalledWith('/study/fsrs-parameters', {
        method: 'PUT',
        body: JSON.stringify({ w }),
      });
    });

    it('应该以空数组调用 /study/fsrs-parameters', () => {
      studyApi.setFsrsParameters([]);
      expect(request).toHaveBeenCalledWith('/study/fsrs-parameters', {
        method: 'PUT',
        body: JSON.stringify({ w: [] }),
      });
    });
  });

  describe('resetFsrsParameters', () => {
    it('应该以 DELETE 方法调用 /study/fsrs-parameters', () => {
      studyApi.resetFsrsParameters();
      expect(request).toHaveBeenCalledWith('/study/fsrs-parameters', {
        method: 'DELETE',
      });
    });
  });

  describe('optimizeFsrsParameters', () => {
    it('应该以 POST 方法调用 /study/fsrs-parameters/optimize', () => {
      studyApi.optimizeFsrsParameters();
      expect(request).toHaveBeenCalledWith(
        '/study/fsrs-parameters/optimize',
        {
          method: 'POST',
        },
      );
    });
  });

  describe('getSemanticGroups', () => {
    it('应该在无参数时调用 /study/semantic-groups', () => {
      studyApi.getSemanticGroups();
      expect(request).toHaveBeenCalledWith('/study/semantic-groups');
    });

    it('应该将 graphId 拼接到查询参数', () => {
      studyApi.getSemanticGroups('g1');
      expect(request).toHaveBeenCalledWith(
        '/study/semantic-groups?graph_id=g1',
      );
    });
  });
});

describe('dashboardApi', () => {
  beforeEach(() => {
    vi.mocked(request).mockClear();
  });

  describe('getStats', () => {
    it('应该调用 /dashboard/stats', () => {
      dashboardApi.getStats();
      expect(request).toHaveBeenCalledWith('/dashboard/stats');
    });
  });
});

describe('statisticsApi', () => {
  beforeEach(() => {
    vi.mocked(request).mockClear();
  });

  describe('getStats', () => {
    it('应该调用 /statistics', () => {
      statisticsApi.getStats();
      expect(request).toHaveBeenCalledWith('/statistics');
    });
  });
});
