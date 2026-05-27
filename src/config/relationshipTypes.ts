import { RelationshipTypeConfig, RelationshipCategory, EdgeLineStyle } from '../types';

export const PRESET_RELATIONSHIP_TYPES: Omit<RelationshipTypeConfig, 'id' | 'created_at' | 'updated_at'>[] = [
  { name: 'contains', display_name: '包含', category: 'hierarchical', color: '#3B82F6', line_style: 'solid', show_arrow: 'auto', is_builtin: true },
  { name: 'part_of', display_name: '属于', category: 'hierarchical', color: '#3B82F6', line_style: 'solid', show_arrow: 'auto', is_builtin: true },
  { name: 'parent_child', display_name: '父子', category: 'hierarchical', color: '#3B82F6', line_style: 'solid', show_arrow: 'auto', is_builtin: true },
  { name: 'derived_from', display_name: '派生自', category: 'hierarchical', color: '#F59E0B', line_style: 'dashed', show_arrow: true, is_builtin: true },

  { name: 'depends_on', display_name: '依赖', category: 'dependency', color: '#F59E0B', line_style: 'dashed', show_arrow: true, is_builtin: true },
  { name: 'prerequisite', display_name: '前提', category: 'dependency', color: '#EF4444', line_style: 'dashed', show_arrow: true, is_builtin: true },
  { name: 'constrains', display_name: '制约', category: 'dependency', color: '#F59E0B', line_style: 'dashed', show_arrow: true, is_builtin: true },
  { name: 'supports', display_name: '支撑', category: 'dependency', color: '#10B981', line_style: 'dashed', show_arrow: true, is_builtin: true },
  { name: 'mutex', display_name: '互斥', category: 'dependency', color: '#EF4444', line_style: 'dotted', show_arrow: false, is_builtin: true },
  { name: 'exclusive', display_name: '排他', category: 'dependency', color: '#EF4444', line_style: 'dotted', show_arrow: false, is_builtin: true },

  { name: 'related', display_name: '相关', category: 'semantic', color: '#6B7280', line_style: 'solid', show_arrow: false, is_builtin: true },
  { name: 'similar_to', display_name: '相似', category: 'semantic', color: '#8B5CF6', line_style: 'solid', show_arrow: false, is_builtin: true },
  { name: 'opposite', display_name: '相反', category: 'semantic', color: '#EC4899', line_style: 'solid', show_arrow: false, is_builtin: true },
  { name: 'synonym', display_name: '同义', category: 'semantic', color: '#8B5CF6', line_style: 'solid', show_arrow: false, is_builtin: true },
  { name: 'equivalent', display_name: '等价', category: 'semantic', color: '#8B5CF6', line_style: 'solid', show_arrow: false, is_builtin: true },
  { name: 'generalization', display_name: '泛化', category: 'semantic', color: '#10B981', line_style: 'solid', show_arrow: true, is_builtin: true },
  { name: 'specialization', display_name: '特化', category: 'semantic', color: '#10B981', line_style: 'solid', show_arrow: true, is_builtin: true },

  { name: 'follows', display_name: '后续', category: 'temporal', color: '#06B6D4', line_style: 'dashed', show_arrow: true, is_builtin: true },
  { name: 'parallel', display_name: '并行', category: 'temporal', color: '#06B6D4', line_style: 'solid', show_arrow: false, is_builtin: true },
  { name: 'branch', display_name: '分支', category: 'temporal', color: '#06B6D4', line_style: 'solid', show_arrow: true, is_builtin: true },
  { name: 'merge', display_name: '汇合', category: 'temporal', color: '#06B6D4', line_style: 'solid', show_arrow: true, is_builtin: true },
  { name: 'trigger', display_name: '触发', category: 'temporal', color: '#06B6D4', line_style: 'dashed', show_arrow: true, is_builtin: true },
  { name: 'loop', display_name: '循环', category: 'temporal', color: '#06B6D4', line_style: 'dashed', show_arrow: true, is_builtin: true },

  { name: 'points_to', display_name: '指向', category: 'interaction', color: '#F97316', line_style: 'solid', show_arrow: true, is_builtin: true },
  { name: 'acts_on', display_name: '作用', category: 'interaction', color: '#F97316', line_style: 'solid', show_arrow: true, is_builtin: true },
  { name: 'influences', display_name: '影响', category: 'interaction', color: '#F97316', line_style: 'dashed', show_arrow: true, is_builtin: true },
  { name: 'feedback', display_name: '反馈', category: 'interaction', color: '#F97316', line_style: 'dashed', show_arrow: true, is_builtin: true },
  { name: 'calls', display_name: '调用', category: 'interaction', color: '#F97316', line_style: 'solid', show_arrow: true, is_builtin: true },

  { name: 'causes', display_name: '因果', category: 'causal', color: '#DC2626', line_style: 'solid', show_arrow: true, is_builtin: true },
  { name: 'derives', display_name: '推导', category: 'causal', color: '#DC2626', line_style: 'solid', show_arrow: true, is_builtin: true },
  { name: 'proportional', display_name: '正比', category: 'causal', color: '#DC2626', line_style: 'solid', show_arrow: false, is_builtin: true },
  { name: 'inverse', display_name: '反比', category: 'causal', color: '#DC2626', line_style: 'solid', show_arrow: false, is_builtin: true },
];

export const HIERARCHICAL_EDGE_TYPES = new Set([
  'contains',
  'parent_child',
  'part_of',
  'derived_from',
]);

const relationshipTypeMap = new Map<string, Omit<RelationshipTypeConfig, 'id' | 'created_at' | 'updated_at'>>();

PRESET_RELATIONSHIP_TYPES.forEach(type => {
  relationshipTypeMap.set(type.name, type);
});

export function getRelationshipTypeConfig(name: string): RelationshipTypeConfig | undefined {
  const config = relationshipTypeMap.get(name);
  if (!config) return undefined;

  return {
    ...config,
    id: `preset-${name}`,
  };
}

export function getRelationshipTypesByCategory(category: RelationshipCategory): RelationshipTypeConfig[] {
  return PRESET_RELATIONSHIP_TYPES
    .filter(type => type.category === category)
    .map(type => ({
      ...type,
      id: `preset-${type.name}`,
    }));
}

export function getDefaultRelationshipType(): RelationshipTypeConfig {
  const defaultType = PRESET_RELATIONSHIP_TYPES[0];
  return {
    ...defaultType,
    id: `preset-${defaultType.name}`,
  };
}

export function getRelationshipTypeColor(name: string): string {
  return relationshipTypeMap.get(name)?.color ?? '#6B7280';
}

export function getRelationshipTypeLineStyle(name: string): EdgeLineStyle {
  return relationshipTypeMap.get(name)?.line_style ?? 'solid';
}

export function getRelationshipTypeDisplayName(name: string): string {
  return relationshipTypeMap.get(name)?.display_name ?? name;
}

export const RELATIONSHIP_CATEGORY_LABELS: Record<RelationshipCategory, string> = {
  hierarchical: '层级结构',
  dependency: '依赖约束',
  semantic: '语义关系',
  temporal: '时序流程',
  interaction: '交互行为',
  causal: '因果推导',
  custom: '自定义',
};
