import React, { useEffect, useRef, useState, useMemo, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Billboard, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { Node, Edge } from '../types/index';

export interface Graph3DRef {
  focusNode: (nodeId: string) => void;
}

interface Graph3DProps {
  nodes: Node[];
  edges: Edge[];
  onNodeClick: (node: Node) => void;
  showGrid?: boolean;
  isDark?: boolean;
  selectedNodeId?: string | null;
  highlightedPath?: { nodes: Set<string>, links: Set<string> } | null;
}

// Extend Node with simulation properties
interface SimNode extends Node {
  x?: number;
  y?: number;
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
  level?: 'root' | 'core' | 'sub' | 'normal' | 'leaf';
  [key: string]: any;
}

interface SimLink {
  source: string;
  target: string;
  id: string;
}

// Configuration for node levels
const LEVEL_CONFIG = {
  root: { radius: 1.4, color: '#8B5CF6', emissive: '#5B21B6', emissiveIntensity: 0.8 },
  core: { radius: 1.1, color: '#F43F5E', emissive: '#9F1239', emissiveIntensity: 0.5 },
  sub: { radius: 0.8, color: '#F59E0B', emissive: '#92400E', emissiveIntensity: 0.3 },
  normal: { radius: 0.5, color: '#10B981', emissive: '#065F46', emissiveIntensity: 0.2 },
  leaf: { radius: 0.3, color: '#3B82F6', emissive: '#1E40AF', emissiveIntensity: 0.1 }
};

// Instanced Mesh for Nodes
const InstancedNodes = ({ 
  nodes, 
  onNodeClick, 
  onNodeDoubleClick,
  isDark, 
  highlightedNodes 
}: { 
  nodes: SimNode[], 
  onNodeClick: (node: Node) => void, 
  onNodeDoubleClick: (node: Node) => void,
  isDark: boolean,
  highlightedNodes: Set<string>
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { camera } = useThree();
  const tempObject = new THREE.Object3D();
  const tempColor = new THREE.Color();
  const hoveredRef = useRef<number | null>(null);

  // Fix: Ensure bounding sphere is infinite for Raycasting
  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
    }
  }, []);

  useFrame(() => {
    if (!meshRef.current) return;
    
    // We assume nodes have updated x,y,z from parent's simulation reference
    // But React props 'nodes' might be stale if we don't force update.
    // However, the parent ForceGraphScene passes the *latest* nodes array if it re-renders.
    // Actually, for performance, we want to read from a Mutable Ref, not props.
    // But to keep it simple and compatible with the loop, let's accept the array.
    // The trick is: The parent's useFrame updates the node objects IN PLACE.
    
    nodes.forEach((node, i) => {
      if (typeof node.x !== 'number') return;

      tempObject.position.set(node.x, node.y!, node.z!);
      
      const config = LEVEL_CONFIG[node.level || 'leaf'];
      let scale = config.radius;
      
      // Hover effect
      if (hoveredRef.current === i) {
        scale *= 1.2;
      }
      
      tempObject.scale.set(scale, scale, scale);
      tempObject.updateMatrix();
      meshRef.current!.setMatrixAt(i, tempObject.matrix);
      
      // Color logic
      const isDimmed = highlightedNodes.size > 0 && !highlightedNodes.has(node.id);
      const baseColor = config.color;
      
      tempColor.set(baseColor);
      if (isDimmed) {
        tempColor.lerp(new THREE.Color('#000000'), 0.8); // Dim it
      }
      meshRef.current!.setColorAt(i, tempColor);
    });
    
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, nodes.length]}
      frustumCulled={false}
      onClick={(e) => {
        e.stopPropagation();
        if (e.instanceId !== undefined && nodes[e.instanceId]) {
          onNodeClick(nodes[e.instanceId]);
        }
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (e.instanceId !== undefined && nodes[e.instanceId]) {
          onNodeDoubleClick(nodes[e.instanceId]);
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

// Optimized Lines
const LinkLines = ({ links, nodesMap, isDark, opacity = 0.6 }: { links: SimLink[], nodesMap: Map<string, SimNode>, isDark: boolean, opacity?: number }) => {
  const geometryRef = useRef<THREE.BufferGeometry>(null);

  useFrame(() => {
    if (geometryRef.current) {
      const positions: number[] = [];
      
      links.forEach(link => {
        const source = nodesMap.get(link.source);
        const target = nodesMap.get(link.target);

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
      <lineBasicMaterial color={isDark ? "#9ca3af" : "#64748b"} opacity={opacity} transparent linewidth={1} />
    </lineSegments>
  );
};

// Labels Component - Separate from InstancedMesh for now
const NodeLabels = ({ 
  nodes, 
  isDark, 
  highlightedNodes,
  onNodeClick,
  onNodeDoubleClick
}: { 
  nodes: SimNode[], 
  isDark: boolean, 
  highlightedNodes: Set<string>,
  onNodeClick: (node: Node) => void,
  onNodeDoubleClick: (node: Node) => void
}) => {
  // Optimization: Only render labels for important nodes or when few nodes
  // For P1, we render all but use efficient updates.
  // Actually, we can use a group ref and update children positions in useFrame
  
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();

  useFrame(() => {
    if (!groupRef.current) return;
    
    // Update each child (Billboard) position
    groupRef.current.children.forEach((child: any, i) => {
      const node = nodes[i];
      if (node && typeof node.x === 'number') {
        const config = LEVEL_CONFIG[node.level || 'leaf'];
        child.position.set(node.x, node.y! + config.radius + 0.4, node.z);
        
        // Scale text based on distance
        const distance = camera.position.distanceTo(child.position);
        const scale = Math.max(1, distance / 25);
        child.scale.set(scale, scale, scale);
        
        // Visibility check (optional culling)
        child.visible = true;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {nodes.map((node) => {
        const isDimmed = highlightedNodes.size > 0 && !highlightedNodes.has(node.id);
        const config = LEVEL_CONFIG[node.level || 'leaf'];
        
        return (
          <Billboard key={node.id} follow={true} lockX={false} lockY={false} lockZ={false}>
             <Text 
              fontSize={node.level === 'root' || node.level === 'core' ? 0.6 : 0.45} 
              color={isDark ? "white" : "#1e293b"} 
              fillOpacity={isDimmed ? 0.2 : 1}
              anchorX="center" 
              anchorY="middle"
              outlineWidth={0.05}
              outlineColor={isDark ? "#000000" : "#ffffff"}
              outlineOpacity={isDimmed ? 0.2 : 1}
              font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff"
              onClick={(e) => {
                e.stopPropagation();
                onNodeClick(node);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                onNodeDoubleClick(node);
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

const CameraController = ({ targetPosition, targetLookAt }: { targetPosition: THREE.Vector3 | null, targetLookAt: THREE.Vector3 | null }) => {
  const { camera, gl } = useThree();
  const controlsRef = useRef<any>(null);
  
  useFrame(() => {
    if (targetPosition && targetLookAt && controlsRef.current) {
      camera.position.lerp(targetPosition, 0.05);
      controlsRef.current.target.lerp(targetLookAt, 0.05);
      controlsRef.current.update();
    }
  });

  return <OrbitControls ref={controlsRef} args={[camera, gl.domElement]} />;
};

const ForceGraphScene = forwardRef((props: Graph3DProps, ref: React.ForwardedRef<Graph3DRef>) => {
  const { nodes: rawNodes, edges: rawEdges, onNodeClick, showGrid, isDark = true, selectedNodeId, highlightedPath } = props;
  
  // Simulation State
  const workerRef = useRef<Worker | null>(null);
  const [nodes, setNodes] = useState<SimNode[]>([]);
  const [links, setLinks] = useState<SimLink[]>([]);
  
  // Map for fast lookup
  const nodesMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  // Spotlight state
  const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
  const [highlightedLinks, setHighlightedLinks] = useState<Set<string>>(new Set());

  // Camera focus
  const [focusTarget, setFocusTarget] = useState<{ pos: THREE.Vector3, lookAt: THREE.Vector3 } | null>(null);

  // Initialize Worker
  useEffect(() => {
    workerRef.current = new Worker(new URL('../workers/simulationWorker.ts', import.meta.url), { type: 'module' });
    
    workerRef.current.onmessage = (e) => {
      const { type, nodes: updatedNodes } = e.data;
      if (type === 'tick') {
        // Update local node positions IN PLACE to avoid re-renders for every tick
        // But we need to trigger a re-render initially to populate the InstancedMesh
        // Wait, if we update objects in place, React doesn't know.
        // We use a Ref to hold the nodes for the animation loop.
        // But the components (InstancedNodes) need the array to map over.
        // Solution: Maintain a state that holds the ARRAY STRUCTURE (SimNodes), 
        // and update the properties (x,y,z) of these objects.
        
        setNodes(prevNodes => {
           if (prevNodes.length === 0) return updatedNodes;
           // Merge positions into existing objects
           updatedNodes.forEach((n: any, i: number) => {
             if (prevNodes[i] && prevNodes[i].id === n.id) {
               prevNodes[i].x = n.x;
               prevNodes[i].y = n.y;
               prevNodes[i].z = n.z;
             }
           });
           return prevNodes; // Return SAME array reference to avoid re-render, but data is mutated
        });
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // Send Data to Worker
  useEffect(() => {
    if (!workerRef.current) return;

    // Process nodes to add levels (logic moved here from worker or kept here)
    // It's better to compute levels here once.
    const nodeDegrees = new Map<string, number>();
    rawEdges.forEach(edge => {
      const sId = String(edge.source_node_id);
      const tId = String(edge.target_node_id);
      nodeDegrees.set(sId, (nodeDegrees.get(sId) || 0) + 1);
      nodeDegrees.set(tId, (nodeDegrees.get(tId) || 0) + 1);
    });

    const simNodes: SimNode[] = rawNodes.map(n => {
      const nodeIdStr = String(n.id);
      let level: any = 'leaf';
      const degree = nodeDegrees.get(nodeIdStr) || 0;
      
      if (n.properties?.level) {
         level = n.properties.level;
      } else {
         if (degree >= 10) level = 'root';
         else if (degree >= 6) level = 'core';
         else if (degree >= 4) level = 'sub';
         else if (degree >= 2) level = 'normal';
      }
      return { ...n, id: nodeIdStr, level };
    });

    const simLinks: SimLink[] = rawEdges.map(e => ({
      id: String(e.id),
      source: String(e.source_node_id),
      target: String(e.target_node_id)
    }));

    // Initialize state
    setNodes(simNodes);
    setLinks(simLinks);

    // Send to worker
    workerRef.current.postMessage({
      type: 'updateData',
      payload: { nodes: simNodes, links: simLinks }
    });

  }, [rawNodes, rawEdges]);

  // Spotlight Logic
  useEffect(() => {
    if (highlightedPath) {
      setHighlightedNodes(highlightedPath.nodes);
      setHighlightedLinks(highlightedPath.links);
      return;
    }

    if (!selectedNodeId) {
      setHighlightedNodes(new Set());
      setHighlightedLinks(new Set());
      return;
    }

    const neighbors = new Set<string>();
    const connectedLinks = new Set<string>();
    neighbors.add(selectedNodeId);

    links.forEach(link => {
      if (link.source === selectedNodeId) {
        neighbors.add(link.target);
        connectedLinks.add(link.id);
      } else if (link.target === selectedNodeId) {
        neighbors.add(link.source);
        connectedLinks.add(link.id);
      }
    });

    setHighlightedNodes(neighbors);
    setHighlightedLinks(connectedLinks);
  }, [selectedNodeId, highlightedPath, links]);

  // Focus Logic
  const focusNodeInternal = useCallback((nodeId: string) => {
    const targetNode = nodes.find(n => n.id === nodeId);
    if (targetNode && typeof targetNode.x === 'number') {
      const nodePos = new THREE.Vector3(targetNode.x, targetNode.y, targetNode.z);
      setFocusTarget({
        pos: nodePos.clone().add(new THREE.Vector3(0, 2, 5)),
        lookAt: nodePos
      });
      setTimeout(() => setFocusTarget(null), 2000);
    }
  }, [nodes]);

  useImperativeHandle(ref, () => ({
    focusNode: focusNodeInternal
  }), [focusNodeInternal]);

  return (
    <>
      {showGrid && <gridHelper args={isDark ? [100, 100] : [100, 100, 0x94a3b8, 0xe2e8f0]} position={[0, -2, 0]} />}
      <ambientLight intensity={isDark ? 0.4 : 0.7} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} />
      <Environment preset="city" />

      <InstancedNodes 
        nodes={nodes} 
        onNodeClick={onNodeClick} 
        onNodeDoubleClick={(node) => focusNodeInternal(node.id)}
        isDark={isDark} 
        highlightedNodes={highlightedNodes} 
      />
      
      <NodeLabels 
        nodes={nodes} 
        isDark={isDark} 
        highlightedNodes={highlightedNodes} 
        onNodeClick={onNodeClick}
        onNodeDoubleClick={(node) => focusNodeInternal(node.id)}
      />
      
      <LinkLines 
        links={links} 
        nodesMap={nodesMap} 
        isDark={isDark} 
        opacity={highlightedLinks.size > 0 ? 0.05 : 0.6}
      />
      
      {highlightedLinks.size > 0 && (
        <LinkLines 
          links={links.filter(l => highlightedLinks.has(l.id))} 
          nodesMap={nodesMap} 
          isDark={isDark} 
          opacity={0.6} 
        />
      )}

      <CameraController 
        targetPosition={focusTarget?.pos || null} 
        targetLookAt={focusTarget?.lookAt || null} 
      />
    </>
  );
});

export const Graph3D = forwardRef((props: Graph3DProps, ref: React.ForwardedRef<Graph3DRef>) => {
  const { isDark = true } = props;
  return (
    <div className={`w-full h-full transition-colors duration-300 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
      <Canvas camera={{ position: [0, 5, 10], fov: 60 }}>
        <ForceGraphScene ref={ref} {...props} />
      </Canvas>
    </div>
  );
});
