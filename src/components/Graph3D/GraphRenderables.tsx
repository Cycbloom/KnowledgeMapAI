import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { Node } from '../../types/index';
import { LEVEL_CONFIG, SimNode, SimLink, THEME_CONFIG } from '../../config/graphConfig';

// --- Helper to get theme ---
const getTheme = (isDark: boolean) => isDark ? THEME_CONFIG.dark : THEME_CONFIG.light;

interface InstancedNodesProps {
  nodesRef: React.MutableRefObject<SimNode[]>;
  onNodeClick?: (node: Node) => void;
  onNodeDoubleClick?: (node: Node) => void;
  isDark: boolean;
  highlightedNodes: Set<string>;
  simulationVersion: number;
}

interface NodeLabelsProps {
  nodesRef: React.MutableRefObject<SimNode[]>;
  isDark: boolean;
  highlightedNodes: Set<string>;
  onNodeClick?: (node: Node) => void;
  onNodeDoubleClick?: (node: Node) => void;
  simulationVersion: number;
}

interface LinkLinesProps {
  linksRef?: React.MutableRefObject<SimLink[]>;
  links?: SimLink[];
  nodesMapRef: React.MutableRefObject<Map<string, SimNode>>;
  isDark: boolean;
  simulationVersion: number;
  opacity?: number;
}

// --- Instanced Nodes ---
export const InstancedNodes = ({ 
  nodesRef, 
  onNodeClick, 
  onNodeDoubleClick,
  isDark, 
  highlightedNodes,
  simulationVersion
}: InstancedNodesProps) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const tempObject = new THREE.Object3D();
  const tempColor = new THREE.Color();
  const hoveredRef = useRef<number | null>(null);
  const theme = getTheme(isDark);

  // Re-run this when simulationVersion changes (topology changed)
  const nodeCount = nodesRef.current.length;

  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
    }
  }, []);

  useFrame(() => {
    if (!meshRef.current) return;
    
    const nodes = nodesRef.current;
    
    // Optimization: if counts mismatch (shouldn't happen if version works), don't crash
    const count = Math.min(nodes.length, meshRef.current.count);

    for (let i = 0; i < count; i++) {
      const node = nodes[i];
      if (typeof node.x !== 'number') continue;

      tempObject.position.set(node.x, node.y!, node.z!);
      
      const config = LEVEL_CONFIG[node.level || 'leaf'];
      let scale = config.radius;
      
      // Hover effect
      if (hoveredRef.current === i) {
        scale *= 1.2;
      }
      
      tempObject.scale.set(scale, scale, scale);
      tempObject.updateMatrix();
      meshRef.current.setMatrixAt(i, tempObject.matrix);
      
      // Color logic
      const isDimmed = highlightedNodes.size > 0 && !highlightedNodes.has(node.id);
      const baseColor = config.color;
      
      tempColor.set(baseColor);
      if (isDimmed) {
        tempColor.lerp(new THREE.Color('#000000'), 0.8);
      }
      meshRef.current.setColorAt(i, tempColor);
    }
    
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      key={simulationVersion} // Force re-creation when topology changes
      ref={meshRef}
      args={[undefined, undefined, nodeCount]}
      frustumCulled={false}
      onClick={(e) => {
        e.stopPropagation();
        if (e.instanceId !== undefined && nodesRef.current[e.instanceId]) {
          onNodeClick?.(nodesRef.current[e.instanceId]);
        }
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (e.instanceId !== undefined && nodesRef.current[e.instanceId]) {
          onNodeDoubleClick?.(nodesRef.current[e.instanceId]);
        }
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
        hoveredRef.current = e.instanceId !== undefined ? e.instanceId : null;
      }}
      onPointerOut={(e) => {
        document.body.style.cursor = 'default';
        hoveredRef.current = null;
      }}
    >
      <sphereGeometry args={[1, 32, 32]} />
      <meshPhysicalMaterial 
        roughness={0.4} 
        metalness={0.1} 
        clearcoat={0.5}
        clearcoatRoughness={0.1}
      />
    </instancedMesh>
  );
};

