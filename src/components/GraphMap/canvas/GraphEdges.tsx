import React, { memo, useMemo } from "react";
import type {
  Edge,
  LayoutLink,
  LayoutNode,
  LinkStyle,
  LinkAnimation,
  GraphRelationType,
} from "../../../types";
import { MindMapLink } from "../../GraphEditor/canvas/MindMapLink";
import { getRelationColor } from "../../../utils/graphMapAdapter";

// 预构建合法关系类型集合，避免渲染中每次对边做数组 includes 判断
const VALID_RELATION_TYPE_SET = new Set<string>([
  'prerequisite',
  'extension',
  'related',
  'cross_domain',
]);

interface GraphEdgesProps {
  links: LayoutLink[];
  edges: Edge[];
  nodeMap: Map<string, LayoutNode>;
  focusedGraphId: string | null;
  neighborLinkIds: Set<string>;
  /** 焦点邻域内（两端都在选中节点一阶邻居集合内）的边 id 集合，用于聚焦时保持高亮 */
  focusHighlightLinkIds: Set<string>;
  linkHighlightState: Map<string, boolean>;
  selectedDomainIds: Set<string>;
  isDark: boolean;
  linkStyle: LinkStyle;
  linkAnimation: LinkAnimation;
}

const GraphEdgesComponent: React.FC<GraphEdgesProps> = ({
  links,
  edges,
  nodeMap,
  focusedGraphId,
  neighborLinkIds,
  focusHighlightLinkIds,
  linkHighlightState,
  selectedDomainIds,
  isDark,
  linkStyle,
  linkAnimation,
}) => {
  const edgeColorMap = useMemo(() => {
    const map = new Map<string, string>();
    edges.forEach((edge) => {
      const relationType: GraphRelationType = VALID_RELATION_TYPE_SET.has(
        edge.relationship_type ?? '',
      )
        ? (edge.relationship_type as GraphRelationType)
        : 'related';
      map.set(edge.id, getRelationColor(relationType));
    });
    return map;
  }, [edges]);

  return (
    <>
      {links.map((link) => {
        const edgeColor = edgeColorMap.get(link.id) ?? "#6B7280";
        const isFocused = focusedGraphId
          ? neighborLinkIds.has(link.id)
          : false;
        const hasFocus = focusedGraphId !== null;
        // 聚焦时仅邻域内边高亮、其余变暗；无聚焦时才走域名过滤高亮
        const highlighted = hasFocus
          ? focusHighlightLinkIds.has(link.id)
          : (linkHighlightState.get(link.id) || false);

        return (
          <MindMapLink
            key={link.id}
            link={link}
            nodes={nodeMap}
            isDark={isDark}
            highlighted={highlighted}
            focused={isFocused}
            hasFocusMode={hasFocus || selectedDomainIds.size > 0}
            linkStyle={linkStyle}
            linkAnimation={linkAnimation}
            customColor={edgeColor}
          />
        );
      })}
    </>
  );
};

const areEqual = (prev: GraphEdgesProps, next: GraphEdgesProps) => {
  return (
    prev.links.length === next.links.length &&
    prev.edges.length === next.edges.length &&
    prev.focusedGraphId === next.focusedGraphId &&
    prev.neighborLinkIds.size === next.neighborLinkIds.size &&
    prev.focusHighlightLinkIds.size === next.focusHighlightLinkIds.size &&
    prev.linkHighlightState === next.linkHighlightState &&
    prev.selectedDomainIds === next.selectedDomainIds &&
    prev.isDark === next.isDark &&
    prev.linkStyle === next.linkStyle &&
    prev.linkAnimation === next.linkAnimation
  );
};

export const GraphEdges = memo(GraphEdgesComponent, areEqual);
