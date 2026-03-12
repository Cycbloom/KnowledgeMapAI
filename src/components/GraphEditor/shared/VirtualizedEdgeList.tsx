import { useMemo, memo } from 'react';
import type { LayoutLink, LayoutNode, LinkStyle, LinkAnimation, EdgeWidthMode, Edge, Node } from '../../../types';
import { MindMapLink } from '../canvas/MindMapLink';

interface ViewportBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface VirtualizedEdgeListProps {
  links: LayoutLink[];
  allNodes: LayoutNode[];
  visibleNodeIds: Set<string>;
  nodeMap: Map<string, LayoutNode>;
  isDark: boolean;
  focusedLinkIds: Set<string>;
  hasFocusMode: boolean;
  linkStyle: LinkStyle;
  linkAnimation: LinkAnimation;
  edgeWidthMode: EdgeWidthMode;
  edgeStrengthMap: Map<string, number>;
  allNodesData: Node[];
  allEdgesData: Edge[];
  transform: { x: number; y: number; k: number };
  containerSize: { width: number; height: number };
  viewportVersion: number;
  onEdgeContextMenu?: (event: React.MouseEvent, link: LayoutLink) => void;
}

const BUFFER_SIZE = 150;

function isEdgeInViewport(
  sourcePos: { x: number; y: number } | undefined,
  targetPos: { x: number; y: number } | undefined,
  bounds: ViewportBounds
): boolean {
  if (!sourcePos || !targetPos) return false;
  
  const sourceInViewport = 
    sourcePos.x >= bounds.minX &&
    sourcePos.x <= bounds.maxX &&
    sourcePos.y >= bounds.minY &&
    sourcePos.y <= bounds.maxY;
  
  const targetInViewport = 
    targetPos.x >= bounds.minX &&
    targetPos.x <= bounds.maxX &&
    targetPos.y >= bounds.minY &&
    targetPos.y <= bounds.maxY;
  
  return sourceInViewport || targetInViewport;
}

function lineIntersectsViewport(
  source: { x: number; y: number },
  target: { x: number; y: number },
  bounds: ViewportBounds
): boolean {
  if (
    source.x >= bounds.minX && source.x <= bounds.maxX &&
    source.y >= bounds.minY && source.y <= bounds.maxY
  ) return true;
  
  if (
    target.x >= bounds.minX && target.x <= bounds.maxX &&
    target.y >= bounds.minY && target.y <= bounds.maxY
  ) return true;
  
  const left = bounds.minX;
  const right = bounds.maxX;
  const top = bounds.minY;
  const bottom = bounds.maxY;
  
  const x1 = source.x, y1 = source.y;
  const x2 = target.x, y2 = target.y;
  
  if (x1 < left && x2 < left) return false;
  if (x1 > right && x2 > right) return false;
  if (y1 < top && y2 < top) return false;
  if (y1 > bottom && y2 > bottom) return false;
  
  if (x1 >= left && x1 <= right && y1 >= top && y1 <= bottom) return true;
  if (x2 >= left && x2 <= right && y2 >= top && y2 <= bottom) return true;
  
  const dx = x2 - x1;
  const dy = y2 - y1;
  
  const checkLine = (x: number, y: number) => {
    if (x >= left && x <= right && y >= top && y <= bottom) return true;
    return false;
  };
  
  if (dx !== 0) {
    const tLeft = (left - x1) / dx;
    const tRight = (right - x1) / dx;
    
    if (tLeft >= 0 && tLeft <= 1) {
      const y = y1 + tLeft * dy;
      if (checkLine(left, y)) return true;
    }
    if (tRight >= 0 && tRight <= 1) {
      const y = y1 + tRight * dy;
      if (checkLine(right, y)) return true;
    }
  }
  
  if (dy !== 0) {
    const tTop = (top - y1) / dy;
    const tBottom = (bottom - y1) / dy;
    
    if (tTop >= 0 && tTop <= 1) {
      const x = x1 + tTop * dx;
      if (checkLine(x, top)) return true;
    }
    if (tBottom >= 0 && tBottom <= 1) {
      const x = x1 + tBottom * dx;
      if (checkLine(x, bottom)) return true;
    }
  }
  
  return false;
}

interface EdgeRendererProps {
  link: LayoutLink;
  nodeMap: Map<string, LayoutNode>;
  isDark: boolean;
  focused: boolean;
  hasFocusMode: boolean;
  linkStyle: LinkStyle;
  linkAnimation: LinkAnimation;
  edgeWidthMode: EdgeWidthMode;
  edgeStrength?: number;
  allNodes: Node[];
  allEdges: Edge[];
  onContextMenu?: (event: React.MouseEvent, link: LayoutLink) => void;
}

const EdgeRenderer = memo<EdgeRendererProps>(function EdgeRenderer({
  link,
  nodeMap,
  isDark,
  focused,
  hasFocusMode,
  linkStyle,
  linkAnimation,
  edgeWidthMode,
  edgeStrength,
  allNodes,
  allEdges,
  onContextMenu,
}) {
  return (
    <MindMapLink
      key={link.id}
      link={link}
      nodes={nodeMap}
      isDark={isDark}
      highlighted={false}
      focused={focused}
      hasFocusMode={hasFocusMode}
      linkStyle={linkStyle}
      linkAnimation={linkAnimation}
      edgeWidthMode={edgeWidthMode}
      edgeStrength={edgeStrength}
      allNodes={allNodes}
      allEdges={allEdges}
      onContextMenu={onContextMenu}
    />
  );
});

