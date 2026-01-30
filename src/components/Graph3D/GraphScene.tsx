import React, { forwardRef, useState, useCallback, useImperativeHandle } from 'react';
import { useThree } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import { SimNode, SimLink, THEME_CONFIG } from '../../config/graphConfig';
import { Node } from '../../types/index';
import { InstancedNodes, LinkLines, NodeLabels } from './GraphRenderables';
import { CameraController } from './CameraController';

export interface GraphSceneRef {
  focusNode: (nodeId: string) => void;
}

interface GraphSceneProps {
  nodesRef: React.MutableRefObject<SimNode[]>;
  linksRef: React.MutableRefObject<SimLink[]>;
  nodesMapRef: React.MutableRefObject<Map<string, SimNode>>;
  simulationVersion: number;
  isDark: boolean;
  highlightedNodes: Set<string>;
  highlightedLinks: Set<string>;
  onNodeClick: (node: Node) => void;
  showGrid?: boolean;
}

const getTheme = (isDark: boolean) => isDark ? THEME_CONFIG.dark : THEME_CONFIG.light;

export const GraphScene = forwardRef<GraphSceneRef, GraphSceneProps>((props, ref) => {
  const { 
    nodesRef, 
    linksRef, 
    nodesMapRef, 
    simulationVersion, 
    isDark, 
    highlightedNodes, 
    highlightedLinks,
    onNodeClick,
    showGrid 
  } = props;

  const theme = getTheme(isDark);
  const [focusTarget, setFocusTarget] = useState<{ pos: THREE.Vector3, lookAt: THREE.Vector3 } | null>(null);

  // Focus Logic
  const focusNodeInternal = useCallback((nodeId: string) => {
    const targetNode = nodesRef.current.find(n => n.id === nodeId);
    if (targetNode && typeof targetNode.x === 'number') {
      const nodePos = new THREE.Vector3(targetNode.x, targetNode.y, targetNode.z);
      setFocusTarget({
        pos: nodePos.clone().add(new THREE.Vector3(0, 2, 5)),
        lookAt: nodePos
      });
      // Auto-release focus after animation (2s)
      setTimeout(() => setFocusTarget(null), 2000);
    }
  }, [nodesRef]);

  useImperativeHandle(ref, () => ({
    focusNode: focusNodeInternal
  }), [focusNodeInternal]);

  return (
    <>
      {showGrid && (
        <gridHelper 
          args={[100, 100, theme.grid.color1 || 0x888888, theme.grid.color2 || 0x888888]} 
          position={[0, -2, 0]} 
        />
      )}
      
      <ambientLight intensity={theme.lighting.ambientIntensity} />
      <pointLight position={[10, 10, 10]} intensity={theme.lighting.pointIntensity} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} />
      <Environment preset="city" />

      <InstancedNodes 
        nodesRef={nodesRef} 
        onNodeClick={onNodeClick} 
        onNodeDoubleClick={(node) => focusNodeInternal(node.id)}
        isDark={isDark} 
        highlightedNodes={highlightedNodes} 
        simulationVersion={simulationVersion}
      />
      
      <NodeLabels 
        nodesRef={nodesRef} 
        isDark={isDark} 
        highlightedNodes={highlightedNodes} 
        onNodeClick={onNodeClick}
        onNodeDoubleClick={(node) => focusNodeInternal(node.id)}
        simulationVersion={simulationVersion}
      />
      
      {/* Main Links */}
      <LinkLines 
        linksRef={linksRef} 
        nodesMapRef={nodesMapRef} 
        isDark={isDark} 
        simulationVersion={simulationVersion}
        opacity={highlightedLinks.size > 0 ? theme.link.highlightOpacity : theme.link.opacity}
      />
      
      {/* Highlighted Links Overlay */}
      {highlightedLinks.size > 0 && (
        <LinkLines 
          linksRef={linksRef}
          links={linksRef.current.filter(l => highlightedLinks.has(l.id))} 
          nodesMapRef={nodesMapRef} 
          isDark={isDark} 
          simulationVersion={simulationVersion}
          opacity={theme.link.opacity} 
        />
      )}

      <CameraController 
        targetPosition={focusTarget?.pos || null} 
        targetLookAt={focusTarget?.lookAt || null} 
      />
    </>
  );
});
