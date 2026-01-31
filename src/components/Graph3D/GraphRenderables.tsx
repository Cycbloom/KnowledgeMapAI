import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { Node } from '../../types/index';
import { LEVEL_CONFIG, SimNode, SimLink, THEME_CONFIG } from '../../config/graphConfig';
import { getLinkNodeId } from '../../lib/graphUtils';

// --- Helper to get theme ---
const getTheme = (isDark: boolean) => isDark ? THEME_CONFIG.dark : THEME_CONFIG.light;

interface InstancedNodesProps {
  nodesRef: React.MutableRefObject<SimNode[]>;
  onNodeClick?: (node: Node) => void;
  onNodeDoubleClick?: (node: Node) => void;
  onNodeRightClick?: (node: Node) => void;
  isDark: boolean;
  highlightedNodes: Set<string>;
  pulsingNodeIds?: Set<string>;
  lockedNodeIds?: Set<string>;
  masteredNodeIds?: Set<string>;
  simulationVersion: number;
}

interface NodeLabelsProps {
  nodesRef: React.MutableRefObject<SimNode[]>;
  isDark: boolean;
  highlightedNodes: Set<string>;
  onNodeClick?: (node: Node) => void;
  onNodeDoubleClick?: (node: Node) => void;
  simulationVersion: number;
  forceShowAllLabels?: boolean; // New prop to force visibility
}

interface LinkLinesProps {
  linksRef?: React.MutableRefObject<SimLink[]>;
  links?: SimLink[];
  nodesMapRef: React.MutableRefObject<Map<string, SimNode>>;
  isDark: boolean;
  simulationVersion: number;
  opacity?: number;
}

const BLACK = new THREE.Color(0, 0, 0);

