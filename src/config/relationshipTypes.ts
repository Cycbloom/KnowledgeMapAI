import { RelationshipTypeConfig, RelationshipCategory, EdgeLineStyle } from '../types';

/**
 * Preset relationship types.
 *
 * NOTE: This file is a pure data module and MUST NOT call `t()` directly.
 * For preset types, the `display_name` field holds an i18n key string
 * (e.g. `relationshipTypes.types.contains.displayName`).
 * Consumers MUST translate the key via `t()` before rendering.
 *
 * For user-created relationship types (loaded from the backend), the
 * `display_name` field is the user-entered literal text. In that case
 * `t(display_name)` falls back to returning the literal text itself
 * (i18next returns the key string when no translation is found).
 */
export const PRESET_RELATIONSHIP_TYPES: Omit<RelationshipTypeConfig, 'id' | 'created_at' | 'updated_at'>[] = [
  { name: 'contains', display_name: 'relationshipTypes.types.contains.displayName', category: 'hierarchical', color: '#3B82F6', line_style: 'solid', show_arrow: 'auto', is_builtin: true },
  { name: 'part_of', display_name: 'relationshipTypes.types.part_of.displayName', category: 'hierarchical', color: '#3B82F6', line_style: 'solid', show_arrow: 'auto', is_builtin: true },
  { name: 'parent_child', display_name: 'relationshipTypes.types.parent_child.displayName', category: 'hierarchical', color: '#3B82F6', line_style: 'solid', show_arrow: 'auto', is_builtin: true },
  { name: 'derived_from', display_name: 'relationshipTypes.types.derived_from.displayName', category: 'hierarchical', color: '#F59E0B', line_style: 'dashed', show_arrow: true, is_builtin: true },

  { name: 'depends_on', display_name: 'relationshipTypes.types.depends_on.displayName', category: 'dependency', color: '#F59E0B', line_style: 'dashed', show_arrow: true, is_builtin: true },
  { name: 'prerequisite', display_name: 'relationshipTypes.types.prerequisite.displayName', category: 'dependency', color: '#EF4444', line_style: 'dashed', show_arrow: true, is_builtin: true },
  { name: 'constrains', display_name: 'relationshipTypes.types.constrains.displayName', category: 'dependency', color: '#F59E0B', line_style: 'dashed', show_arrow: true, is_builtin: true },
  { name: 'supports', display_name: 'relationshipTypes.types.supports.displayName', category: 'dependency', color: '#10B981', line_style: 'dashed', show_arrow: true, is_builtin: true },
  { name: 'mutex', display_name: 'relationshipTypes.types.mutex.displayName', category: 'dependency', color: '#EF4444', line_style: 'dotted', show_arrow: false, is_builtin: true },
  { name: 'exclusive', display_name: 'relationshipTypes.types.exclusive.displayName', category: 'dependency', color: '#EF4444', line_style: 'dotted', show_arrow: false, is_builtin: true },

  { name: 'related', display_name: 'relationshipTypes.types.related.displayName', category: 'semantic', color: '#6B7280', line_style: 'solid', show_arrow: false, is_builtin: true },
  { name: 'similar_to', display_name: 'relationshipTypes.types.similar_to.displayName', category: 'semantic', color: '#8B5CF6', line_style: 'solid', show_arrow: false, is_builtin: true },
  { name: 'opposite', display_name: 'relationshipTypes.types.opposite.displayName', category: 'semantic', color: '#EC4899', line_style: 'solid', show_arrow: false, is_builtin: true },
  { name: 'synonym', display_name: 'relationshipTypes.types.synonym.displayName', category: 'semantic', color: '#8B5CF6', line_style: 'solid', show_arrow: false, is_builtin: true },
  { name: 'equivalent', display_name: 'relationshipTypes.types.equivalent.displayName', category: 'semantic', color: '#8B5CF6', line_style: 'solid', show_arrow: false, is_builtin: true },
  { name: 'generalization', display_name: 'relationshipTypes.types.generalization.displayName', category: 'semantic', color: '#10B981', line_style: 'solid', show_arrow: true, is_builtin: true },
  { name: 'specialization', display_name: 'relationshipTypes.types.specialization.displayName', category: 'semantic', color: '#10B981', line_style: 'solid', show_arrow: true, is_builtin: true },

  { name: 'follows', display_name: 'relationshipTypes.types.follows.displayName', category: 'temporal', color: '#06B6D4', line_style: 'dashed', show_arrow: true, is_builtin: true },
  { name: 'parallel', display_name: 'relationshipTypes.types.parallel.displayName', category: 'temporal', color: '#06B6D4', line_style: 'solid', show_arrow: false, is_builtin: true },
  { name: 'branch', display_name: 'relationshipTypes.types.branch.displayName', category: 'temporal', color: '#06B6D4', line_style: 'solid', show_arrow: true, is_builtin: true },
  { name: 'merge', display_name: 'relationshipTypes.types.merge.displayName', category: 'temporal', color: '#06B6D4', line_style: 'solid', show_arrow: true, is_builtin: true },
  { name: 'trigger', display_name: 'relationshipTypes.types.trigger.displayName', category: 'temporal', color: '#06B6D4', line_style: 'dashed', show_arrow: true, is_builtin: true },
  { name: 'loop', display_name: 'relationshipTypes.types.loop.displayName', category: 'temporal', color: '#06B6D4', line_style: 'dashed', show_arrow: true, is_builtin: true },

  { name: 'points_to', display_name: 'relationshipTypes.types.points_to.displayName', category: 'interaction', color: '#F97316', line_style: 'solid', show_arrow: true, is_builtin: true },
  { name: 'acts_on', display_name: 'relationshipTypes.types.acts_on.displayName', category: 'interaction', color: '#F97316', line_style: 'solid', show_arrow: true, is_builtin: true },
  { name: 'influences', display_name: 'relationshipTypes.types.influences.displayName', category: 'interaction', color: '#F97316', line_style: 'dashed', show_arrow: true, is_builtin: true },
  { name: 'feedback', display_name: 'relationshipTypes.types.feedback.displayName', category: 'interaction', color: '#F97316', line_style: 'dashed', show_arrow: true, is_builtin: true },
  { name: 'calls', display_name: 'relationshipTypes.types.calls.displayName', category: 'interaction', color: '#F97316', line_style: 'solid', show_arrow: true, is_builtin: true },

  { name: 'causes', display_name: 'relationshipTypes.types.causes.displayName', category: 'causal', color: '#DC2626', line_style: 'solid', show_arrow: true, is_builtin: true },
  { name: 'derives', display_name: 'relationshipTypes.types.derives.displayName', category: 'causal', color: '#DC2626', line_style: 'solid', show_arrow: true, is_builtin: true },
  { name: 'proportional', display_name: 'relationshipTypes.types.proportional.displayName', category: 'causal', color: '#DC2626', line_style: 'solid', show_arrow: false, is_builtin: true },
  { name: 'inverse', display_name: 'relationshipTypes.types.inverse.displayName', category: 'causal', color: '#DC2626', line_style: 'solid', show_arrow: false, is_builtin: true },
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

/**
 * Returns the i18n key (or fallback literal) for the display name of a
 * preset relationship type. Consumers MUST translate via `t()` before
 * rendering. If the type is unknown, the input `name` is returned as-is.
 *
 * Note: For user-created relationship types loaded from the backend, the
 * `display_name` is the user-entered literal text; `t()` will return the
 * literal text when the key is not found in the i18n resources.
 */
export function getRelationshipTypeDisplayName(name: string): string {
  return relationshipTypeMap.get(name)?.display_name ?? name;
}

/**
 * i18n keys for relationship category labels. Consumers should translate
 * via `t(RELATIONSHIP_CATEGORY_LABELS[category])`.
 */
export const RELATIONSHIP_CATEGORY_LABELS: Record<RelationshipCategory, string> = {
  hierarchical: 'relationshipTypes.categories.hierarchical',
  dependency: 'relationshipTypes.categories.dependency',
  semantic: 'relationshipTypes.categories.semantic',
  temporal: 'relationshipTypes.categories.temporal',
  interaction: 'relationshipTypes.categories.interaction',
  causal: 'relationshipTypes.categories.causal',
  custom: 'relationshipTypes.categories.custom',
};
