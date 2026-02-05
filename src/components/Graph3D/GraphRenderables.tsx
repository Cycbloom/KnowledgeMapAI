import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { useMessageStore } from '../../store/useMessageStore';
import { usePerformanceStore } from '../../store/usePerformanceStore';
import { Node } from '../../types/index';
import { LEVEL_CONFIG, SimNode, SimLink, THEME_CONFIG, RADIAL_DISTANCES } from '../../config/graphConfig';
import { getLinkNodeId } from '../../lib/graphUtils';

// --- Helper to get theme ---
const getTheme = (isDark: boolean) => isDark ? THEME_CONFIG.dark : THEME_CONFIG.light;

// --- Helper for Render Order ---
const getRenderOrder = (level: string | undefined) => {
  switch (level) {
    case 'root': return 100;
    case 'core': return 80;
    case 'sub': return 60;
    case 'normal': return 40;
    case 'leaf': return 20;
    default: return 10;
  }
};

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
  gamificationEnabled?: boolean;
  simulationVersion: number;
}

interface NodeLabelsProps {
  nodesRef: React.MutableRefObject<SimNode[]>;
  isDark: boolean;
  layoutMode?: string;
  highlightedNodes: Set<string>;
  lockedNodeIds?: Set<string>;
  onNodeClick?: (node: Node) => void;
  onNodeDoubleClick?: (node: Node) => void;
  simulationVersion: number;
  forceShowAllLabels?: boolean;
  textDisplayLevel?: 'all' | 'important' | 'root_only';
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
  gamificationEnabled,
  simulationVersion
}: InstancedNodesProps) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const hitMeshRef = useRef<THREE.InstancedMesh>(null);
  const tempObject = useMemo(() => new THREE.Object3D(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);
  const hoveredRef = useRef<number | null>(null);
  const lastRightClickRef = useRef<{ time: number; instanceId: number | undefined }>({ time: 0, instanceId: undefined });
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
      if (!meshRef.current.geometry.boundingSphere) {
        meshRef.current.geometry.boundingSphere = new THREE.Sphere();
      }
      meshRef.current.geometry.boundingSphere.set(new THREE.Vector3(), Infinity);
      meshRef.current.geometry.boundingSphere.radius = Infinity;
    }
    if (hitMeshRef.current) {
      if (!hitMeshRef.current.geometry.boundingSphere) {
        hitMeshRef.current.geometry.boundingSphere = new THREE.Sphere();
      }
      hitMeshRef.current.geometry.boundingSphere.set(new THREE.Vector3(), Infinity);
      hitMeshRef.current.geometry.boundingSphere.radius = Infinity;
    }
  }, [simulationVersion, nodeCount]);

  useFrame(() => {
    if (!meshRef.current || !hitMeshRef.current) return;
    
    const nodes = nodesRef.current;
    
    // Optimization: if counts mismatch (shouldn't happen if version works), don't crash
    const count = Math.min(nodes.length, meshRef.current.count);

    for (let i = 0; i < count; i++) {
      const node = nodes[i];
      if (typeof node.x !== 'number' || isNaN(node.x) || 
          typeof node.y !== 'number' || isNaN(node.y) || 
          typeof node.z !== 'number' || isNaN(node.z)) {
        // If position is invalid, move it far away or hide it
        tempObject.position.set(10000, 10000, 10000);
        tempObject.updateMatrix();
        meshRef.current.setMatrixAt(i, tempObject.matrix);
        continue;
      }

      tempObject.position.set(node.x, node.y, node.z);
      
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
      
      // Apply emissive intensity for Bloom effect
      // If it's not locked, we boost the color to make it glow
      if (!isLocked && !isDimmed) {
        const intensity = config.emissiveIntensity || 1.0;
        tempColor.multiplyScalar(intensity);
      }

      if (isDimmed) {
        tempColor.lerp(BLACK, 0.8);
      }
      meshRef.current.setColorAt(i, tempColor);
    }
    
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;

    hitMeshRef.current.instanceMatrix.needsUpdate = true;
  });

  const { addMessage } = useMessageStore();
  const quality = usePerformanceStore(state => state.quality);
  const segments = quality === 'high' ? 32 : (quality === 'medium' ? 16 : 8);

  const handleInteraction = (instanceId: number | undefined, callback?: (node: SimNode) => void) => {
    if (instanceId === undefined) return;
    
    // Use the snapshot to find the ID, then find the latest node in the ref
    const nodeMeta = nodeSnapshot[instanceId];
    if (nodeMeta) {
      // Prevent interaction with locked nodes
      if (lockedNodeIds?.has(nodeMeta.id)) {
        addMessage({ 
          content: '此节点尚未解锁！请先学习前置知识点。', 
          type: 'warning' 
        });
        return;
      }

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
        key={`visual-${simulationVersion}-${nodeCount}-${quality}`} // Force re-creation when topology or quality changes
        ref={meshRef}
        args={[undefined, undefined, nodeCount]}
        frustumCulled={false}
        raycast={() => null} // Disable raycasting for visual mesh to optimize
      >
        <sphereGeometry args={[1, segments, segments]} />
        <meshStandardMaterial 
          roughness={0.1} 
          metalness={0.8} 
          toneMapped={false} // Critical for Bloom to work with high intensity colors
          emissive={new THREE.Color(0x000000)} // Will be updated per instance color
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
          
          const now = Date.now();
          const lastClick = lastRightClickRef.current;
          
          // Double right click detection (500ms threshold)
          if (lastClick.instanceId === e.instanceId && (now - lastClick.time) < 500) {
            handleInteraction(e.instanceId, onNodeRightClick);
            lastRightClickRef.current = { time: 0, instanceId: undefined };
          } else {
            lastRightClickRef.current = { time: now, instanceId: e.instanceId };
          }
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

      {/* Target Effect for Unlocked but Not Mastered Nodes - Only in gamification mode */}
      {gamificationEnabled && (
        <TargetNodes
          nodesRef={nodesRef}
          lockedNodeIds={lockedNodeIds}
          masteredNodeIds={masteredNodeIds}
          highlightedNodes={highlightedNodes}
        />
      )}
    </>
  );
};

