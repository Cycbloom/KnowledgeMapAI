import { RelationshipTypeConfig, RelationshipCategory, EdgeLineStyle } from '../types';

export const PRESET_RELATIONSHIP_TYPES: Omit<RelationshipTypeConfig, 'id' | 'created_at' | 'updated_at'>[] = [
  { name: 'contains', display_name: 'Contains', category: 'hierarchical', color: '#3B82F6', line_style: 'solid', show_arrow: 'auto', is_builtin: true },
  { name: 'part_of', display_name: 'Part Of', category: 'hierarchical', color: '#3B82F6', line_style: 'solid', show_arrow: 'auto', is_builtin: true },
  { name: 'parent_child', display_name: 'Parent-Child', category: 'hierarchical', color: '#3B82F6', line_style: 'solid', show_arrow: 'auto', is_builtin: true },
  { name: 'has_subcategory', display_name: 'Has Subcategory', category: 'hierarchical', color: '#3B82F6', line_style: 'solid', show_arrow: true, is_builtin: true },
  { name: 'instance_of', display_name: 'Instance Of', category: 'hierarchical', color: '#3B82F6', line_style: 'solid', show_arrow: true, is_builtin: true },

  { name: 'depends_on', display_name: 'Depends On', category: 'dependency', color: '#F59E0B', line_style: 'dashed', show_arrow: true, is_builtin: true },
  { name: 'prerequisite', display_name: 'Prerequisite', category: 'dependency', color: '#F59E0B', line_style: 'dashed', show_arrow: true, is_builtin: true },
  { name: 'requires', display_name: 'Requires', category: 'dependency', color: '#F59E0B', line_style: 'dashed', show_arrow: true, is_builtin: true },
  { name: 'blocks', display_name: 'Blocks', category: 'dependency', color: '#EF4444', line_style: 'dashed', show_arrow: true, is_builtin: true },

  { name: 'related_to', display_name: 'Related To', category: 'semantic', color: '#10B981', line_style: 'solid', show_arrow: false, is_builtin: true },
  { name: 'similar_to', display_name: 'Similar To', category: 'semantic', color: '#10B981', line_style: 'dotted', show_arrow: false, is_builtin: true },
  { name: 'contrasts_with', display_name: 'Contrasts With', category: 'semantic', color: '#8B5CF6', line_style: 'dashed', show_arrow: false, is_builtin: true },
  { name: 'synonym_of', display_name: 'Synonym Of', category: 'semantic', color: '#10B981', line_style: 'solid', show_arrow: false, is_builtin: true },
  { name: 'antonym_of', display_name: 'Antonym Of', category: 'semantic', color: '#8B5CF6', line_style: 'double', show_arrow: false, is_builtin: true },

  { name: 'precedes', display_name: 'Precedes', category: 'temporal', color: '#06B6D4', line_style: 'solid', show_arrow: true, is_builtin: true },
  { name: 'follows', display_name: 'Follows', category: 'temporal', color: '#06B6D4', line_style: 'solid', show_arrow: true, is_builtin: true },
  { name: 'concurrent_with', display_name: 'Concurrent With', category: 'temporal', color: '#06B6D4', line_style: 'dotted', show_arrow: false, is_builtin: true },

  { name: 'interacts_with', display_name: 'Interacts With', category: 'interaction', color: '#EC4899', line_style: 'solid', show_arrow: 'auto', is_builtin: true },
  { name: 'communicates_with', display_name: 'Communicates With', category: 'interaction', color: '#EC4899', line_style: 'dashed', show_arrow: 'auto', is_builtin: true },
  { name: 'collaborates_with', display_name: 'Collaborates With', category: 'interaction', color: '#EC4899', line_style: 'dotted', show_arrow: false, is_builtin: true },

  { name: 'causes', display_name: 'Causes', category: 'causal', color: '#EF4444', line_style: 'solid', show_arrow: true, is_builtin: true },
  { name: 'caused_by', display_name: 'Caused By', category: 'causal', color: '#EF4444', line_style: 'solid', show_arrow: true, is_builtin: true },
  { name: 'enables', display_name: 'Enables', category: 'causal', color: '#22C55E', line_style: 'solid', show_arrow: true, is_builtin: true },
  { name: 'prevents', display_name: 'Prevents', category: 'causal', color: '#EF4444', line_style: 'dashed', show_arrow: true, is_builtin: true },
];

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
  hierarchical: 'Hierarchical',
  dependency: 'Dependency',
  semantic: 'Semantic',
  temporal: 'Temporal',
  interaction: 'Interaction',
  causal: 'Causal',
  custom: 'Custom',
};
