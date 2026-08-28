import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Edge } from '../../../types';
import {
  getRelationshipTypeColor,
  getRelationshipTypeLineStyle,
  getRelationshipTypeDisplayName,
  HIERARCHICAL_EDGE_TYPES,
} from '../../../config/relationshipTypes';

interface EdgeTypeLegendProps {
  edges: Edge[];
  selectedNodeId: string | null;
  isDark?: boolean;
  /** 相对底部偏移（px），用于避开左下角缩放指示器等固定元素 */
  bottom?: number;
}

const LINE_STYLE_DASH: Record<string, string> = {
  solid: 'none',
  dashed: '6,3',
  dotted: '2,2',
  double: '3,2,1,2',
};

/**
 * 左下角动态连线图例。
 *
 * 仅当选中节点时显示：收集与选中节点直接相连的边，去重后列出其关系类型
 * （颜色 + 线型 + 名称）。避免一次性展示全部几十种关系类型造成信息过载，
 * 让用户聚焦「当前节点相关的连线到底是什么意思」。
 */
export const EdgeTypeLegend = React.memo(
  function EdgeTypeLegend({
    edges,
    selectedNodeId,
    isDark = false,
    bottom = 48,
  }: EdgeTypeLegendProps) {
    const { t } = useTranslation();

    const items = useMemo(() => {
      if (!selectedNodeId) return [];

      // 高亮邻域：选中节点 + 通过层级边直接相连的父/子节点（一级）
      const neighborhood = new Set<string>([selectedNodeId]);
      for (const edge of edges) {
        const isHierarchical =
          !!edge.relationship_type &&
          HIERARCHICAL_EDGE_TYPES.has(edge.relationship_type);
        if (!isHierarchical) continue;
        if (edge.source_knowledge_point_id === selectedNodeId) {
          neighborhood.add(edge.target_knowledge_point_id);
        }
        if (edge.target_knowledge_point_id === selectedNodeId) {
          neighborhood.add(edge.source_knowledge_point_id);
        }
      }

      const seen = new Set<string>();
      const result: Array<{
        type: string;
        label: string;
        color: string;
        lineStyle: string;
      }> = [];
      for (const edge of edges) {
        const src = edge.source_knowledge_point_id;
        const tgt = edge.target_knowledge_point_id;
        // 与选中节点直接相连的边，或两端都在高亮邻域内的边（如子节点间的依赖关系）
        const incidentToSelected = src === selectedNodeId || tgt === selectedNodeId;
        const withinNeighborhood = neighborhood.has(src) && neighborhood.has(tgt);
        if (!incidentToSelected && !withinNeighborhood) continue;

        const type = edge.relationship_type;
        if (!type || seen.has(type)) continue;
        seen.add(type);
        result.push({
          type,
          label: t(getRelationshipTypeDisplayName(type) as never),
          color: getRelationshipTypeColor(type),
          lineStyle: getRelationshipTypeLineStyle(type),
        });
      }
      return result;
    }, [edges, selectedNodeId, t]);

    if (items.length === 0) return null;

    return (
      <div
        style={{
          position: 'absolute',
          left: 16,
          bottom,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          padding: '8px 12px',
          borderRadius: 8,
          background: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(4px)',
          border: `1px solid ${isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 0.8)'}`,
          zIndex: 10,
          pointerEvents: 'none',
          maxWidth: 260,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: isDark ? '#94A3B8' : '#64748B',
          }}
        >
          {t('graphEditor.mindMap.edgeLegendTitle')}
        </div>
        {items.map((item) => (
          <div
            key={item.type}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 11,
              color: isDark ? '#CBD5E1' : '#334155',
            }}
          >
            <svg width={20} height={8} aria-hidden="true">
              <line
                x1={0}
                y1={4}
                x2={20}
                y2={4}
                stroke={item.color}
                strokeWidth={2}
                strokeDasharray={LINE_STYLE_DASH[item.lineStyle] ?? 'none'}
              />
            </svg>
            <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>
          </div>
        ))}
      </div>
    );
  },
);

export default EdgeTypeLegend;
