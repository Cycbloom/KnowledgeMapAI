import React, { useMemo } from 'react';
import type { Edge, RelationshipTypeConfig } from '../../types';
import { getRelationshipTypeConfig, RELATIONSHIP_CATEGORY_LABELS } from '../../config/relationshipTypes';

interface RelationshipLegendProps {
  edges: Edge[];
  isDark: boolean;
  onClose?: () => void;
}

const LINE_STYLE_SAMPLES: Record<string, string> = {
  solid: 'M 0 10 L 40 10',
  dashed: 'M 0 10 L 10 10 M 15 10 L 25 10 M 30 10 L 40 10',
  dotted: 'M 0 10 L 5 10 M 10 10 L 15 10 M 20 10 L 25 10 M 30 10 L 35 10 M 40 10 L 45 10',
  double: 'M 0 8 L 40 8 M 0 12 L 40 12',
};

export const RelationshipLegend: React.FC<RelationshipLegendProps> = ({
  edges,
  isDark,
  onClose,
}) => {
  const usedRelationshipTypes = useMemo(() => {
    const typeMap = new Map<string, { config: RelationshipTypeConfig; count: number }>();
    
    edges.forEach(edge => {
      const typeName = edge.relationship_type || 'related';
      if (!typeMap.has(typeName)) {
        const config = getRelationshipTypeConfig(typeName);
        if (config) {
          typeMap.set(typeName, { config, count: 1 });
        }
      } else {
        const existing = typeMap.get(typeName)!;
        typeMap.set(typeName, { ...existing, count: existing.count + 1 });
      }
    });
    
    return Array.from(typeMap.values()).sort((a, b) => b.count - a.count);
  }, [edges]);

  if (usedRelationshipTypes.length === 0) {
    return null;
  }

  return (
    <div className={`
      p-3 rounded-lg shadow-lg max-w-xs
      ${isDark ? 'bg-slate-800 text-gray-200' : 'bg-white text-gray-800'}
    `}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">关系类型图例</h3>
        {onClose && (
          <button
            onClick={onClose}
            className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-slate-700`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      
      <div className="space-y-2">
        {usedRelationshipTypes.map(({ config, count }) => (
          <div key={config.id} className="flex items-center gap-2">
            <svg width="50" height="20" className="flex-shrink-0">
              <defs>
                {config.show_arrow && (
                  <marker
                    id={`legend-arrow-${config.id}`}
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="4"
                    markerHeight="4"
                    orient="auto"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill={config.color} />
                  </marker>
                )}
              </defs>
              <path
                d={LINE_STYLE_SAMPLES[config.line_style] || LINE_STYLE_SAMPLES.solid}
                stroke={config.color}
                strokeWidth="2"
                fill="none"
                strokeDasharray={config.line_style === 'dashed' ? '4,2' : config.line_style === 'dotted' ? '2,2' : 'none'}
                markerEnd={config.show_arrow ? `url(#legend-arrow-${config.id})` : undefined}
              />
            </svg>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium truncate">{config.display_name}</span>
                <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {count}
                </span>
              </div>
              <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {RELATIONSHIP_CATEGORY_LABELS[config.category]}
              </span>
            </div>
          </div>
        ))}
      </div>
      
      {usedRelationshipTypes.length > 1 && (
        <div className={`mt-2 pt-2 border-t ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            共 {usedRelationshipTypes.reduce((sum, { count }) => sum + count, 0)} 条边
          </span>
        </div>
      )}
    </div>
  );
};
