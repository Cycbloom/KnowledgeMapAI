import React, { forwardRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Node, Edge } from '../../types/index';
import { useGraphSimulation } from './useGraphSimulation';
import { useGraphInteraction } from './useGraphInteraction';
import { GraphScene, GraphSceneRef } from './GraphScene';
import { THEME_CONFIG } from '../../config/graphConfig';

export interface Graph3DProps {
  nodes: Node[];
  edges: Edge[];
  onNodeClick: (node: Node) => void;
  showGrid?: boolean;
  isDark?: boolean;
  selectedNodeId?: string | null;
  highlightedPath?: { nodes: Set<string>, links: Set<string> } | null;
}

export type Graph3DRef = GraphSceneRef;

export const Graph3D = forwardRef<Graph3DRef, Graph3DProps>((props, ref) => {
  const { nodes, edges, isDark = true, selectedNodeId, highlightedPath } = props;
  
  // 1. Simulation Hook (Worker + State)
  const { nodesRef, linksRef, nodesMapRef, simulationVersion } = useGraphSimulation(nodes, edges);

  // 2. Interaction Hook (Highlighting)
  const { highlightedNodes, highlightedLinks } = useGraphInteraction({
    selectedNodeId,
    highlightedPath,
    nodesRef,
    linksRef
  });

  const backgroundClass = isDark ? THEME_CONFIG.dark.background : THEME_CONFIG.light.background;

  return (
    <div className={`w-full h-full transition-colors duration-300 ${backgroundClass}`}>
      <Canvas camera={{ position: [0, 5, 10], fov: 60 }}>
        <GraphScene 
          ref={ref}
          nodesRef={nodesRef}
          linksRef={linksRef}
          nodesMapRef={nodesMapRef}
          simulationVersion={simulationVersion}
          highlightedNodes={highlightedNodes}
          highlightedLinks={highlightedLinks}
          isDark={isDark}
          {...props} 
        />
      </Canvas>
    </div>
  );
});
