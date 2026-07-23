import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

// Mock request function from ../client
vi.mock('../client', () => ({
  request: vi.fn(),
}));

// --- Imports (must be after vi.mock declarations) ---

import {
  taskTemplatesApi,
  TEMPLATE_CATEGORIES,
  extractPlaceholders,
  applyTemplatePlaceholders,
  getCategoryColor,
  getCategoryBgClass,
  getCategoryTextClass,
  type CreateTemplateData,
  type UpdateTemplateData,
  type TemplateFilters,
  type ApplyTemplateData,
  type TaskTemplate,
} from '../taskTemplates';
import { request } from '../client';

// --- Tests ---

describe('taskTemplatesApi', () => {
  beforeEach(() => {
    vi.mocked(request).mockClear();
  });

  describe('getTemplates - URLSearchParams 构造', () => {
    it('应该在不传 filters 时请求 /scheduler/templates（无查询串）', async () => {
      await taskTemplatesApi.getTemplates();
      expect(request).toHaveBeenCalledWith('/scheduler/templates');
    });

    it('应该在传入空 filters 时请求 /scheduler/templates（无查询串）', async () => {
      await taskTemplatesApi.getTemplates({});
      expect(request).toHaveBeenCalledWith('/scheduler/templates');
    });

    it('应该在传入 category 时附加 ?category={value}', async () => {
      const filters: TemplateFilters = { category: 'knowledge' };
      await taskTemplatesApi.getTemplates(filters);
      expect(request).toHaveBeenCalledWith(
        '/scheduler/templates?category=knowledge',
      );
    });

    it('应该在传入 search 时附加 ?search={value}', async () => {
      const filters: TemplateFilters = { search: '关键字' };
      await taskTemplatesApi.getTemplates(filters);
      expect(request).toHaveBeenCalledWith(
        `/scheduler/templates?search=${encodeURIComponent('关键字')}`,
      );
    });

    it('应该在传入完整 filters 时按顺序拼接 category 与 search', async () => {
      const filters: TemplateFilters = {
        category: 'project',
        search: '架构',
      };
      await taskTemplatesApi.getTemplates(filters);
      expect(request).toHaveBeenCalledWith(
        `/scheduler/templates?category=project&search=${encodeURIComponent('架构')}`,
      );
    });

    it('应该支持所有合法 category 值', async () => {
      const categories: TemplateFilters['category'][] = [
        'knowledge',
        'project',
        'analysis',
        'architecture',
        'topicResearch',
        'creative',
      ];
      for (const category of categories) {
        vi.mocked(request).mockClear();
        await taskTemplatesApi.getTemplates({ category });
        expect(request).toHaveBeenCalledWith(
          `/scheduler/templates?category=${category}`,
        );
      }
    });
  });

  describe('getTemplate - 路径插值', () => {
    it('应该调用 getTemplate 请求 /scheduler/templates/{id}', async () => {
      await taskTemplatesApi.getTemplate('tpl-1');
      expect(request).toHaveBeenCalledWith('/scheduler/templates/tpl-1');
    });

    it('应该正确替换不同 id 值', async () => {
      await taskTemplatesApi.getTemplate('abc-123-xyz');
      expect(request).toHaveBeenCalledWith(
        '/scheduler/templates/abc-123-xyz',
      );
    });
  });

  describe('getCategories', () => {
    it('应该调用 getCategories 请求 /scheduler/templates/categories', async () => {
      await taskTemplatesApi.getCategories();
      expect(request).toHaveBeenCalledWith(
        '/scheduler/templates/categories',
      );
    });
  });

  describe('createTemplate', () => {
    it('应该以 POST 请求 /scheduler/templates 并传递 JSON body', async () => {
      const data: CreateTemplateData = {
        name: '新模板',
        title_template: '任务 - {{topic}}',
      };
      await taskTemplatesApi.createTemplate(data);
      expect(request).toHaveBeenCalledWith('/scheduler/templates', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });

    it('应该在传入完整可选字段时一并序列化到 body', async () => {
      const data: CreateTemplateData = {
        name: '完整模板',
        description: '描述',
        category: 'analysis',
        title_template: '分析 {{target}}',
        description_template: '详情 {{target}}',
        estimated_duration: 60,
        tags: ['tag1', 'tag2'],
        priority: 3,
        is_default: true,
      };
      await taskTemplatesApi.createTemplate(data);
      expect(request).toHaveBeenCalledWith('/scheduler/templates', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });
  });

  describe('updateTemplate - 路径插值与 body', () => {
    it('应该以 PUT 请求 /scheduler/templates/{id} 并传递 JSON body', async () => {
      const data: UpdateTemplateData = { name: '更新名称' };
      await taskTemplatesApi.updateTemplate('tpl-1', data);
      expect(request).toHaveBeenCalledWith('/scheduler/templates/tpl-1', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    });

    it('应该在传入多个字段时一并序列化到 body', async () => {
      const data: UpdateTemplateData = {
        name: '新名',
        priority: 5,
        tags: ['a', 'b'],
        is_default: false,
      };
      await taskTemplatesApi.updateTemplate('tpl-2', data);
      expect(request).toHaveBeenCalledWith('/scheduler/templates/tpl-2', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    });
  });

  describe('deleteTemplate - 路径插值', () => {
    it('应该以 DELETE 请求 /scheduler/templates/{id}', async () => {
      await taskTemplatesApi.deleteTemplate('tpl-1');
      expect(request).toHaveBeenCalledWith('/scheduler/templates/tpl-1', {
        method: 'DELETE',
      });
    });
  });

  describe('applyTemplate - 路径插值与可选 body', () => {
    it('应该以 POST 请求 /scheduler/templates/{id}/apply 并传递 data', async () => {
      const data: ApplyTemplateData = {
        placeholders: { topic: 'React' },
        queue_level: 2,
        knowledge_point_id: 'kp-1',
        deadline: '2026-08-01',
      };
      await taskTemplatesApi.applyTemplate('tpl-1', data);
      expect(request).toHaveBeenCalledWith(
        '/scheduler/templates/tpl-1/apply',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
      );
    });

    it('应该在不传 data 时以空对象作为 body', async () => {
      await taskTemplatesApi.applyTemplate('tpl-1');
      expect(request).toHaveBeenCalledWith(
        '/scheduler/templates/tpl-1/apply',
        {
          method: 'POST',
          body: JSON.stringify({}),
        },
      );
    });

    it('应该在传入 undefined data 时以空对象作为 body', async () => {
      await taskTemplatesApi.applyTemplate('tpl-2', undefined);
      expect(request).toHaveBeenCalledWith(
        '/scheduler/templates/tpl-2/apply',
        {
          method: 'POST',
          body: JSON.stringify({}),
        },
      );
    });

    it('应该在传入空对象 data 时序列化为 {}', async () => {
      await taskTemplatesApi.applyTemplate('tpl-3', {});
      expect(request).toHaveBeenCalledWith(
        '/scheduler/templates/tpl-3/apply',
        {
          method: 'POST',
          body: JSON.stringify({}),
        },
      );
    });
  });

  describe('duplicateTemplate - 路径插值与可选 name', () => {
    it('应该以 POST 请求 /scheduler/templates/{id}/duplicate 并传递 name', async () => {
      await taskTemplatesApi.duplicateTemplate('tpl-1', '副本名称');
      expect(request).toHaveBeenCalledWith(
        '/scheduler/templates/tpl-1/duplicate',
        {
          method: 'POST',
          body: JSON.stringify({ name: '副本名称' }),
        },
      );
    });

    it('应该在不传 name 时 body 中 name 为 undefined', async () => {
      await taskTemplatesApi.duplicateTemplate('tpl-1');
      expect(request).toHaveBeenCalledWith(
        '/scheduler/templates/tpl-1/duplicate',
        {
          method: 'POST',
          body: JSON.stringify({ name: undefined }),
        },
      );
    });
  });

  describe('setDefaultTemplate - 路径插值', () => {
    it('应该以 POST 请求 /scheduler/templates/{id}/set-default', async () => {
      await taskTemplatesApi.setDefaultTemplate('tpl-1');
      expect(request).toHaveBeenCalledWith(
        '/scheduler/templates/tpl-1/set-default',
        { method: 'POST' },
      );
    });
  });
});

describe('TEMPLATE_CATEGORIES', () => {
  it('应该包含 6 个预定义分类', () => {
    expect(TEMPLATE_CATEGORIES).toHaveLength(6);
  });

  it('应该包含所有预期的 value 值', () => {
    const values = TEMPLATE_CATEGORIES.map(c => c.value);
    expect(values).toEqual([
      'knowledge',
      'project',
      'analysis',
      'architecture',
      'topicResearch',
      'creative',
    ]);
  });

  it('每个分类应包含 value/label/icon/color/count 字段', () => {
    for (const category of TEMPLATE_CATEGORIES) {
      expect(category).toHaveProperty('value');
      expect(category).toHaveProperty('label');
      expect(category).toHaveProperty('icon');
      expect(category).toHaveProperty('color');
      expect(category).toHaveProperty('count');
      expect(category.count).toBe(0);
    }
  });
});

describe('extractPlaceholders', () => {
  it('应该从 title_template 中提取 {{key}} 占位符', () => {
    const template = {
      ...baseTemplate,
      title_template: '任务 - {{topic}} 与 {{target}}',
      description_template: undefined,
    };
    expect(extractPlaceholders(template).sort()).toEqual(
      ['target', 'topic'].sort(),
    );
  });

  it('应该从 description_template 中提取 {{key}} 占位符', () => {
    const template = {
      ...baseTemplate,
      title_template: '无占位符标题',
      description_template: '分析 {{subject}}',
    };
    expect(extractPlaceholders(template)).toEqual(['subject']);
  });

  it('应该同时从 title 与 description 提取占位符', () => {
    const template = {
      ...baseTemplate,
      title_template: '{{topic}} 任务',
      description_template: '详情 {{topic}} 与 {{target}}',
    };
    expect(extractPlaceholders(template).sort()).toEqual(
      ['target', 'topic'].sort(),
    );
  });

  it('应该对重复的占位符去重', () => {
    const template = {
      ...baseTemplate,
      title_template: '{{topic}} {{topic}}',
      description_template: '{{topic}}',
    };
    expect(extractPlaceholders(template)).toEqual(['topic']);
  });

  it('应该对占位符 key 进行 trim', () => {
    const template = {
      ...baseTemplate,
      title_template: '任务 {{ topic }}',
    };
    expect(extractPlaceholders(template)).toEqual(['topic']);
  });

  it('应该在没有占位符时返回空数组', () => {
    const template = {
      ...baseTemplate,
      title_template: '无占位符',
      description_template: '无占位符描述',
    };
    expect(extractPlaceholders(template)).toEqual([]);
  });

  it('应该在 description_template 为 undefined 时仅从 title 提取', () => {
    const template = {
      ...baseTemplate,
      title_template: '{{key1}}',
      description_template: undefined,
    };
    expect(extractPlaceholders(template)).toEqual(['key1']);
  });
});

describe('applyTemplatePlaceholders', () => {
  it('应该用传入的值替换 title 中的占位符', () => {
    const template = {
      ...baseTemplate,
      title_template: '任务 - {{topic}}',
      description_template: undefined,
    };
    const result = applyTemplatePlaceholders(template, { topic: 'React' });
    expect(result.title).toBe('任务 - React');
    expect(result.description).toBeUndefined();
  });

  it('应该用传入的值替换 title 与 description 中的占位符', () => {
    const template = {
      ...baseTemplate,
      title_template: '任务 - {{topic}}',
      description_template: '详情 {{topic}}',
    };
    const result = applyTemplatePlaceholders(template, { topic: 'Vue' });
    expect(result.title).toBe('任务 - Vue');
    expect(result.description).toBe('详情 Vue');
  });

  it('应该替换同一占位符的多次出现', () => {
    const template = {
      ...baseTemplate,
      title_template: '{{topic}} - {{topic}}',
      description_template: undefined,
    };
    const result = applyTemplatePlaceholders(template, { topic: 'X' });
    expect(result.title).toBe('X - X');
  });

  it('应该将未传入值的占位符替换为 key 名', () => {
    const template = {
      ...baseTemplate,
      title_template: '任务 - {{topic}}',
      description_template: undefined,
    };
    const result = applyTemplatePlaceholders(template);
    expect(result.title).toBe('任务 - topic');
  });

  it('应该在未传入 placeholders 时将所有占位符替换为 key 名', () => {
    const template = {
      ...baseTemplate,
      title_template: '{{a}} 与 {{b}}',
      description_template: '详情 {{a}}',
    };
    const result = applyTemplatePlaceholders(template);
    expect(result.title).toBe('a 与 b');
    expect(result.description).toBe('详情 a');
  });

  it('应该在部分替换后剩余占位符替换为 key 名', () => {
    const template = {
      ...baseTemplate,
      title_template: '{{a}} - {{b}}',
      description_template: undefined,
    };
    const result = applyTemplatePlaceholders(template, { a: 'X' });
    expect(result.title).toBe('X - b');
  });

  it('应该正确处理 description_template 为 undefined 的情况', () => {
    const template = {
      ...baseTemplate,
      title_template: '{{key}}',
      description_template: undefined,
    };
    const result = applyTemplatePlaceholders(template, { key: '值' });
    expect(result.title).toBe('值');
    expect(result.description).toBeUndefined();
  });

  it('应该在传入空 placeholders 对象时将占位符替换为 key 名', () => {
    const template = {
      ...baseTemplate,
      title_template: '{{key}}',
      description_template: undefined,
    };
    const result = applyTemplatePlaceholders(template, {});
    expect(result.title).toBe('key');
  });
});

describe('getCategoryColor', () => {
  it('应该为 knowledge 返回 blue', () => {
    expect(getCategoryColor('knowledge')).toBe('blue');
  });

  it('应该为 project 返回 purple', () => {
    expect(getCategoryColor('project')).toBe('purple');
  });

  it('应该为 analysis 返回 amber', () => {
    expect(getCategoryColor('analysis')).toBe('amber');
  });

  it('应该为 architecture 返回 indigo', () => {
    expect(getCategoryColor('architecture')).toBe('indigo');
  });

  it('应该为 topicResearch 返回 purple', () => {
    expect(getCategoryColor('topicResearch')).toBe('purple');
  });

  it('应该为 creative 返回 pink', () => {
    expect(getCategoryColor('creative')).toBe('pink');
  });

  it('应该为未知分类返回 slate', () => {
    expect(getCategoryColor('unknown')).toBe('slate');
  });

  it('应该为空字符串返回 slate', () => {
    expect(getCategoryColor('')).toBe('slate');
  });
});

describe('getCategoryBgClass', () => {
  it('应该为 knowledge 返回对应 bg 类', () => {
    expect(getCategoryBgClass('knowledge')).toBe(
      'bg-blue-100 dark:bg-blue-500/20',
    );
  });

  it('应该为 creative 返回对应 bg 类', () => {
    expect(getCategoryBgClass('creative')).toBe(
      'bg-pink-100 dark:bg-pink-500/20',
    );
  });

  it('应该为 topicResearch 返回 purple 类', () => {
    expect(getCategoryBgClass('topicResearch')).toBe(
      'bg-purple-100 dark:bg-purple-500/20',
    );
  });

  it('应该为未知分类返回 slate 类', () => {
    expect(getCategoryBgClass('unknown')).toBe(
      'bg-slate-100 dark:bg-slate-500/20',
    );
  });
});

describe('getCategoryTextClass', () => {
  it('应该为 knowledge 返回对应 text 类', () => {
    expect(getCategoryTextClass('knowledge')).toBe(
      'text-blue-700 dark:text-blue-300',
    );
  });

  it('应该为 analysis 返回对应 text 类', () => {
    expect(getCategoryTextClass('analysis')).toBe(
      'text-amber-700 dark:text-amber-300',
    );
  });

  it('应该为 architecture 返回对应 text 类', () => {
    expect(getCategoryTextClass('architecture')).toBe(
      'text-indigo-700 dark:text-indigo-300',
    );
  });

  it('应该为未知分类返回 slate 类', () => {
    expect(getCategoryTextClass('unknown')).toBe(
      'text-slate-700 dark:text-slate-300',
    );
  });
});

// --- Helpers ---

const baseTemplate: TaskTemplate = {
  id: 'tpl-base',
  name: '基础模板',
  description: undefined,
  category: 'knowledge',
  title_template: '',
  description_template: undefined,
  estimated_duration: 30,
  tags: [],
  priority: 2,
  is_default: false,
  is_system: false,
  usage_count: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};
