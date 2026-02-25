import { useMemo, useRef, useCallback, useEffect, memo } from 'react';
import type { LayoutNode, Edge, ColorScheme, GraphColorMode, NodeSizeMode, Node } from '../../types';
import { MindMapNode } from './MindMapNode';

interface ViewportBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface VirtualizedNodeListProps {
  nodes: LayoutNode[];
  edges: Edge[];
  nodeStatus?: Record<string, any>;
  selectedNodeId: string | null;
  isDark: boolean;
  zoomLevel: number;
  transform: { x: number; y: number; k: number };
  transformRef: React.MutableRefObject<{ x: number; y: number; k: number }>;
  containerSize: { width: number; height: number };
  focusedNodeIds: Set<string>;
  forceShowTextIds: Set<string>;
  hasFocusMode: boolean;
  colorScheme: ColorScheme;
  nodeSizeMode: NodeSizeMode;
  nodeImportanceMap: Map<string, number>;
  allNodes: Node[];
  coloringMode: GraphColorMode;
  isSelectingParent: boolean;
  onSelectParent?: (nodeId: string) => void;
  currentNodeId?: string;
  selectedParentIds: string[];
  onNodeClick: (node: LayoutNode) => void;
  onNodeContextMenu?: (event: React.MouseEvent, node: LayoutNode) => void;
  onNodeHover: (nodeId: string | null, position?: { x: number; y: number }) => void;
  previewDelay: number;
  isExplorationMode: boolean;
  viewportVersion: number;
}

interface SpatialGrid {
  cells: Map<string, LayoutNode[]>;
  cellSize: number;
}

const BUFFER_SIZE = 200;
const GRID_CELL_SIZE = 300;

function createSpatialGrid(nodes: LayoutNode[], cellSize: number): SpatialGrid {
  const cells = new Map<string, LayoutNode[]>();
  
  nodes.forEach(node => {
    const cellX = Math.floor(node.x / cellSize);
    const cellY = Math.floor(node.y / cellSize);
    const key = `${cellX},${cellY}`;
    
    if (!cells.has(key)) {
      cells.set(key, []);
    }
    cells.get(key)!.push(node);
  });
  
  return { cells, cellSize };
}

function getNodesInViewport(
  grid: SpatialGrid,
  bounds: ViewportBounds
): LayoutNode[] {
  const result: LayoutNode[] = [];
  
  const startCellX = Math.floor(bounds.minX / grid.cellSize);
  const endCellX = Math.floor(bounds.maxX / grid.cellSize);
  const startCellY = Math.floor(bounds.minY / grid.cellSize);
  const endCellY = Math.floor(bounds.maxY / grid.cellSize);
  
  for (let x = startCellX; x <= endCellX; x++) {
    for (let y = startCellY; y <= endCellY; y++) {
      const key = `${x},${y}`;
      const cellNodes = grid.cells.get(key);
      if (cellNodes) {
        result.push(...cellNodes);
      }
    }
  }
  
  return result;
}

function getViewportBounds(
  transform: { x: number; y: number; k: number },
  containerSize: { width: number; height: number },
  bufferSize: number
): ViewportBounds {
  const { x, y, k } = transform;
  
  return {
    minX: (-x - bufferSize) / k,
    maxX: (-x + containerSize.width + bufferSize) / k,
    minY: (-y - bufferSize) / k,
    maxY: (-y + containerSize.height + bufferSize) / k,
  };
}

interface NodeRendererProps {
  node: LayoutNode;
  edges: Edge[];
  nodeStatus?: Record<string, any>;
  selected: boolean;
  isDark: boolean;
  zoomLevel: number;
  onClick: () => void;
  onMouseEnter: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
  focused: boolean;
  forceShowText: boolean;
  hasFocusMode: boolean;
  colorScheme: ColorScheme;
  nodeSizeMode: NodeSizeMode;
  nodeImportance?: number;
  allNodes: Node[];
  onContextMenu?: (event: React.MouseEvent, node: LayoutNode) => void;
  coloringMode: GraphColorMode;
  isSelectableAsParent: boolean;
  isExcludedAsParent: boolean;
  isSelectedAsParent: boolean;
}

