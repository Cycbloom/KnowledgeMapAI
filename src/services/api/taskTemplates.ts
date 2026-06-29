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
  category?: 'study' | 'work' | 'life' | 'health' | 'custom';
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
  category?: 'study' | 'work' | 'life' | 'health' | 'custom';
  title_template?: string;
  description_template?: string;
  estimated_duration?: number;
  tags?: string[];
  priority?: number;
  is_default?: boolean;
}

export interface TemplateFilters {
  category?: 'study' | 'work' | 'life' | 'health' | 'custom';
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
  { value: 'study', label: '学习', icon: '📚', color: 'blue', count: 0 },
  { value: 'work', label: '工作', icon: '💼', color: 'purple', count: 0 },
  { value: 'life', label: '生活', icon: '🏠', color: 'green', count: 0 },
  { value: 'health', label: '健康', icon: '💪', color: 'red', count: 0 },
  { value: 'custom', label: '自定义', icon: '⭐', color: 'amber', count: 0 },
];

export const taskTemplatesApi = {
  getTemplates: (filters?: TemplateFilters) => {
    const params = new URLSearchParams();
    if (filters?.category) params.append('category', filters.category);
    if (filters?.search) params.append('search', filters.search);
    const queryString = params.toString();
    return request(`/scheduler/templates${queryString ? `?${queryString}` : ''}`);
  },

  getTemplate: (id: string) => request(`/scheduler/templates/${id}`),

  getCategories: (): Promise<{ data: TemplateCategory[] }> =>
    request('/scheduler/templates/categories'),

  createTemplate: (data: CreateTemplateData) =>
    request('/scheduler/templates', { method: 'POST', body: JSON.stringify(data) }),

  updateTemplate: (id: string, data: UpdateTemplateData) =>
    request(`/scheduler/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteTemplate: (id: string) =>
    request(`/scheduler/templates/${id}`, { method: 'DELETE' }),

  applyTemplate: (id: string, data?: ApplyTemplateData) =>
    request(`/scheduler/templates/${id}/apply`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),

  duplicateTemplate: (id: string, name?: string) =>
    request(`/scheduler/templates/${id}/duplicate`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  setDefaultTemplate: (id: string) =>
    request(`/scheduler/templates/${id}/set-default`, { method: 'POST' }),
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
    study: 'blue',
    work: 'purple',
    life: 'green',
    health: 'red',
    custom: 'amber',
  };
  return colors[category] || 'slate';
}

export function getCategoryBgClass(category: string): string {
  const classes: Record<string, string> = {
    study: 'bg-blue-100 dark:bg-blue-500/20',
    work: 'bg-purple-100 dark:bg-purple-500/20',
    life: 'bg-green-100 dark:bg-green-500/20',
    health: 'bg-red-100 dark:bg-red-500/20',
    custom: 'bg-amber-100 dark:bg-amber-500/20',
  };
  return classes[category] || 'bg-slate-100 dark:bg-slate-500/20';
}

export function getCategoryTextClass(category: string): string {
  const classes: Record<string, string> = {
    study: 'text-blue-700 dark:text-blue-300',
    work: 'text-purple-700 dark:text-purple-300',
    life: 'text-green-700 dark:text-green-300',
    health: 'text-red-700 dark:text-red-300',
    custom: 'text-amber-700 dark:text-amber-300',
  };
  return classes[category] || 'text-slate-700 dark:text-slate-300';
}
