import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

// Mock request function from ../client
vi.mock('../client', () => ({
  request: vi.fn(),
}));

// --- Imports (must be after vi.mock declarations) ---

import {
  templatesApi,
  promptsApi,
  focusApi,
  achievementsApi,
  periodicTasksApi,
  type SaveTemplateData,
  type UpdateTemplateData,
} from '../templates';
import { request } from '../client';

// --- Tests ---

describe('templatesApi', () => {
  beforeEach(() => {
    vi.mocked(request).mockClear();
  });

  describe('list - 可选 category 参数', () => {
    it('应该在不传 category 时请求 /templates（无查询串）', async () => {
      await templatesApi.list();
      expect(request).toHaveBeenCalledWith('/templates');
    });

    it('应该在传入 category 时附加 ?category={value}', async () => {
      await templatesApi.list('knowledge');
      expect(request).toHaveBeenCalledWith('/templates?category=knowledge');
    });

    it('应该在传入 project 时附加 ?category=project', async () => {
      await templatesApi.list('project');
      expect(request).toHaveBeenCalledWith('/templates?category=project');
    });
  });

  describe('get - 路径插值', () => {
    it('应该调用 get 请求 /templates/{id}', async () => {
      await templatesApi.get('tpl-1');
      expect(request).toHaveBeenCalledWith('/templates/tpl-1');
    });
  });

  describe('create - POST 请求', () => {
    it('应该调用 create 以 POST 请求 /templates 并传递 JSON body', async () => {
      const data: SaveTemplateData = {
        name: '知识图谱模板',
        nodes: [],
      };
      await templatesApi.create(data);
      expect(request).toHaveBeenCalledWith('/templates', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });

    it('应该在 data 包含完整字段时序列化全部字段', async () => {
      const data: SaveTemplateData = {
        name: '完整模板',
        description: '描述内容',
        category: 'architecture',
        nodes: [],
        tags: ['tag-1', 'tag-2'],
        estimated_nodes: 10,
      };
      await templatesApi.create(data);
      expect(request).toHaveBeenCalledWith('/templates', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });
  });

  describe('update - PUT 请求与路径插值', () => {
    it('应该调用 update 以 PUT 请求 /templates/{id} 并传递 JSON body', async () => {
      const data: UpdateTemplateData = {
        name: '更新后的名称',
      };
      await templatesApi.update('tpl-1', data);
      expect(request).toHaveBeenCalledWith('/templates/tpl-1', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    });

    it('应该在传入多字段 data 时序列化全部字段', async () => {
      const data: UpdateTemplateData = {
        name: '新名称',
        description: '新描述',
        category: 'creative',
        tags: ['a', 'b'],
      };
      await templatesApi.update('tpl-2', data);
      expect(request).toHaveBeenCalledWith('/templates/tpl-2', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    });
  });

  describe('delete - DELETE 请求与路径插值', () => {
    it('应该调用 delete 以 DELETE 请求 /templates/{id}', async () => {
      await templatesApi.delete('tpl-1');
      expect(request).toHaveBeenCalledWith('/templates/tpl-1', {
        method: 'DELETE',
      });
    });
  });

  describe('saveTemplate - create 的别名', () => {
    it('应该调用 saveTemplate 以 POST 请求 /templates 并传递 JSON body', async () => {
      const data: SaveTemplateData = {
        name: '别名模板',
        nodes: [],
      };
      await templatesApi.saveTemplate(data);
      expect(request).toHaveBeenCalledWith('/templates', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });
  });

  describe('updateTemplate - update 的别名', () => {
    it('应该调用 updateTemplate 以 PUT 请求 /templates/{id} 并传递 JSON body', async () => {
      const data: UpdateTemplateData = {
        name: '别名更新',
      };
      await templatesApi.updateTemplate('tpl-3', data);
      expect(request).toHaveBeenCalledWith('/templates/tpl-3', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    });
  });
});

describe('promptsApi', () => {
  beforeEach(() => {
    vi.mocked(request).mockClear();
  });

  describe('list - 可选 graphId 参数', () => {
    it('应该在不传 graphId 时请求 /prompts（无查询串）', async () => {
      await promptsApi.list();
      expect(request).toHaveBeenCalledWith('/prompts');
    });

    it('应该在传入 graphId 时附加 ?graph_id={value}', async () => {
      await promptsApi.list('graph-1');
      expect(request).toHaveBeenCalledWith('/prompts?graph_id=graph-1');
    });
  });

  describe('save - POST 请求', () => {
    it('应该调用 save 以 POST 请求 /prompts 并传递 JSON body', async () => {
      const data = {
        code: 'prompt-code',
        scope: 'user' as const,
        template_content: '模板内容',
      };
      await promptsApi.save(data);
      expect(request).toHaveBeenCalledWith('/prompts', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });

    it('应该在 data 包含 graph_id 时序列化全部字段', async () => {
      const data = {
        code: 'prompt-code',
        scope: 'graph' as const,
        template_content: '图级模板',
        graph_id: 'graph-1',
      };
      await promptsApi.save(data);
      expect(request).toHaveBeenCalledWith('/prompts', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });
  });

  describe('reset - DELETE 请求与路径插值', () => {
    it('应该调用 reset 以 DELETE 请求 /prompts/{id}', async () => {
      await promptsApi.reset('prompt-1');
      expect(request).toHaveBeenCalledWith('/prompts/prompt-1', {
        method: 'DELETE',
      });
    });
  });

  describe('optimize - POST 请求', () => {
    it('应该调用 optimize 以 POST 请求 /prompts/optimize 并传递 JSON body', async () => {
      const data = {
        template_content: '原始模板',
      };
      await promptsApi.optimize(data);
      expect(request).toHaveBeenCalledWith('/prompts/optimize', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });

    it('应该在传入 instruction 时序列化全部字段', async () => {
      const data = {
        template_content: '原始模板',
        instruction: '优化说明',
      };
      await promptsApi.optimize(data);
      expect(request).toHaveBeenCalledWith('/prompts/optimize', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });
  });
});

describe('focusApi', () => {
  beforeEach(() => {
    vi.mocked(request).mockClear();
  });

  describe('saveSession - POST 请求', () => {
    it('应该调用 saveSession 以 POST 请求 /scheduler/focus-sessions 并传递 JSON body', async () => {
      const data = {
        duration: 1500,
        mode: 'pomodoro',
        start_time: '2026-07-23T10:00:00Z',
        end_time: '2026-07-23T10:25:00Z',
      };
      await focusApi.saveSession(data);
      expect(request).toHaveBeenCalledWith('/scheduler/focus-sessions', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });

    it('应该在传入 task_id 时序列化全部字段', async () => {
      const data = {
        duration: 3000,
        mode: 'deep-work',
        start_time: '2026-07-23T09:00:00Z',
        end_time: '2026-07-23T09:50:00Z',
        task_id: 'task-1',
      };
      await focusApi.saveSession(data);
      expect(request).toHaveBeenCalledWith('/scheduler/focus-sessions', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });
  });

  describe('getStats - GET 请求', () => {
    it('应该调用 getStats 请求 /scheduler/focus-sessions/stats', async () => {
      await focusApi.getStats();
      expect(request).toHaveBeenCalledWith('/scheduler/focus-sessions/stats');
    });
  });

  describe('getTodayStats - GET 请求', () => {
    it('应该调用 getTodayStats 请求 /scheduler/focus-sessions/today', async () => {
      await focusApi.getTodayStats();
      expect(request).toHaveBeenCalledWith('/scheduler/focus-sessions/today');
    });
  });
});

describe('achievementsApi', () => {
  beforeEach(() => {
    vi.mocked(request).mockClear();
  });

  describe('list - GET 请求', () => {
    it('应该调用 list 请求 /achievements', async () => {
      await achievementsApi.list();
      expect(request).toHaveBeenCalledWith('/achievements');
    });
  });

  describe('check - POST 请求', () => {
    it('应该调用 check 以 POST 请求 /achievements/check 并传递 type 与 value', async () => {
      await achievementsApi.check('graphs_created', 10);
      expect(request).toHaveBeenCalledWith('/achievements/check', {
        method: 'POST',
        body: JSON.stringify({ type: 'graphs_created', value: 10 }),
      });
    });
  });

  describe('getDailyTasks - GET 请求', () => {
    it('应该调用 getDailyTasks 请求 /achievements/daily-tasks', async () => {
      await achievementsApi.getDailyTasks();
      expect(request).toHaveBeenCalledWith('/achievements/daily-tasks');
    });
  });

  describe('checkIn - POST 请求', () => {
    it('应该调用 checkIn 以 POST 请求 /achievements/daily-tasks/check-in', async () => {
      await achievementsApi.checkIn();
      expect(request).toHaveBeenCalledWith(
        '/achievements/daily-tasks/check-in',
        { method: 'POST' },
      );
    });
  });
});

describe('periodicTasksApi', () => {
  beforeEach(() => {
    vi.mocked(request).mockClear();
  });

  describe('list - GET 请求', () => {
    it('应该调用 list 请求 /periodic-tasks', async () => {
      await periodicTasksApi.list();
      expect(request).toHaveBeenCalledWith('/periodic-tasks');
    });
  });

  describe('check - POST 请求', () => {
    it('应该调用 check 以 POST 请求 /periodic-tasks/check 并传递 taskType 与 value', async () => {
      await periodicTasksApi.check('daily_login', 1);
      expect(request).toHaveBeenCalledWith('/periodic-tasks/check', {
        method: 'POST',
        body: JSON.stringify({ taskType: 'daily_login', value: 1 }),
      });
    });
  });

  describe('getPass - GET 请求', () => {
    it('应该调用 getPass 请求 /periodic-tasks/pass', async () => {
      await periodicTasksApi.getPass();
      expect(request).toHaveBeenCalledWith('/periodic-tasks/pass');
    });
  });

  describe('claimReward - POST 请求', () => {
    it('应该调用 claimReward 以 POST 请求 /periodic-tasks/pass/claim 并传递 passId 与 level', async () => {
      await periodicTasksApi.claimReward('pass-1', 5);
      expect(request).toHaveBeenCalledWith('/periodic-tasks/pass/claim', {
        method: 'POST',
        body: JSON.stringify({ passId: 'pass-1', level: 5 }),
      });
    });
  });

  describe('checkStreak - POST 请求', () => {
    it('应该调用 checkStreak 以 POST 请求 /periodic-tasks/streak/check', async () => {
      await periodicTasksApi.checkStreak();
      expect(request).toHaveBeenCalledWith('/periodic-tasks/streak/check', {
        method: 'POST',
      });
    });
  });
});
