import React, { forwardRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stats } from '@react-three/drei';
import { Node, Edge } from '../../types/index';
import { useGraphSimulation } from './useGraphSimulation';
import { useGraphInteraction } from './useGraphInteraction';
import { GraphScene, GraphSceneRef } from './GraphScene';
import { THEME_CONFIG } from '../../config/graphConfig';
import { PerformanceMonitor } from './PerformanceMonitor';
import { usePerformanceStore } from '../../store/usePerformanceStore';

export type Graph3DProps = {
  nodes: Node[];
  edges: Edge[];
  onNodeClick: (node: Node) => void;
  showGrid?: boolean;
  isDark?: boolean;
  selectedNodeId?: string | null;
  selectedNodeIds?: Set<string>;
  highlightedPath?: { nodes: Set<string>, links: Set<string> } | null;
  onEngineLoad?: (isLoading: boolean) => void;
  onSelectionChange?: (nodeIds: string[]) => void;
  onBoxUpdate?: (box: { left: number; top: number; width: number; height: number } | null) => void;
  onBackgroundClick?: () => void;
  onNodeCollapse?: (nodeId: string) => void;
  // New props for clustering and layout
  collapsedNodeIds?: Set<string>;
  layoutMode?: '3d-force' | '2d-tree' | '3d-sphere' | 'solar';
  pulsingNodeIds?: Set<string>;
  lockedNodeIds?: Set<string>;
  masteredNodeIds?: Set<string>;
  gamificationEnabled?: boolean;
  textDisplayLevel?: 'all' | 'important' | 'root_only';
}

export type Graph3DRef = GraphSceneRef;

export const Graph3D = forwardRef<Graph3DRef, Graph3DProps>((props, ref) => {
  const { 
    nodes, 
    edges, 
    isDark = true, 
    selectedNodeId, 
    selectedNodeIds, 
    highlightedPath, 
    onEngineLoad, 
    onSelectionChange, 
    onBackgroundClick,
    onBoxUpdate,
    onNodeCollapse,
    collapsedNodeIds = new Set(),
    layoutMode = '3d-force',
    pulsingNodeIds = new Set(),
    lockedNodeIds = new Set(),
    masteredNodeIds = new Set(),
    gamificationEnabled = true
  } = props;
  
  // 1. Simulation Hook (Worker + State)
  const { nodesRef, linksRef, nodesMapRef, simulationVersion, isLoading } = useGraphSimulation(
    nodes, 
    edges,
    collapsedNodeIds,
    layoutMode
  );

  // Notify parent about loading state
  React.useEffect(() => {
    onEngineLoad?.(isLoading);
  }, [isLoading, onEngineLoad]);

  // 2. Interaction Hook (Highlighting)
  const { highlightedNodes, highlightedLinks } = useGraphInteraction({
    selectedNodeId,
    selectedNodeIds,
    highlightedPath,
    nodesRef,
    linksRef
  });

  const showStats = usePerformanceStore(state => state.showStats);
  const backgroundClass = isDark ? THEME_CONFIG.dark.background : THEME_CONFIG.light.background;

  return (
    <div className={`w-full h-full transition-colors duration-300 ${backgroundClass} relative touch-none`}>
      <Canvas camera={{ position: [0, 5, 10], fov: 60 }}>
        <PerformanceMonitor />
        {showStats && <Stats />}
        <GraphScene 
          ref={ref}
          nodesRef={nodesRef}
          linksRef={linksRef}
          nodesMapRef={nodesMapRef}
          simulationVersion={simulationVersion}
          highlightedNodes={highlightedNodes}
          highlightedLinks={highlightedLinks}
          pulsingNodeIds={pulsingNodeIds}
          lockedNodeIds={lockedNodeIds}
          masteredNodeIds={masteredNodeIds}
          gamificationEnabled={gamificationEnabled}
          isDark={isDark}
          onSelectionChange={onSelectionChange}
          onBoxUpdate={onBoxUpdate}
          onNodeCollapse={onNodeCollapse}
          {...props} 
        />
      </Canvas>
    </div>
  );
});
