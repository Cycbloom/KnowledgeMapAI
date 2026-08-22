import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  CreateQuizSetData,
  UpdateQuizSetData,
  GenerateQuizData,
  RegenerateCardData,
} from '@shared/types/quiz';

// --- Mocks ---

// quiz.ts 从 './index' 导入 request，因此 mock '../index'
vi.mock('../index', () => ({
  request: vi.fn(),
}));

// --- Imports (must be after vi.mock declarations) ---

import { quizApi } from '../quiz';
import { request } from '../index';

// --- Tests ---

describe('quizApi', () => {
  beforeEach(() => {
    vi.mocked(request).mockClear();
  });

  describe('基础查询', () => {
    it('应该调用 list 请求 /quiz-sets 获取题集列表', async () => {
      await quizApi.list();
      expect(request).toHaveBeenCalledWith('/quiz-sets');
    });

    it('应该调用 get 将 id 插值到路径 /quiz-sets/{id}', async () => {
      await quizApi.get('quiz-set-1');
      expect(request).toHaveBeenCalledWith('/quiz-sets/quiz-set-1');
    });
  });

  describe('创建与更新', () => {
    it('应该调用 create 以 POST 请求 /quiz-sets 并传递 JSON body', async () => {
      const data: CreateQuizSetData = {
        title: '测试题集',
        description: '描述',
        graph_id: 'graph-1',
        config: {
          cardTypes: ['qa', 'choice'],
          difficulty: 'medium',
          knowledgePointIds: ['kp-1', 'kp-2'],
        },
      };
      await quizApi.create(data);
      expect(request).toHaveBeenCalledWith('/quiz-sets', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });

    it('应该调用 update 以 PUT 请求 /quiz-sets/{id} 并传递 JSON body', async () => {
      const data: UpdateQuizSetData = {
        title: '更新标题',
        status: 'ready',
      };
      await quizApi.update('quiz-set-1', data);
      expect(request).toHaveBeenCalledWith('/quiz-sets/quiz-set-1', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    });
  });

  describe('删除', () => {
    it('应该调用 delete 以 DELETE 请求 /quiz-sets/{id}', async () => {
      await quizApi.delete('quiz-set-1');
      expect(request).toHaveBeenCalledWith('/quiz-sets/quiz-set-1', {
        method: 'DELETE',
      });
    });
  });

  describe('生成题集', () => {
    it('应该调用 generate 以 POST 请求 /quiz-sets/generate 并传递 JSON body', async () => {
      const data: GenerateQuizData = {
        quiz_set_id: 'quiz-set-1',
        node_ids: ['kp-1'],
        config: {
          cardTypes: ['qa'],
          difficulty: 'easy',
          knowledgePointIds: ['kp-1'],
        },
      };
      await quizApi.generate(data);
      expect(request).toHaveBeenCalledWith('/quiz-sets/generate', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });

    it('应该调用 getGenerationProgress 将 taskId 插值到路径 /quiz-sets/generation/{taskId}', async () => {
      await quizApi.getGenerationProgress('task-1');
      expect(request).toHaveBeenCalledWith('/quiz-sets/generation/task-1');
    });
  });

  describe('regenerateCard - 可选 data 参数', () => {
    it('应该在传入 data 时以 POST 请求 /quiz-sets/{quizSetId}/regenerate/{cardId} 并传递 JSON body', async () => {
      const data: RegenerateCardData = {
        card_type: 'choice',
        custom_prompt: '生成更难的题目',
      };
      await quizApi.regenerateCard('quiz-set-1', 'card-1', data);
      expect(request).toHaveBeenCalledWith(
        '/quiz-sets/quiz-set-1/regenerate/card-1',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
      );
    });

    it('应该在不传 data 时 body 为空对象 {}', async () => {
      await quizApi.regenerateCard('quiz-set-1', 'card-1');
      expect(request).toHaveBeenCalledWith(
        '/quiz-sets/quiz-set-1/regenerate/card-1',
        {
          method: 'POST',
          body: JSON.stringify({}),
        },
      );
    });
  });

  describe('卡片管理', () => {
    it('应该调用 addCard 以 POST 请求 /quiz-sets/{quizSetId}/cards，body 为 { card_id }', async () => {
      await quizApi.addCard('quiz-set-1', 'card-1');
      expect(request).toHaveBeenCalledWith('/quiz-sets/quiz-set-1/cards', {
        method: 'POST',
        body: JSON.stringify({ card_id: 'card-1' }),
      });
    });

    it('应该调用 removeCard 以 DELETE 请求 /quiz-sets/{quizSetId}/cards/{cardId}', async () => {
      await quizApi.removeCard('quiz-set-1', 'card-1');
      expect(request).toHaveBeenCalledWith(
        '/quiz-sets/quiz-set-1/cards/card-1',
        { method: 'DELETE' },
      );
    });

    it('应该调用 addCards 以 POST 请求 /quiz-sets/{quizSetId}/cards/batch，body 为 { card_ids }', async () => {
      await quizApi.addCards('quiz-set-1', ['card-1', 'card-2']);
      expect(request).toHaveBeenCalledWith('/quiz-sets/quiz-set-1/cards/batch', {
        method: 'POST',
        body: JSON.stringify({ card_ids: ['card-1', 'card-2'] }),
      });
    });
  });
});
