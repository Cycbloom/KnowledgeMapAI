import { request } from './client';

export interface TaskTemplate {
  id: string;
  user_id?: string;
  name: string;
  description?: string;
  category: string;
  title_template: string;
  description_template?: string;
  estimated_duration: number;
  tags: string[];
  priority: number;
  is_default: boolean;
  is_system: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateTemplateData {
  name: string;
  description?: string;
  category?: 'knowledge' | 'project' | 'analysis' | 'architecture' | 'topicResearch' | 'creative';
  title_template: string;
  description_template?: string;
  estimated_duration?: number;
  tags?: string[];
  priority?: number;
  is_default?: boolean;
}

export interface UpdateTemplateData {
  name?: string;
  description?: string;
  category?: 'knowledge' | 'project' | 'analysis' | 'architecture' | 'topicResearch' | 'creative';
  title_template?: string;
  description_template?: string;
  estimated_duration?: number;
  tags?: string[];
  priority?: number;
  is_default?: boolean;
}

export interface TemplateFilters {
  category?: 'knowledge' | 'project' | 'analysis' | 'architecture' | 'topicResearch' | 'creative';
  search?: string;
}

export interface ApplyTemplateData {
  placeholders?: Record<string, string>;
  queue_level?: number;
  knowledge_point_id?: string;
  deadline?: string;
}

export interface TemplateCategory {
  value: string;
  label: string;
  icon: string;
  color: string;
  count: number;
}

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  { value: 'knowledge', label: '知识', icon: '📚', color: 'blue', count: 0 },
  { value: 'project', label: '项目', icon: '💼', color: 'purple', count: 0 },
  { value: 'analysis', label: '分析', icon: '🔍', color: 'amber', count: 0 },
  { value: 'architecture', label: '架构', icon: '🏗️', color: 'indigo', count: 0 },
  { value: 'topicResearch', label: '专题研究', icon: '🔬', color: 'purple', count: 0 },
  { value: 'creative', label: '创意', icon: '✨', color: 'pink', count: 0 },
];

/**
 * 将任意 category 字符串归一化为当前合法的新分类。
 *
 * 历史背景：早期版本的 task_templates.category 使用
 *   'study' | 'work' | 'life' | 'health' | 'custom'
 * 当前版本使用
 *   'knowledge' | 'project' | 'analysis' | 'architecture' | 'topicResearch' | 'creative'
 *
 * 数据库中可能仍存在历史数据（用户自建模板或未重新 seed 的环境），
 * UI 在渲染时必须将旧值映射到对应的新值，避免出现空白图标/裸 i18n key。
 */
const LEGACY_CATEGORY_MAP: Record<string, string> = {
  study: 'knowledge',
  work: 'project',
  life: 'creative',
  health: 'creative',
  custom: 'creative',
};

export function normalizeCategory(category: string): string {
  return LEGACY_CATEGORY_MAP[category] ?? category;
}

export const taskTemplatesApi = {
  getTemplates: (filters?: TemplateFilters) => {
    const params = new URLSearchParams();
    if (filters?.category) params.append('category', filters.category);
    if (filters?.search) params.append('search', filters.search);
    const queryString = params.toString();
    return request<{ success: boolean; data: TaskTemplate[]; total: number }>(`/scheduler/templates${queryString ? `?${queryString}` : ''}`);
  },

  getTemplate: (id: string) => request<{ success: boolean; data: TaskTemplate }>(`/scheduler/templates/${id}`),

  getCategories: (): Promise<{ success: boolean; data: TemplateCategory[] }> =>
    request<{ success: boolean; data: TemplateCategory[] }>('/scheduler/templates/categories'),

  createTemplate: (data: CreateTemplateData) =>
    request<{ success: boolean; data: TaskTemplate }>('/scheduler/templates', { method: 'POST', body: JSON.stringify(data) }),

  updateTemplate: (id: string, data: UpdateTemplateData) =>
    request<{ success: boolean; data: TaskTemplate }>(`/scheduler/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteTemplate: (id: string) =>
    request<{ success: boolean }>(`/scheduler/templates/${id}`, { method: 'DELETE' }),

  applyTemplate: (id: string, data?: ApplyTemplateData) =>
    request<{ success: boolean; data: unknown }>(`/scheduler/templates/${id}/apply`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),

  duplicateTemplate: (id: string, name?: string) =>
    request<{ success: boolean; data: TaskTemplate }>(`/scheduler/templates/${id}/duplicate`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  setDefaultTemplate: (id: string) =>
    request<{ success: boolean; data: TaskTemplate }>(`/scheduler/templates/${id}/set-default`, { method: 'POST' }),
};

export function extractPlaceholders(template: TaskTemplate): string[] {
  const titlePlaceholders = template.title_template.match(/\{\{([^}]+)\}\}/g) || [];
  const descPlaceholders = template.description_template?.match(/\{\{([^}]+)\}\}/g) || [];

  const allPlaceholders = [...titlePlaceholders, ...descPlaceholders];
  const uniqueKeys = new Set(
    allPlaceholders.map(p => p.slice(2, -2).trim())
  );

  return Array.from(uniqueKeys);
}

export function applyTemplatePlaceholders(
  template: TaskTemplate,
  placeholders?: Record<string, string>
): { title: string; description?: string } {
  let title = template.title_template;
  let description = template.description_template;

  if (placeholders) {
    for (const [key, value] of Object.entries(placeholders)) {
      const placeholder = `{{${key}}}`;
      title = title.replace(new RegExp(placeholder, 'g'), value);
      if (description) {
        description = description.replace(new RegExp(placeholder, 'g'), value);
      }
    }
  }

  const unresolvedPlaceholders = title.match(/\{\{[^}]+\}\}/g);
  if (unresolvedPlaceholders) {
    for (const placeholder of unresolvedPlaceholders) {
      const key = placeholder.slice(2, -2);
      title = title.replace(placeholder, key);
      if (description) {
        description = description.replace(placeholder, key);
      }
    }
  }

  return { title, description };
}

export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    knowledge: 'blue',
    project: 'purple',
    analysis: 'amber',
    architecture: 'indigo',
    topicResearch: 'purple',
    creative: 'pink',
  };
  return colors[category] || 'slate';
}

export function getCategoryBgClass(category: string): string {
  const classes: Record<string, string> = {
    knowledge: 'bg-blue-100 dark:bg-blue-500/20',
    project: 'bg-purple-100 dark:bg-purple-500/20',
    analysis: 'bg-amber-100 dark:bg-amber-500/20',
    architecture: 'bg-indigo-100 dark:bg-indigo-500/20',
    topicResearch: 'bg-purple-100 dark:bg-purple-500/20',
    creative: 'bg-pink-100 dark:bg-pink-500/20',
  };
  return classes[category] || 'bg-slate-100 dark:bg-slate-500/20';
}

export function getCategoryTextClass(category: string): string {
  const classes: Record<string, string> = {
    knowledge: 'text-blue-700 dark:text-blue-300',
    project: 'text-purple-700 dark:text-purple-300',
    analysis: 'text-amber-700 dark:text-amber-300',
    architecture: 'text-indigo-700 dark:text-indigo-300',
    topicResearch: 'text-purple-700 dark:text-purple-300',
    creative: 'text-pink-700 dark:text-pink-300',
  };
  return classes[category] || 'text-slate-700 dark:text-slate-300';
}