// --- Instanced Nodes ---
export const InstancedNodes = ({ 
  nodesRef, 
  onNodeClick, 
  onNodeDoubleClick,
  onNodeRightClick,
  isDark, 
  highlightedNodes,
  pulsingNodeIds,
  lockedNodeIds,
  masteredNodeIds,
  simulationVersion
}: InstancedNodesProps) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const hitMeshRef = useRef<THREE.InstancedMesh>(null);
  const tempObject = useMemo(() => new THREE.Object3D(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);
  const hoveredRef = useRef<number | null>(null);
  const theme = getTheme(isDark);

  // Re-run this when simulationVersion changes (topology changed)
  const nodeCount = nodesRef.current.length;

  // Capture a snapshot of node IDs at the time of this render version.
  // This prevents the "async click" bug where the user clicks an old mesh 
  // but the code looks at a new (shorter) nodesRef array.
  const nodeSnapshot = useMemo(() => {
    return nodesRef.current.map(n => ({ id: n.id, title: n.title }));
  }, [simulationVersion, nodeCount]);

  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
    }
    if (hitMeshRef.current) {
      hitMeshRef.current.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
    }
  }, [simulationVersion]);

  useFrame(() => {
    if (!meshRef.current || !hitMeshRef.current) return;
    
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
      
      // Update Visual Mesh
      tempObject.scale.set(scale, scale, scale);
      tempObject.updateMatrix();
      meshRef.current.setMatrixAt(i, tempObject.matrix);

      // Update Hit Mesh
      // Use a larger scale for easier interaction, ensuring minimum clickable size
      const hitScale = Math.max(scale * 1.5, 1.0);
      tempObject.scale.set(hitScale, hitScale, hitScale);
      tempObject.updateMatrix();
      hitMeshRef.current.setMatrixAt(i, tempObject.matrix);
      
      // Color logic
      const isDimmed = highlightedNodes.size > 0 && !highlightedNodes.has(node.id);
      const isLocked = lockedNodeIds?.has(node.id);
      const isMastered = masteredNodeIds?.has(node.id);
      
      let baseColor: string = config.color;
      if (isLocked) {
         baseColor = '#94a3b8'; // Gray for locked
      } else if (isMastered) {
         // Add a green tint or make it brighter green
         baseColor = '#10b981'; // Emerald 500
      }
      
      tempColor.set(baseColor);
      if (isDimmed) {
        tempColor.lerp(BLACK, 0.8);
      }
      meshRef.current.setColorAt(i, tempColor);
    }
    
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;

    hitMeshRef.current.instanceMatrix.needsUpdate = true;
  });

  const handleInteraction = (instanceId: number | undefined, callback?: (node: SimNode) => void) => {
    if (instanceId === undefined) return;
    
    // Use the snapshot to find the ID, then find the latest node in the ref
    const nodeMeta = nodeSnapshot[instanceId];
    if (nodeMeta) {
      const actualNode = nodesRef.current.find(n => n.id === nodeMeta.id);
      if (actualNode) {
        callback?.(actualNode);
      }
    }
  };

  return (
    <>
      {/* Visual Mesh - No interaction */}
      <instancedMesh
        key={`visual-${simulationVersion}-${nodeCount}`} // Force re-creation when topology changes
        ref={meshRef}
        args={[undefined, undefined, nodeCount]}
        frustumCulled={false}
        raycast={() => null} // Disable raycasting for visual mesh to optimize
      >
        <sphereGeometry args={[1, 32, 32]} />
        <meshPhysicalMaterial 
          roughness={0.4} 
          metalness={0.1} 
          clearcoat={0.5}
          clearcoatRoughness={0.1}
        />
      </instancedMesh>

      {/* Hit Mesh - Invisible but interactive */}
      <instancedMesh
        key={`hit-${simulationVersion}-${nodeCount}`}
        ref={hitMeshRef}
        args={[undefined, undefined, nodeCount]}
        frustumCulled={false}
        onClick={(e) => {
          e.stopPropagation();
          handleInteraction(e.instanceId, onNodeClick);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          handleInteraction(e.instanceId, onNodeDoubleClick);
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
        onContextMenu={(e) => {
          e.stopPropagation();
          e.nativeEvent.preventDefault(); 
          handleInteraction(e.instanceId, onNodeRightClick);
        }}
      >
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial 
          transparent 
          opacity={0} 
          depthWrite={false} 
          side={THREE.DoubleSide}
          color="red"
        />
      </instancedMesh>
      
      {/* Pulse Effect for Pulsing Nodes (Search Results) */}
      <PulseNodes 
        nodesRef={nodesRef} 
        activeNodeIds={pulsingNodeIds} 
      />
    </>
  );
};

// --- Pulse Node Effect ---
const PulseNodes = ({ 
  nodesRef, 
  activeNodeIds 
}: { 
  nodesRef: React.MutableRefObject<SimNode[]>; 
  activeNodeIds?: Set<string>; 
}) => {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    
    // Animate pulse
    const t = clock.getElapsedTime();
    const scale = 1.5 + Math.sin(t * 3) * 0.3; // Oscillate between 1.2 and 1.8
    const opacity = 0.6 - Math.sin(t * 3) * 0.3; // Oscillate opacity
    
    groupRef.current.children.forEach((child) => {
      child.scale.set(scale, scale, scale);
      if (child instanceof THREE.Mesh) {
         (child.material as THREE.MeshBasicMaterial).opacity = opacity;
      }
    });
  });

  // Re-calculate positions only when activeNodeIds or nodes change
  const targetNodes = useMemo(() => {
    if (!activeNodeIds || activeNodeIds.size === 0) return [];
    return nodesRef.current.filter(n => activeNodeIds.has(n.id));
  }, [activeNodeIds, nodesRef.current]);
  
  // We need to update positions every frame because simulation moves nodes
  useFrame(() => {
    if (!groupRef.current) return;
    
    // Sync positions with simulation
    // We match children to targetNodes by index
    targetNodes.forEach((node, i) => {
      const child = groupRef.current?.children[i];
      if (child && typeof node.x === 'number') {
        child.position.set(node.x, node.y!, node.z!);
      }
    });
  });

  if (targetNodes.length === 0) return null;

  return (
    <group ref={groupRef}>
      {targetNodes.map(node => (
        <mesh key={node.id}>
          <sphereGeometry args={[LEVEL_CONFIG[node.level || 'leaf'].radius, 32, 32]} />
          <meshBasicMaterial 
            color="#ff00ff" 
            transparent 
            opacity={0.5} 
            depthWrite={false} // Prevent z-fighting and allow seeing through
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
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
      
      // Calculate required size: links * 2 points * 3 coords
      const count = linksToRender.length;
      const size = count * 6;
      
      // Check if we need to resize buffer
      const currentAttribute = geometryRef.current.getAttribute('position') as THREE.BufferAttribute;
      let positions: Float32Array;
      
      if (!currentAttribute || currentAttribute.array.length < size) {
        // Allocate slightly more to avoid frequent resizing
        positions = new Float32Array(Math.max(size * 1.2, 100 * 6)); 
        geometryRef.current.setAttribute(
          'position', 
          new THREE.BufferAttribute(positions, 3)
        );
      } else {
        positions = currentAttribute.array as Float32Array;
      }
      
      let index = 0;
       for (let i = 0; i < count; i++) {
         const link = linksToRender[i];
         const sourceId = getLinkNodeId(link.source);
         const targetId = getLinkNodeId(link.target);
        
         const source = nodesMap.get(sourceId);
        const target = nodesMap.get(targetId);

        if (source && target && typeof source.x === 'number' && typeof target.x === 'number') {
           positions[index++] = source.x;
           positions[index++] = source.y!;
           positions[index++] = source.z!;
           positions[index++] = target.x;
           positions[index++] = target.y!;
           positions[index++] = target.z!;
        }
      }

      geometryRef.current.attributes.position.needsUpdate = true;
      geometryRef.current.setDrawRange(0, index / 3);
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
export const NodeLabels = React.forwardRef<THREE.Group, NodeLabelsProps>(({ 
  nodesRef, 
  isDark, 
  highlightedNodes,
  onNodeClick,
  onNodeDoubleClick,
  simulationVersion,
  forceShowAllLabels = false
}, ref) => {
  // Use local ref if none provided, or sync with forwarded ref
  const localRef = useRef<THREE.Group>(null);
  
  useFrame(() => {
    // Determine which ref to use
    const group = (ref as React.MutableRefObject<THREE.Group>)?.current || localRef.current;
    if (!group) return;
    
    const nodes = nodesRef.current;
    
    group.children.forEach((child: any, i) => {
      const node = nodes[i];
      if (node && typeof node.x === 'number') {
        const config = LEVEL_CONFIG[node.level || 'leaf'];
        child.position.set(node.x, node.y! + config.radius + 0.4, node.z);
        
        // Scale text based on distance
        const distance = camera.position.distanceTo(child.position);
        
        // LOD: Hide labels for distant nodes unless they are root/core
        // Always show highlighted nodes
        const isImportant = node.level === 'root' || node.level === 'core' || highlightedNodes.has(node.id);
        const isVisible = forceShowAllLabels || isImportant || distance < 40; // Threshold distance

        if (!isVisible) {
          child.visible = false;
        } else {
          child.visible = true;
          // When forcing labels (e.g. screenshot), we might want to clamp scale to be readable but not huge
          // Or just stick to dynamic scale.
          const scale = Math.max(1, distance / 25);
          child.scale.set(scale, scale, scale);
          
          // Force full opacity update if needed
          if (forceShowAllLabels && child.material) {
             // We can't easily access the Text material instance here to force opacity update
             // But re-rendering with prop change will handle it
          }
        }
        
        // Sync opacity for SDF Text to prevent artifacts when switching modes
        if (child.material) {
             child.material.depthTest = false; // Optional: Ensure text is always on top? Maybe not for 3D depth.
             child.material.depthWrite = false;
        }

      } else {
        child.visible = false;
      }
    });
  });

  const { camera } = useThree();
  const theme = getTheme(isDark);
  
  // We render the component ONCE based on simulationVersion (count)
  // But update positions in useFrame

  return (
    <group ref={ref || localRef} key={simulationVersion}>
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
              // Use a standard font URL or local asset to ensure it loads reliably
              // font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff"
              // Removing custom font url to fallback to default or use a reliable one. 
              // Often default font is safer for offline/export if network is issue.
              // Or keep it if it works. The user said "text display problem", maybe font didn't load?
              // Let's stick to default for robustness or a known good font.
              
              // Key change: sync() call might be needed for screenshot?
              // Text component usually handles it.
              
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
});