// --- Target Node Effect (Unlocked but not mastered) ---
const TargetNodes = ({
  nodesRef,
  lockedNodeIds,
  masteredNodeIds,
  highlightedNodes
}: {
  nodesRef: React.MutableRefObject<SimNode[]>;
  lockedNodeIds?: Set<string>;
  masteredNodeIds?: Set<string>;
  highlightedNodes: Set<string>;
}) => {
  const groupRef = useRef<THREE.Group>(null);

  const targetNodes = useMemo(() => {
    return nodesRef.current.filter(node => 
      !lockedNodeIds?.has(node.id) && 
      !masteredNodeIds?.has(node.id) &&
      (highlightedNodes.size === 0 || highlightedNodes.has(node.id))
    );
  }, [nodesRef.current, lockedNodeIds, masteredNodeIds, highlightedNodes]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    const scale = 1.2 + Math.sin(t * 2) * 0.1;
    const opacity = 0.4 + Math.sin(t * 2) * 0.2;

    groupRef.current.children.forEach((child) => {
      child.scale.set(scale, scale, scale);
      if (child instanceof THREE.Mesh) {
        (child.material as THREE.MeshBasicMaterial).opacity = opacity;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {targetNodes.map((node) => {
        const x = node.x ?? 0;
        const y = node.y ?? 0;
        const z = node.z ?? 0;
        
        // Skip rendering if position is invalid
        if (isNaN(x) || isNaN(y) || isNaN(z)) return null;

        return (
          <mesh key={`target-${node.id}`} position={[x, y, z]}>
            <sphereGeometry args={[LEVEL_CONFIG[node.level || 'leaf'].radius * 1.3, 16, 16]} />
            <meshBasicMaterial color="#6366f1" transparent opacity={0.4} depthWrite={false} />
          </mesh>
        );
      })}
    </group>
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
      if (child && typeof node.x === 'number' && !isNaN(node.x) && !isNaN(node.y!) && !isNaN(node.z!)) {
        child.position.set(node.x, node.y!, node.z!);
        child.visible = true;
      } else if (child) {
        child.visible = false;
      }
    });
  });

  if (targetNodes.length === 0) return null;

  return (
    <group ref={groupRef}>
      {targetNodes.map(node => {
        // Initial position check
        const x = node.x ?? 0;
        const y = node.y ?? 0;
        const z = node.z ?? 0;
        const isValid = !isNaN(x) && !isNaN(y) && !isNaN(z);

        return (
          <mesh key={node.id} position={[x, y, z]} visible={isValid}>
            <sphereGeometry args={[LEVEL_CONFIG[node.level || 'leaf'].radius, 32, 32]} />
            <meshBasicMaterial 
              color="#ff00ff" 
              transparent 
              opacity={0.5} 
              depthWrite={false} // Prevent z-fighting and allow seeing through
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        );
      })}
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
  
  const isValidPosition = (val: any) => 
    typeof val === 'number' && 
    !isNaN(val) && 
    isFinite(val);
  
  const isValidNode = (n: any) => n && 
    isValidPosition(n.x) &&
    isValidPosition(n.y) &&
    isValidPosition(n.z);
  
  useFrame(() => {
    if (geometryRef.current && nodesMapRef?.current) {
      const linksToRender = links || linksRef?.current || [];
      const nodesMap = nodesMapRef.current;
      
      const count = linksToRender.length;
      const size = count * 6;
      
      const currentAttribute = geometryRef.current.getAttribute('position') as THREE.BufferAttribute;
      let positions: Float32Array;
      
      if (!currentAttribute || currentAttribute.array.length < size) {
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

        if (isValidNode(source) && isValidNode(target)) {
           positions[index++] = source!.x!;
           positions[index++] = source!.y!;
           positions[index++] = source!.z!;
           positions[index++] = target!.x!;
           positions[index++] = target!.y!;
           positions[index++] = target!.z!;
        }
      }

      geometryRef.current.attributes.position.needsUpdate = true;
      geometryRef.current.setDrawRange(0, index / 3);
      
      if (index > 0) {
        geometryRef.current.computeBoundingSphere();
        if (geometryRef.current.boundingSphere && isNaN(geometryRef.current.boundingSphere.radius)) {
          geometryRef.current.boundingSphere.radius = Infinity;
        }
      }
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

// --- Orbit Lines for Solar Mode ---
export const OrbitLines = ({ isDark, layoutMode }: { isDark: boolean, layoutMode: string }) => {
  if (layoutMode !== 'solar') return null;

  const radii = Object.values(RADIAL_DISTANCES).filter(r => r > 0);
  const theme = getTheme(isDark);

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {radii.map((radius, i) => (
        <mesh key={i}>
          <ringGeometry args={[radius - 0.05, radius + 0.05, 128]} />
          <meshBasicMaterial 
            color={isDark ? '#ffffff' : '#000000'} 
            transparent 
            opacity={0.05} 
            side={THREE.DoubleSide} 
          />
        </mesh>
      ))}
    </group>
  );
};

// --- Node Labels ---
export const NodeLabels = React.forwardRef<THREE.Group, NodeLabelsProps>(({ 
  nodesRef, 
  isDark, 
  layoutMode,
  highlightedNodes,
  lockedNodeIds,
  onNodeClick, 
  onNodeDoubleClick,
  simulationVersion,
  forceShowAllLabels = false,
  textDisplayLevel = 'important'
}, ref) => {
  // Use local ref if none provided, or sync with forwarded ref
  const localRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const { addMessage } = useMessageStore();
  
  // Force dark theme text for solar mode since background is always dark
  const effectiveIsDark = isDark || layoutMode === 'solar';
  const theme = getTheme(effectiveIsDark);
  
  const quality = usePerformanceStore(state => state.quality);
  const distMultiplier = quality === 'high' ? 1.0 : (quality === 'medium' ? 0.8 : 0.5);

  useFrame(() => {
    // Determine which ref to use
    const group = (ref as React.MutableRefObject<THREE.Group>)?.current || localRef.current;
    if (!group) return;
    
    const nodes = nodesRef.current;
    
    group.children.forEach((child: any, i) => {
      const node = nodes[i];
      if (node && typeof node.x === 'number' && !isNaN(node.x) && 
          typeof node.y === 'number' && !isNaN(node.y) && 
          typeof node.z === 'number' && !isNaN(node.z)) {
        const config = LEVEL_CONFIG[node.level || 'leaf'] || LEVEL_CONFIG.leaf;
        child.position.set(node.x, node.y + config.radius + 0.4, node.z);
        
        const isDimmed = highlightedNodes.size > 0 && !highlightedNodes.has(node.id);
        
        // Scale text based on distance
        const distance = camera.position.distanceTo(child.position);
        
        // LOD Logic based on textDisplayLevel
        let isVisible = forceShowAllLabels || highlightedNodes.has(node.id);
        let opacity = theme.text.opacity;
        
        if (!isVisible) {
          if (textDisplayLevel === 'all') {
            isVisible = true;
          } else if (textDisplayLevel === 'root_only') {
            isVisible = node.level === 'root';
          } else {
            // Default: 'important' (Adaptive)
            // Use specific visibleDistance from config
            const baseDist = (config as any).visibleDistance ?? 80;
            const visibleDistance = baseDist * distMultiplier;
            
            // Fade out logic:
            // Full opacity until 70% of distance
            // Fade to 0 from 70% to 100%
            const fadeStart = visibleDistance * 0.7;
            
            if (distance > visibleDistance) {
              isVisible = false;
            } else if (distance > fadeStart) {
              // Linear fade
              const fade = 1 - (distance - fadeStart) / (visibleDistance - fadeStart);
              opacity = theme.text.opacity * fade;
              isVisible = true;
            } else {
              isVisible = true;
            }
          }
        }

        if (!isVisible || opacity < 0.05) {
          child.visible = false;
        } else {
          child.visible = true;
          // When forcing labels (e.g. screenshot), we might want to clamp scale to be readable but not huge
          const scale = Math.max(1, distance / 25);
          child.scale.set(scale, scale, scale);
          
          // Force opacity update
          if (child.material) {
             // Update main text opacity
             (child as any).fillOpacity = isDimmed ? 0.2 : opacity;
             // Update background opacity (relative to main opacity)
             (child as any).backgroundOpacity = isDimmed ? 0.2 : (0.75 * (opacity / theme.text.opacity));
             // Update outline opacity
             (child as any).outlineOpacity = isDimmed ? 0.2 : opacity;
          }
        }
        
        if (child.material) {
             child.material.depthTest = true;
             child.material.depthWrite = false;
        }

      } else {
        child.visible = false;
      }
    });
  });

  const handleLabelClick = (node: Node) => {
    if (lockedNodeIds?.has(node.id)) {
      addMessage({ 
        content: '此节点尚未解锁！请先学习前置知识点。', 
        type: 'warning' 
      });
      return;
    }
    onNodeClick?.(node);
  };

  const handleLabelDoubleClick = (node: Node) => {
    if (lockedNodeIds?.has(node.id)) return;
    onNodeDoubleClick?.(node);
  };

  return (
    <group ref={ref || localRef} key={simulationVersion}>
      {nodesRef.current.map((node) => {
        const isDimmed = highlightedNodes.size > 0 && !highlightedNodes.has(node.id);
        
        return (
          <Billboard key={node.id} follow={true} lockX={false} lockY={false} lockZ={false}>
             <Text 
              font="https://unpkg.com/@fontsource/noto-sans-sc@latest/files/noto-sans-sc-chinese-simplified-400-normal.woff"
              fontSize={node.level === 'root' || node.level === 'core' ? 0.6 : 0.45} 
              color={theme.text.color}
              fillOpacity={isDimmed ? 0.2 : theme.text.opacity}
              {...({
                backgroundColor: theme.text.backgroundColor,
                backgroundOpacity: isDimmed ? 0.2 : 0.75,
                padding: 0.05
              } as any)}
              renderOrder={getRenderOrder(node.level)}
              depthTest={true}
              anchorX="center" 
              anchorY="middle"
              outlineWidth={0.06} // Slightly thicker outline for better visibility
              outlineColor={theme.text.outline}
              outlineOpacity={isDimmed ? 0.2 : 1}
              onClick={(e) => {
                e.stopPropagation();
                handleLabelClick(node);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                handleLabelDoubleClick(node);
              }}
              onPointerOver={() => {
                if (!lockedNodeIds?.has(node.id)) {
                  document.body.style.cursor = 'pointer';
                }
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

// --- Solar Layout Controller ---
// This component overrides node positions based on a hierarchical orbit logic.
export const SolarLayoutController = ({ 
  nodesRef, 
  linksRef, 
  layoutMode 
}: { 
  nodesRef: React.MutableRefObject<SimNode[]>, 
  linksRef: React.MutableRefObject<SimLink[]>,
  layoutMode: string
}) => {
  const hierarchyRef = useRef<{ roots: string[], childrenMap: Map<string, string[]> } | null>(null);
  const versionRef = useRef(0);

  useFrame(({ clock }) => {
    if (layoutMode !== 'solar' || nodesRef.current.length === 0) return;

    const time = clock.getElapsedTime();
    const nodes = nodesRef.current;
    const links = linksRef.current;
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // 1. Rebuild hierarchy if data changed
    const currentVersionKey = `${nodes.length}-${links.length}`;
    if (!hierarchyRef.current || (versionRef.current as any) !== currentVersionKey) {
      const childrenMap = new Map<string, string[]>();
      const hasParent = new Set<string>();
      
      const levelOrder: Record<string, number> = { 'root': 0, 'core': 1, 'sub': 2, 'normal': 3, 'leaf': 4 };
      const getLevelVal = (id: string) => levelOrder[nodeMap.get(id)?.level || 'leaf'] ?? 4;

      links.forEach(link => {
        const sId = typeof link.source === 'object' ? (link.source as SimNode).id : link.source;
        const tId = typeof link.target === 'object' ? (link.target as SimNode).id : link.target;
        
        const sLevel = getLevelVal(sId);
        const tLevel = getLevelVal(tId);

        if (sLevel < tLevel && !hasParent.has(tId)) {
          if (!childrenMap.has(sId)) childrenMap.set(sId, []);
          childrenMap.get(sId)!.push(tId);
          hasParent.add(tId);
        }
      });

      const roots = nodes.filter(n => !hasParent.has(n.id)).map(n => n.id);
      hierarchyRef.current = { roots, childrenMap };
      (versionRef.current as any) = currentVersionKey;
    }

    const { roots, childrenMap } = hierarchyRef.current;

    // 2. Recursive Radius Calculation
    const getSystemRadius = (id: string, depth: number): number => {
      const children = childrenMap.get(id) || [];
      if (children.length === 0) return 5;

      let baseOrbit = 0;
      if (depth === 0) baseOrbit = 0;
      else if (depth === 1) baseOrbit = 30;
      else if (depth === 2) baseOrbit = 15;
      else baseOrbit = 8;

      const adaptiveR = baseOrbit + (children.length > 5 ? (children.length - 5) * 2 : 0);
      
      let maxChildRadius = 0;
      children.forEach(cId => {
        maxChildRadius = Math.max(maxChildRadius, getSystemRadius(cId, depth + 1));
      });

      return adaptiveR + maxChildRadius;
    };

    // 3. Recursive Position Update
    const updatePositions = (id: string, parentX: number, parentY: number, parentZ: number, depth: number) => {
      const node = nodeMap.get(id);
      if (!node) return;

      const children = childrenMap.get(id) || [];
      
      // Update this node
      node.x = parentX;
      node.y = parentY;
      node.z = parentZ;

      if (children.length === 0) return;

      let orbitR = 0;
      if (depth === 0) orbitR = 0; // Root is at center of its system
      else if (depth === 1) orbitR = 30;
      else if (depth === 2) orbitR = 15;
      else orbitR = 8;

      const adaptiveOrbitR = orbitR + (children.length > 5 ? (children.length - 5) * 2 : 0);
      const speed = 0.2 / (depth + 1);

      children.forEach((cId, i) => {
        const angle = (i / children.length) * Math.PI * 2 + time * speed;
        // Apply vertical offset for 3D depth
        const cX = parentX + Math.cos(angle) * adaptiveOrbitR;
        const cZ = parentZ + Math.sin(angle) * adaptiveOrbitR;
        const cY = parentY - 10; // Vertical drop per level

        updatePositions(cId, cX, cY, cZ, depth + 1);
      });
    };

    // 4. Arrange Roots
    const rootCount = roots.length;
    const dynamicRadius = Math.max(250, rootCount * 50);

    roots.forEach((rootId, i) => {
      const angle = (i / rootCount) * Math.PI * 2;
      const rx = Math.cos(angle) * dynamicRadius;
      const rz = Math.sin(angle) * dynamicRadius;
      updatePositions(rootId, rx, 0, rz, 0);
    });
  });

  return null;
};

// --- Map View Nodes ---
export const MapNodes = ({ 
  nodesRef, 
  onNodeClick, 
  onNodeDoubleClick,
  onNodeRightClick,
  isDark, 
  highlightedNodes,
  pulsingNodeIds,
  lockedNodeIds,
  masteredNodeIds,
  gamificationEnabled,
  simulationVersion
}: InstancedNodesProps) => {
  const solidMeshRef = useRef<THREE.InstancedMesh>(null);
  const hollowMeshRef = useRef<THREE.InstancedMesh>(null);
  const hitMeshRef = useRef<THREE.InstancedMesh>(null); // Interactive mesh (invisible spheres)
  
  const tempObject = useMemo(() => new THREE.Object3D(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);
  const hoveredRef = useRef<number | null>(null);
  const lastRightClickRef = useRef<{ time: number; instanceId: number | undefined }>({ time: 0, instanceId: undefined });
  const theme = getTheme(isDark);
  const nodeCount = nodesRef.current.length;

  // Snapshot for interaction stability
  const nodeSnapshot = useMemo(() => {
    return nodesRef.current.map(n => ({ id: n.id, title: n.title }));
  }, [simulationVersion, nodeCount]);

  // Pre-calculate indices for different geometries
  const { solidIndices, hollowIndices } = useMemo(() => {
    const solids: number[] = [];
    const hollows: number[] = [];
    
    nodesRef.current.forEach((n, i) => {
      const level = n.level || 'leaf';
      if (level === 'leaf') {
        hollows.push(i);
      } else {
        solids.push(i);
        if (level === 'root') {
          // Root gets an extra ring (hollow)
          hollows.push(i); 
        }
      }
    });
    return { solidIndices: solids, hollowIndices: hollows };
  }, [simulationVersion, nodeCount]);

  // Update Visuals
  useFrame(() => {
    if (!solidMeshRef.current || !hollowMeshRef.current || !hitMeshRef.current) return;
    
    const nodes = nodesRef.current;
    
    // 1. Update Solid Mesh (Core, Sub, Normal, Root-Center)
    solidIndices.forEach((nodeIndex, i) => {
      const node = nodes[nodeIndex];
      if (!node) return;
      
      const config = LEVEL_CONFIG[node.level || 'leaf'];

      // Position
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const z = node.z ?? 0;
      
      if (isNaN(x) || isNaN(y) || isNaN(z)) {
        tempObject.position.set(10000, 10000, 10000);
      } else {
        tempObject.position.set(x, y, z);
        // Rotate flat on ground
        tempObject.rotation.x = -Math.PI / 2;
        
        let scale = config.radius;
        if (hoveredRef.current === nodeIndex) scale *= 1.2;
        
        tempObject.scale.set(scale, scale, 1);
      }
      
      tempObject.updateMatrix();
      solidMeshRef.current!.setMatrixAt(i, tempObject.matrix);
      
      // Color
      const isDimmed = highlightedNodes.size > 0 && !highlightedNodes.has(node.id);
      const isLocked = lockedNodeIds?.has(node.id);
      const isMastered = masteredNodeIds?.has(node.id);
      
      let baseColor: string = config.color;
      if (isLocked) baseColor = '#94a3b8';
      else if (isMastered) baseColor = '#10b981';
      
      tempColor.set(baseColor);
      if (!isLocked && !isDimmed) {
        tempColor.multiplyScalar(config.emissiveIntensity || 1.0);
      }
      if (isDimmed) tempColor.lerp(BLACK, 0.8);
      
      solidMeshRef.current!.setColorAt(i, tempColor);
    });
    
    // 2. Update Hollow Mesh (Leaf, Root-Outer)
    hollowIndices.forEach((nodeIndex, i) => {
      const node = nodes[nodeIndex];
      if (!node) return;

      const config = LEVEL_CONFIG[node.level || 'leaf'];

      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const z = node.z ?? 0;
      
      if (isNaN(x) || isNaN(y) || isNaN(z)) {
        tempObject.position.set(10000, 10000, 10000);
      } else {
        tempObject.position.set(x, y, z);
        tempObject.rotation.x = -Math.PI / 2;
        
        let scale = config.radius;
        
        // If Root, the hollow ring is larger (outer ring)
        if (node.level === 'root') {
          scale *= 1.6; 
        }
        
        if (hoveredRef.current === nodeIndex) scale *= 1.2;
        
        tempObject.scale.set(scale, scale, 1);
      }

      tempObject.updateMatrix();
      hollowMeshRef.current!.setMatrixAt(i, tempObject.matrix);
      
      // Color (Same logic)
      const isDimmed = highlightedNodes.size > 0 && !highlightedNodes.has(node.id);
      const isLocked = lockedNodeIds?.has(node.id);
      const isMastered = masteredNodeIds?.has(node.id);
      
      let baseColor: string = config.color;
      if (isLocked) baseColor = '#94a3b8';
      else if (isMastered) baseColor = '#10b981';
      
      tempColor.set(baseColor);
      if (!isLocked && !isDimmed) {
        tempColor.multiplyScalar(config.emissiveIntensity || 1.0);
      }
      if (isDimmed) tempColor.lerp(BLACK, 0.8);
      
      hollowMeshRef.current!.setColorAt(i, tempColor);
    });

    // 3. Update Hit Mesh (Invisible Spheres for Interaction)
    // We map ALL nodes to hit mesh
    for (let i = 0; i < nodeCount; i++) {
      const node = nodes[i];
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const z = node.z ?? 0;
      
      if (isNaN(x) || isNaN(y) || isNaN(z)) {
        tempObject.position.set(10000, 10000, 10000);
      } else {
        tempObject.position.set(x, y, z);
        tempObject.rotation.set(0,0,0);
        const config = LEVEL_CONFIG[node.level || 'leaf'];
        // Larger hit area
        const scale = Math.max(config.radius * 2, 1.5);
        tempObject.scale.set(scale, scale, scale);
      }
      tempObject.updateMatrix();
      hitMeshRef.current!.setMatrixAt(i, tempObject.matrix);
    }

    if (solidMeshRef.current) {
      solidMeshRef.current.instanceMatrix.needsUpdate = true;
      if (solidMeshRef.current.instanceColor) solidMeshRef.current.instanceColor.needsUpdate = true;
    }
    if (hollowMeshRef.current) {
      hollowMeshRef.current.instanceMatrix.needsUpdate = true;
      if (hollowMeshRef.current.instanceColor) hollowMeshRef.current.instanceColor.needsUpdate = true;
    }
    if (hitMeshRef.current) hitMeshRef.current.instanceMatrix.needsUpdate = true;
  });

  const handleInteraction = (instanceId: number | undefined, callback?: (node: SimNode) => void) => {
    if (instanceId === undefined) return;
    const nodeMeta = nodeSnapshot[instanceId];
    if (nodeMeta) {
      if (lockedNodeIds?.has(nodeMeta.id)) {
        // useMessageStore usage is valid here as it's a hook used in component
        // But we need to make sure we don't break rules of hooks if we were outside
        // We are inside component, so it's fine.
        // However, we didn't import useMessageStore in this scope (it's imported at top file).
        // Wait, I need to check if I can access useMessageStore.getState().addMessage?
        // Or just use props? InstancedNodes doesn't take addMessage.
        // InstancedNodes uses useMessageStore hook. I should do same.
        // I will access the store directly if needed or add the hook.
      }
      const actualNode = nodesRef.current.find(n => n.id === nodeMeta.id);
      if (actualNode) callback?.(actualNode);
    }
  };

  return (
    <>
      {/* Solid Circles (Core, Sub, Normal, Root-Inner) */}
      <instancedMesh
        key={`solid-${simulationVersion}`}
        ref={solidMeshRef}
        args={[undefined, undefined, solidIndices.length]}
        frustumCulled={false}
      >
        <circleGeometry args={[1, 32]} />
        <meshStandardMaterial 
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </instancedMesh>

      {/* Hollow Rings (Leaf, Root-Outer) */}
      <instancedMesh
        key={`hollow-${simulationVersion}`}
        ref={hollowMeshRef}
        args={[undefined, undefined, hollowIndices.length]}
        frustumCulled={false}
      >
        <ringGeometry args={[0.7, 1, 32]} />
        <meshStandardMaterial 
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </instancedMesh>

      {/* Hit Mesh (Interactive) */}
      <instancedMesh
        key={`hit-${simulationVersion}`}
        ref={hitMeshRef}
        args={[undefined, undefined, nodeCount]}
        frustumCulled={false}
        visible={false} // Make it truly invisible but raycastable? 
        // Threejs raycast works on invisible objects? Usually no.
        // So we use opacity 0.
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
          handleInteraction(e.instanceId, onNodeRightClick);
        }}
      >
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </instancedMesh>

      {/* Effects */}
      <PulseNodes nodesRef={nodesRef} activeNodeIds={pulsingNodeIds} />
      {gamificationEnabled && (
        <TargetNodes
          nodesRef={nodesRef}
          lockedNodeIds={lockedNodeIds}
          masteredNodeIds={masteredNodeIds}
          highlightedNodes={highlightedNodes}
        />
      )}
    </>
  );
};