function VirtualizedEdgeListComponent(props: VirtualizedEdgeListProps) {
  const {
    links,
    allNodes,
    visibleNodeIds,
    nodeMap,
    isDark,
    focusedLinkIds,
    hasFocusMode,
    linkStyle,
    linkAnimation,
    edgeWidthMode,
    edgeStrengthMap,
    allNodesData,
    allEdgesData,
    transform,
    containerSize,
    viewportVersion,
    onEdgeContextMenu,
  } = props;
  
  const viewportBounds = useMemo((): ViewportBounds => {
    const { x, y, k } = transform;
    return {
      minX: (-x - BUFFER_SIZE) / k,
      maxX: (-x + containerSize.width + BUFFER_SIZE) / k,
      minY: (-y - BUFFER_SIZE) / k,
      maxY: (-y + containerSize.height + BUFFER_SIZE) / k,
    };
  }, [transform, containerSize, viewportVersion]);
  
  const nodePositionMap = useMemo(() => {
    return new Map(
      allNodes.map(n => [String(n.id).trim(), { x: n.x, y: n.y }])
    );
  }, [allNodes]);
  
  const visibleLinks = useMemo(() => {
    if (links.length === 0) return [];
    
    if (allNodes.length <= 50) {
      return links.filter(link => {
        const sourceId = typeof link.source === 'string' ? String(link.source).trim() : String(link.source.id).trim();
        const targetId = typeof link.target === 'string' ? String(link.target).trim() : String(link.target.id).trim();
        return visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId);
      });
    }
    
    return links.filter(link => {
      const sourceId = typeof link.source === 'string' ? String(link.source).trim() : String(link.source.id).trim();
      const targetId = typeof link.target === 'string' ? String(link.target).trim() : String(link.target.id).trim();
      
      if (visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId)) {
        return true;
      }
      
      const sourcePos = nodePositionMap.get(sourceId);
      const targetPos = nodePositionMap.get(targetId);
      
      if (!sourcePos || !targetPos) return false;
      
      return lineIntersectsViewport(sourcePos, targetPos, viewportBounds);
    });
  }, [links, allNodes.length, visibleNodeIds, nodePositionMap, viewportBounds]);
  
  const sortedVisibleLinks = useMemo(() => {
    return [...visibleLinks].sort((a, b) => {
      const aFocused = focusedLinkIds.has(a.id) ? 1 : 0;
      const bFocused = focusedLinkIds.has(b.id) ? 1 : 0;
      return bFocused - aFocused;
    });
  }, [visibleLinks, focusedLinkIds]);
  
  const edgeRenderers = useMemo(() => {
    return sortedVisibleLinks.map(link => (
      <EdgeRenderer
        key={link.id}
        link={link}
        nodeMap={nodeMap}
        isDark={isDark}
        focused={focusedLinkIds.has(link.id)}
        hasFocusMode={hasFocusMode}
        linkStyle={linkStyle}
        linkAnimation={linkAnimation}
        edgeWidthMode={edgeWidthMode}
        edgeStrength={edgeStrengthMap.get(link.id)}
        allNodes={allNodesData}
        allEdges={allEdgesData}
        onContextMenu={onEdgeContextMenu}
      />
    ));
  }, [
    sortedVisibleLinks,
    nodeMap,
    isDark,
    focusedLinkIds,
    hasFocusMode,
    linkStyle,
    linkAnimation,
    edgeWidthMode,
    edgeStrengthMap,
    allNodesData,
    allEdgesData,
    onEdgeContextMenu,
  ]);
  
  return <>{edgeRenderers}</>;
}

export const VirtualizedEdgeList = memo(VirtualizedEdgeListComponent);

export function useVisibleEdges(
  links: LayoutLink[],
  allNodes: LayoutNode[],
  visibleNodeIds: Set<string>,
  transform: { x: number; y: number; k: number },
  containerSize: { width: number; height: number },
  bufferSize: number = BUFFER_SIZE
): LayoutLink[] {
  return useMemo(() => {
    if (links.length === 0) return [];
    
    const bounds: ViewportBounds = {
      minX: (-transform.x - bufferSize) / transform.k,
      maxX: (-transform.x + containerSize.width + bufferSize) / transform.k,
      minY: (-transform.y - bufferSize) / transform.k,
      maxY: (-transform.y + containerSize.height + bufferSize) / transform.k,
    };
    
    const nodePositionMap = new Map(
      allNodes.map(n => [String(n.id).trim(), { x: n.x, y: n.y }])
    );
    
    return links.filter(link => {
      const sourceId = typeof link.source === 'string' ? String(link.source).trim() : String(link.source.id).trim();
      const targetId = typeof link.target === 'string' ? String(link.target).trim() : String(link.target.id).trim();
      
      if (visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId)) {
        return true;
      }
      
      const sourcePos = nodePositionMap.get(sourceId);
      const targetPos = nodePositionMap.get(targetId);
      
      return isEdgeInViewport(sourcePos, targetPos, bounds);
    });
  }, [links, allNodes, visibleNodeIds, transform, containerSize, bufferSize]);
}