const NodeRenderer = memo<NodeRendererProps>(function NodeRenderer({
  node,
  edges,
  nodeStatus,
  selected,
  isDark,
  zoomLevel,
  onClick,
  onMouseEnter,
  onMouseLeave,
  focused,
  forceShowText,
  hasFocusMode,
  colorScheme,
  nodeSizeMode,
  nodeImportance,
  allNodes,
  onContextMenu,
  coloringMode,
  isSelectableAsParent,
  isExcludedAsParent,
  isSelectedAsParent,
}) {
  return (
    <MindMapNode
      key={node.id}
      node={node}
      edges={edges}
      nodeStatus={nodeStatus}
      selected={selected}
      isDark={isDark}
      zoomLevel={zoomLevel}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      focused={focused}
      forceShowText={forceShowText}
      hasFocusMode={hasFocusMode}
      colorScheme={colorScheme}
      nodeSizeMode={nodeSizeMode}
      nodeImportance={nodeImportance}
      allNodes={allNodes}
      onContextMenu={onContextMenu}
      coloringMode={coloringMode}
      isSelectableAsParent={isSelectableAsParent}
      isExcludedAsParent={isExcludedAsParent}
      isSelectedAsParent={isSelectedAsParent}
    />
  );
});

function VirtualizedNodeListComponent(props: VirtualizedNodeListProps) {
  const {
    nodes,
    edges,
    nodeStatus,
    selectedNodeId,
    isDark,
    zoomLevel,
    transform,
    containerSize,
    focusedNodeIds,
    forceShowTextIds,
    hasFocusMode,
    colorScheme,
    nodeSizeMode,
    nodeImportanceMap,
    allNodes,
    coloringMode,
    isSelectingParent,
    currentNodeId,
    selectedParentIds,
    onNodeClick,
    onNodeContextMenu,
    onNodeHover,
    previewDelay,
    isExplorationMode,
    viewportVersion,
  } = props;
  
  const hoverTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const lastHoveredNodeRef = useRef<string | null>(null);
  
  const acceptedNodes = useMemo(() => {
    if (isExplorationMode) return nodes;
    return nodes.filter(node => node.is_accepted !== false);
  }, [nodes, isExplorationMode]);
  
  const spatialGrid = useMemo(() => {
    if (acceptedNodes.length <= 100) return null;
    return createSpatialGrid(acceptedNodes, GRID_CELL_SIZE);
  }, [acceptedNodes]);
  
  const visibleNodes = useMemo(() => {
    if (acceptedNodes.length === 0) return [];
    
    const bounds = getViewportBounds(
      transform,
      containerSize,
      BUFFER_SIZE
    );
    
    if (spatialGrid) {
      const nodesInBounds = getNodesInViewport(spatialGrid, bounds);
      return nodesInBounds.filter(node => {
        if (!isExplorationMode && node.is_accepted === false) return false;
        return (
          node.x >= bounds.minX &&
          node.x <= bounds.maxX &&
          node.y >= bounds.minY &&
          node.y <= bounds.maxY
        );
      });
    }
    
    return acceptedNodes.filter(node => 
      node.x >= bounds.minX &&
      node.x <= bounds.maxX &&
      node.y >= bounds.minY &&
      node.y <= bounds.maxY
    );
  }, [acceptedNodes, spatialGrid, containerSize, viewportVersion, isExplorationMode, transform]);
  
  const sortedVisibleNodes = useMemo(() => {
    return [...visibleNodes].sort((a, b) => {
      const aSelected = a.id === selectedNodeId ? 1 : 0;
      const bSelected = b.id === selectedNodeId ? 1 : 0;
      return bSelected - aSelected;
    });
  }, [visibleNodes, selectedNodeId]);
  
  const handleNodeClick = useCallback((node: LayoutNode) => {
    onNodeClick(node);
  }, [onNodeClick]);
  
  const handleNodeMouseEnter = useCallback((nodeId: string, e: React.MouseEvent) => {
    if (lastHoveredNodeRef.current === nodeId) return;
    lastHoveredNodeRef.current = nodeId;
    
    if (hoverTimeoutRef.current.has(nodeId)) {
      clearTimeout(hoverTimeoutRef.current.get(nodeId)!);
    }
    
    const timeout = setTimeout(() => {
      onNodeHover(nodeId, { x: e.clientX, y: e.clientY });
    }, previewDelay);
    
    hoverTimeoutRef.current.set(nodeId, timeout);
  }, [onNodeHover, previewDelay]);
  
  const handleNodeMouseLeave = useCallback((nodeId: string) => {
    if (hoverTimeoutRef.current.has(nodeId)) {
      clearTimeout(hoverTimeoutRef.current.get(nodeId)!);
      hoverTimeoutRef.current.delete(nodeId);
    }
    
    if (lastHoveredNodeRef.current === nodeId) {
      lastHoveredNodeRef.current = null;
    }
    
    onNodeHover(null);
  }, [onNodeHover]);
  
  useEffect(() => {
    return () => {
      hoverTimeoutRef.current.forEach(timeout => clearTimeout(timeout));
      hoverTimeoutRef.current.clear();
    };
  }, []);
  
  const nodeRenderers = useMemo(() => {
    return sortedVisibleNodes.map(node => {
      const isSelectableAsParent = isSelectingParent && node.id !== currentNodeId;
      const isSelectedAsParent = selectedParentIds.includes(node.id);
      const isExcludedAsParent = isSelectingParent && node.id === currentNodeId;
      
      return (
        <NodeRenderer
          key={node.id}
          node={node}
          edges={edges}
          nodeStatus={nodeStatus}
          selected={node.id === selectedNodeId}
          isDark={isDark}
          zoomLevel={zoomLevel}
          onClick={() => handleNodeClick(node)}
          onMouseEnter={(e) => handleNodeMouseEnter(node.id, e)}
          onMouseLeave={() => handleNodeMouseLeave(node.id)}
          focused={focusedNodeIds.has(node.id)}
          forceShowText={forceShowTextIds.has(node.id)}
          hasFocusMode={hasFocusMode}
          colorScheme={colorScheme}
          nodeSizeMode={nodeSizeMode}
          nodeImportance={nodeImportanceMap.get(node.id)}
          allNodes={allNodes}
          onContextMenu={onNodeContextMenu}
          coloringMode={coloringMode}
          isSelectableAsParent={isSelectableAsParent}
          isExcludedAsParent={isExcludedAsParent}
          isSelectedAsParent={isSelectedAsParent}
        />
      );
    });
  }, [
    sortedVisibleNodes,
    edges,
    nodeStatus,
    selectedNodeId,
    isDark,
    zoomLevel,
    focusedNodeIds,
    forceShowTextIds,
    hasFocusMode,
    colorScheme,
    nodeSizeMode,
    nodeImportanceMap,
    allNodes,
    onNodeContextMenu,
    coloringMode,
    isSelectingParent,
    currentNodeId,
    selectedParentIds,
    handleNodeClick,
    handleNodeMouseEnter,
    handleNodeMouseLeave,
  ]);
  
  return <>{nodeRenderers}</>;
}

export const VirtualizedNodeList = memo(VirtualizedNodeListComponent);

export function useVirtualizedNodes(
  nodes: LayoutNode[],
  transform: { x: number; y: number; k: number },
  containerSize: { width: number; height: number },
  bufferSize: number = BUFFER_SIZE
): LayoutNode[] {
  return useMemo(() => {
    if (nodes.length === 0) return [];
    
    const bounds = getViewportBounds(transform, containerSize, bufferSize);
    
    return nodes.filter(node => 
      node.x >= bounds.minX &&
      node.x <= bounds.maxX &&
      node.y >= bounds.minY &&
      node.y <= bounds.maxY
    );
  }, [nodes, transform, containerSize, bufferSize]);
}

export function useSpatialGrid(nodes: LayoutNode[]): SpatialGrid | null {
  return useMemo(() => {
    if (nodes.length <= 100) return null;
    return createSpatialGrid(nodes, GRID_CELL_SIZE);
  }, [nodes]);
}

export { BUFFER_SIZE, GRID_CELL_SIZE };