// --- Link Lines ---
export const LinkLines = ({ 
  linksRef,
  links, // Optional: if provided, render these instead of linksRef.current
  nodesMapRef, 
  isDark, 
  simulationVersion,
  opacity
}: LinkLinesProps) => {
  const geometryRef = useRef<THREE.BufferGeometry>(null);
  const theme = getTheme(isDark);
  
  useFrame(() => {
    if (geometryRef.current && nodesMapRef?.current) {
      // Use provided links array OR fall back to ref
      const linksToRender = links || linksRef?.current || [];
      const nodesMap = nodesMapRef.current;
      const positions: number[] = [];
      
      linksToRender.forEach(link => {
        const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source;
        const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target;
        
        const source = nodesMap.get(sourceId);
        const target = nodesMap.get(targetId);

        if (source && target && typeof source.x === 'number' && typeof target.x === 'number') {
          positions.push(source.x, source.y!, source.z!);
          positions.push(target.x, target.y!, target.z!);
        }
      });

      geometryRef.current.setAttribute(
        'position', 
        new THREE.Float32BufferAttribute(positions, 3)
      );
      geometryRef.current.attributes.position.needsUpdate = true;
      geometryRef.current.setDrawRange(0, positions.length / 3);
    }
  });

  return (
    <lineSegments frustumCulled={false}>
      <bufferGeometry ref={geometryRef} />
      <lineBasicMaterial 
        color={theme.link.color} 
        opacity={opacity !== undefined ? opacity : theme.link.opacity} 
        transparent 
        linewidth={1} 
      />
    </lineSegments>
  );
};

// --- Node Labels ---
export const NodeLabels = ({ 
  nodesRef, 
  isDark, 
  highlightedNodes,
  onNodeClick,
  onNodeDoubleClick,
  simulationVersion
}: NodeLabelsProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const theme = getTheme(isDark);
  
  // We render the component ONCE based on simulationVersion (count)
  // But update positions in useFrame
  
  useFrame(() => {
    if (!groupRef.current) return;
    
    const nodes = nodesRef.current;
    
    groupRef.current.children.forEach((child: any, i) => {
      const node = nodes[i];
      if (node && typeof node.x === 'number') {
        const config = LEVEL_CONFIG[node.level || 'leaf'];
        child.position.set(node.x, node.y! + config.radius + 0.4, node.z);
        
        // Scale text based on distance
        const distance = camera.position.distanceTo(child.position);
        const scale = Math.max(1, distance / 25);
        child.scale.set(scale, scale, scale);
        
        child.visible = true;
      } else {
        child.visible = false;
      }
    });
  });

  return (
    <group ref={groupRef} key={simulationVersion}>
      {nodesRef.current.map((node) => {
        const isDimmed = highlightedNodes.size > 0 && !highlightedNodes.has(node.id);
        const config = LEVEL_CONFIG[node.level || 'leaf'];
        
        return (
          <Billboard key={node.id} follow={true} lockX={false} lockY={false} lockZ={false}>
             <Text 
              fontSize={node.level === 'root' || node.level === 'core' ? 0.6 : 0.45} 
              color={theme.text.color}
              fillOpacity={isDimmed ? 0.2 : theme.text.opacity}
              anchorX="center" 
              anchorY="middle"
              outlineWidth={0.05}
              outlineColor={theme.text.outline}
              outlineOpacity={isDimmed ? 0.2 : 1}
              font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff"
              onClick={(e) => {
                e.stopPropagation();
                onNodeClick?.(node);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onNodeDoubleClick?.(node);
              }}
              onPointerOver={() => {
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={() => {
                document.body.style.cursor = 'default';
              }}
            >
              {node.title}
            </Text>
          </Billboard>
        );
      })}
    </group>
  );
};
