import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

// Mock request function from ../client
vi.mock('../client', () => ({
  request: vi.fn(),
}));

// --- Imports (must be after vi.mock declarations) ---

import {
  learningPathsApi,
  learningPathApi,
  type CreateLearningPathInput,
  type UpdateLearningPathInput,
  type AddNodeInput,
  type UpdateProgressInput,
  type CreatePlanInput,
  type UpdatePlanInput,
  type GeneratePathInput,
} from '../learningPaths';
import { request } from '../client';

// --- Tests ---

describe('learningPathsApi', () => {
  beforeEach(() => {
    vi.mocked(request).mockClear();
  });

  describe('list - 可选 status 参数', () => {
    it('应该在不传 status 时请求 /learning-paths（无查询串）', async () => {
      await learningPathsApi.list();
      expect(request).toHaveBeenCalledWith('/learning-paths');
    });

    it('应该在传 status 时附加 ?status={status}', async () => {
      await learningPathsApi.list('active');
      expect(request).toHaveBeenCalledWith('/learning-paths?status=active');
    });
  });

  describe('get - 单个资源获取', () => {
    it('应该调用 get 将 id 插值到路径 /learning-paths/{id}', async () => {
      await learningPathsApi.get('path-1');
      expect(request).toHaveBeenCalledWith('/learning-paths/path-1');
    });
  });

  describe('create - 创建学习路径', () => {
    it('应该调用 create 以 POST 请求 /learning-paths 并传递 JSON body', async () => {
      const data: CreateLearningPathInput = {
        title: '机器学习路径',
        description: '从入门到精通',
      };
      await learningPathsApi.create(data);
      expect(request).toHaveBeenCalledWith('/learning-paths', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });
  });

  describe('update - 更新学习路径', () => {
    it('应该调用 update 以 PUT 请求 /learning-paths/{id} 并传递 JSON body', async () => {
      const data: UpdateLearningPathInput = {
        title: '更新标题',
        status: 'paused',
      };
      await learningPathsApi.update('path-1', data);
      expect(request).toHaveBeenCalledWith('/learning-paths/path-1', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    });
  });

  describe('delete - 删除学习路径', () => {
    it('应该调用 delete 以 DELETE 请求 /learning-paths/{id}?hard=true（默认永久删除）', async () => {
      await learningPathsApi.delete('path-1');
      expect(request).toHaveBeenCalledWith('/learning-paths/path-1?hard=true', {
        method: 'DELETE',
      });
    });

    it('hard 传 false 时使用软删除（归档）', async () => {
      await learningPathsApi.delete('path-1', false);
      expect(request).toHaveBeenCalledWith('/learning-paths/path-1', {
        method: 'DELETE',
      });
    });
  });

  describe('addNode - 添加节点', () => {
    it('应该调用 addNode 以 POST 请求 /learning-paths/{pathId}/nodes 并传递 JSON body', async () => {
      const data: AddNodeInput = {
        node_id: 'node-1',
        estimated_minutes: 30,
        difficulty_level: 2,
      };
      await learningPathsApi.addNode('path-1', data);
      expect(request).toHaveBeenCalledWith(
        '/learning-paths/path-1/nodes',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
      );
    });
  });

  describe('updateNodeStatus - 更新节点状态', () => {
    it('应该调用 updateNodeStatus 以 PUT 请求 /learning-paths/{pathId}/nodes/{nodeId}/status', async () => {
      await learningPathsApi.updateNodeStatus('path-1', 'node-1', 'completed');
      expect(request).toHaveBeenCalledWith(
        '/learning-paths/path-1/nodes/node-1/status',
        {
          method: 'PUT',
          body: JSON.stringify({ status: 'completed' }),
        },
      );
    });
  });

  describe('reorderNodes - 重排节点', () => {
    it('应该调用 reorderNodes 以 PUT 请求 /learning-paths/{pathId}/nodes/reorder', async () => {
      const nodeIds = ['node-1', 'node-2', 'node-3'];
      await learningPathsApi.reorderNodes('path-1', nodeIds);
      expect(request).toHaveBeenCalledWith(
        '/learning-paths/path-1/nodes/reorder',
        {
          method: 'PUT',
          body: JSON.stringify({ node_order: nodeIds }),
        },
      );
    });
  });

  describe('removeNode - 移除节点', () => {
    it('应该调用 removeNode 以 DELETE 请求 /learning-paths/{pathId}/nodes/{nodeId}', async () => {
      await learningPathsApi.removeNode('path-1', 'node-1');
      expect(request).toHaveBeenCalledWith(
        '/learning-paths/path-1/nodes/node-1',
        { method: 'DELETE' },
      );
    });
  });

  describe('getProgress - 获取进度', () => {
    it('应该调用 getProgress 请求 /learning-paths/{pathId}/progress', async () => {
      await learningPathsApi.getProgress('path-1');
      expect(request).toHaveBeenCalledWith('/learning-paths/path-1/progress');
    });
  });

  describe('updateProgress - 更新进度', () => {
    it('应该调用 updateProgress 以 PUT 请求 /learning-paths/{pathId}/progress', async () => {
      const data: UpdateProgressInput = {
        completed_nodes: 5,
        total_time_spent: 120,
      };
      await learningPathsApi.updateProgress('path-1', data);
      expect(request).toHaveBeenCalledWith(
        '/learning-paths/path-1/progress',
        {
          method: 'PUT',
          body: JSON.stringify(data),
        },
      );
    });
  });

  describe('createPlan - 创建计划', () => {
    it('应该调用 createPlan 以 POST 请求 /learning-paths/{pathId}/plans', async () => {
      const data: CreatePlanInput = {
        date: '2026-07-23',
        planned_nodes: ['node-1', 'node-2'],
        estimated_minutes: 60,
      };
      await learningPathsApi.createPlan('path-1', data);
      expect(request).toHaveBeenCalledWith(
        '/learning-paths/path-1/plans',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
      );
    });
  });

  describe('getPlans - URLSearchParams 构造', () => {
    it('应该在不传可选参数时请求 /learning-paths/{pathId}/plans（无查询串）', async () => {
      await learningPathsApi.getPlans('path-1');
      expect(request).toHaveBeenCalledWith('/learning-paths/path-1/plans');
    });

    it('应该在传 startDate 时附加 ?start_date={startDate}', async () => {
      await learningPathsApi.getPlans('path-1', '2026-07-01');
      expect(request).toHaveBeenCalledWith(
        '/learning-paths/path-1/plans?start_date=2026-07-01',
      );
    });

    it('应该在传 endDate 时附加 ?end_date={endDate}', async () => {
      await learningPathsApi.getPlans('path-1', undefined, '2026-07-31');
      expect(request).toHaveBeenCalledWith(
        '/learning-paths/path-1/plans?end_date=2026-07-31',
      );
    });

    it('应该在同时传 startDate 和 endDate 时附加两个查询参数', async () => {
      await learningPathsApi.getPlans('path-1', '2026-07-01', '2026-07-31');
      expect(request).toHaveBeenCalledWith(
        '/learning-paths/path-1/plans?start_date=2026-07-01&end_date=2026-07-31',
      );
    });
  });

  describe('getPlan - 获取单日计划', () => {
    it('应该调用 getPlan 请求 /learning-paths/{pathId}/plans/{date}', async () => {
      await learningPathsApi.getPlan('path-1', '2026-07-23');
      expect(request).toHaveBeenCalledWith(
        '/learning-paths/path-1/plans/2026-07-23',
      );
    });
  });

  describe('updatePlan - 更新计划', () => {
    it('应该调用 updatePlan 以 PUT 请求 /learning-paths/{pathId}/plans/{date}', async () => {
      const data: UpdatePlanInput = {
        actual_nodes: ['node-1'],
        actual_minutes: 45,
        completed: true,
      };
      await learningPathsApi.updatePlan('path-1', '2026-07-23', data);
      expect(request).toHaveBeenCalledWith(
        '/learning-paths/path-1/plans/2026-07-23',
        {
          method: 'PUT',
          body: JSON.stringify(data),
        },
      );
    });
  });

  describe('generateFromGraph - 从图谱生成路径', () => {
    it('应该调用 generateFromGraph 以 POST 请求 /learning-paths/generate', async () => {
      const data: GeneratePathInput = {
        goal: '掌握机器学习',
        goal_type: 'natural_language',
        daily_minutes_target: 30,
      };
      await learningPathsApi.generateFromGraph(data);
      expect(request).toHaveBeenCalledWith('/learning-paths/generate', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });
  });

  describe('adjust - 调整路径', () => {
    it('应该调用 adjust 以 POST 请求 /learning-paths/{id}/adjust', async () => {
      const data = {
        reason: '难度过高',
        adjustment_type: 'difficulty' as const,
      };
      await learningPathsApi.adjust('path-1', data);
      expect(request).toHaveBeenCalledWith(
        '/learning-paths/path-1/adjust',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
      );
    });
  });

  describe('getRecommendations - 获取推荐', () => {
    it('应该调用 getRecommendations 请求 /learning-paths/recommendations?graph_id={graphId}', async () => {
      await learningPathsApi.getRecommendations('graph-1');
      expect(request).toHaveBeenCalledWith(
        '/learning-paths/recommendations?graph_id=graph-1',
      );
    });
  });

  describe('autoSchedule - 可选 options 参数', () => {
    it('应该在不传 options 时 body 为空对象 {}', async () => {
      await learningPathsApi.autoSchedule('path-1');
      expect(request).toHaveBeenCalledWith(
        '/learning-paths/path-1/auto-schedule',
        {
          method: 'POST',
          body: JSON.stringify({}),
        },
      );
    });

    it('应该在传 options 时传递 start_date 和 daily_minutes', async () => {
      const options = {
        start_date: '2026-07-23',
        daily_minutes: 45,
      };
      await learningPathsApi.autoSchedule('path-1', options);
      expect(request).toHaveBeenCalledWith(
        '/learning-paths/path-1/auto-schedule',
        {
          method: 'POST',
          body: JSON.stringify(options),
        },
      );
    });
  });
});

describe('learningPathApi', () => {
  beforeEach(() => {
    vi.mocked(request).mockClear();
  });

  describe('getQuestions - 获取问题', () => {
    it('应该调用 getQuestions 以 POST 请求 /learning-paths/questions', async () => {
      const data = { graph_id: 'graph-1' };
      await learningPathApi.getQuestions(data);
      expect(request).toHaveBeenCalledWith('/learning-paths/questions', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });
  });

  describe('generate - 生成预览', () => {
    it('应该调用 generate 以 POST 请求 /learning-paths/generate-preview', async () => {
      const data = {
        graph_id: 'graph-1',
        target_goal: '掌握深度学习',
        learning_style: 'sequential' as const,
        daily_time_minutes: 30,
      };
      await learningPathApi.generate(data);
      expect(request).toHaveBeenCalledWith(
        '/learning-paths/generate-preview',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
      );
    });
  });

  describe('getProgress - 获取图谱进度', () => {
    it('应该调用 getProgress 请求 /learning-paths/progress/{graphId}', async () => {
      await learningPathApi.getProgress('graph-1');
      expect(request).toHaveBeenCalledWith(
        '/learning-paths/progress/graph-1',
      );
    });
  });
});
