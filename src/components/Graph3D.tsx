import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Billboard, Environment, Float } from '@react-three/drei';
import * as THREE from 'three';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceY } from 'd3-force-3d';
import { Node, Edge } from '../types/index';

interface Graph3DProps {
  nodes: Node[];
  edges: Edge[];
  onNodeClick: (node: Node) => void;
  showGrid?: boolean;
}

// Extend Node with simulation properties
interface SimNode extends Node {
  x?: number;
  y?: number;
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
  // Level property for styling and physics
  level?: 'root' | 'core' | 'sub' | 'normal' | 'leaf';
  [key: string]: any;
}

interface SimLink {
  source: string | SimNode;
  target: string | SimNode;
  id: string;
}

// Configuration for node levels with enhanced visual properties
const LEVEL_CONFIG = {
  root: {
    chargeStrength: -60,
    radius: 1.4, // Increased size for prominence
    color: '#8B5CF6', // Violet-500
    emissive: '#5B21B6', // Violet-800
    emissiveIntensity: 0.8,
    roughness: 0.1,
    metalness: 0.3,
  },
  core: {
    chargeStrength: -40,
    radius: 1.1,
    color: '#F43F5E', // Rose-500
    emissive: '#9F1239', // Rose-800
    emissiveIntensity: 0.5,
    roughness: 0.2,
    metalness: 0.2,
  },
  sub: {
    chargeStrength: -30,
    radius: 0.8,
    color: '#F59E0B', // Amber-500
    emissive: '#92400E', // Amber-800
    emissiveIntensity: 0.3,
    roughness: 0.3,
    metalness: 0.1,
  },
  normal: {
    chargeStrength: -20,
    radius: 0.5,
    color: '#10B981', // Emerald-500
    emissive: '#065F46', // Emerald-800
    emissiveIntensity: 0.2,
    roughness: 0.4,
    metalness: 0.1,
  },
  leaf: {
    chargeStrength: -10,
    radius: 0.3,
    color: '#3B82F6', // Blue-500
    emissive: '#1E40AF', // Blue-800
    emissiveIntensity: 0.1,
    roughness: 0.5,
    metalness: 0.0,
  }
};

const NodeMesh = ({ node, onClick }: { node: SimNode; onClick: (node: Node) => void }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  
  // Get style based on level
  const config = LEVEL_CONFIG[node.level || 'leaf'];
  // Scale radius on hover
  const targetRadius = hovered ? config.radius * 1.2 : config.radius;
  
  // Update position directly from simulation node data in useFrame
  useFrame(() => {
    if (groupRef.current && typeof node.x === 'number' && typeof node.y === 'number' && typeof node.z === 'number') {
      groupRef.current.position.set(node.x, node.y, node.z);
    }
  });

  return (
    <group 
      ref={groupRef} 
      onClick={(e) => { e.stopPropagation(); onClick(node); }}
      onPointerOver={() => { document.body.style.cursor = 'pointer'; setHovered(true); }}
      onPointerOut={() => { document.body.style.cursor = 'default'; setHovered(false); }}
    >
      {/* Add subtle floating animation for liveliness */}
      <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
        <mesh>
          <sphereGeometry args={[targetRadius, 32, 32]} />
          <meshPhysicalMaterial 
            color={node.color || config.color} 
            emissive={config.emissive}
            emissiveIntensity={hovered ? config.emissiveIntensity + 0.3 : config.emissiveIntensity}
            roughness={config.roughness}
            metalness={config.metalness}
            clearcoat={0.5}
            clearcoatRoughness={0.1}
          />
        </mesh>
      </Float>
      
      {/* Use Billboard to make text always face the camera */}
      <Billboard
        position={[0, targetRadius + 0.4, 0]}
        follow={true}
        lockX={false}
        lockY={false}
        lockZ={false}
      >
        <Text 
          fontSize={node.level === 'root' || node.level === 'core' ? 0.5 : 0.35} 
          color="white" 
          anchorX="center" 
          anchorY="middle"
          outlineWidth={0.04}
          outlineColor="#000000"
          font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff"
        >
          {node.title}
        </Text>
      </Billboard>
    </group>
  );
};

const LinkLines = ({ links }: { links: SimLink[] }) => {
  const geometryRef = useRef<THREE.BufferGeometry>(null);

  useFrame(() => {
    if (geometryRef.current) {
      const positions: number[] = [];
      
      links.forEach(link => {
        // d3-force replaces source/target strings with object references
        const source = link.source as SimNode;
        const target = link.target as SimNode;

        if (typeof source.x === 'number' && typeof target.x === 'number') {
          positions.push(source.x, source.y!, source.z!);
          positions.push(target.x, target.y!, target.z!);
        }
      });

      geometryRef.current.setAttribute(
        'position', 
        new THREE.Float32BufferAttribute(positions, 3)
      );
      geometryRef.current.attributes.position.needsUpdate = true;
    }
  });

  return (
    <lineSegments>
      <bufferGeometry ref={geometryRef} />
      <lineBasicMaterial color="#9ca3af" opacity={0.6} transparent linewidth={1} />
    </lineSegments>
  );
};

const ForceGraphScene = ({ nodes, edges, onNodeClick, showGrid }: Graph3DProps) => {
  const [simNodes, setSimNodes] = useState<SimNode[]>([]);
  const [simLinks, setSimLinks] = useState<SimLink[]>([]);
  const prevNodeCount = useRef(0);
  
  // Keep a persistent reference to the simulation
  const simulation = useRef<any>(null);

  // Initialize/Update Simulation Data
  useEffect(() => {
    // 0. Pre-calculate node degrees to determine levels automatically
    const nodeDegrees = new Map<string, number>();
    edges.forEach(edge => {
      nodeDegrees.set(edge.source_node_id, (nodeDegrees.get(edge.source_node_id) || 0) + 1);
      nodeDegrees.set(edge.target_node_id, (nodeDegrees.get(edge.target_node_id) || 0) + 1);
    });

    // 1. Merge new props with existing simulation state to preserve positions
    setSimNodes(prevNodes => {
      const existingMap = new Map(prevNodes.map(n => [n.id, n]));
      
      return nodes.map(n => {
        const existing = existingMap.get(n.id);
        
        // Determine level logic:
        // Priority 1: Explicit property in DB (Manual Override)
        // Priority 2: Fallback to degree centrality (only if property missing)
        let level: 'root' | 'core' | 'sub' | 'normal' | 'leaf' = 'leaf';
        const degree = nodeDegrees.get(n.id) || 0;
        
        if (n.properties?.level) {
           // Trust the database property completely
           level = n.properties.level as any;
        } else {
           // Fallback logic ONLY for nodes without explicit level
           if (degree >= 10) level = 'root';
           else if (degree >= 6) level = 'core';
           else if (degree >= 4) level = 'sub';
           else if (degree >= 2) level = 'normal';
           else level = 'leaf';
        }

        if (existing) {
          // Update properties but keep simulation state (x,y,z,vx,vy,vz)
          return { ...existing, ...n, level };
        } else {
          // Initialize new node
          // Map database x/y to 3D space x/z (horizontal plane)
          // Y is initialized to near 0 for height
          return { 
            ...n, 
            level,
            x: n.x_position || (Math.random() - 0.5) * 10, 
            y: (Math.random() - 0.5) * 2, // Small initial vertical jitter
            z: n.y_position || (Math.random() - 0.5) * 10 // Map db Y to 3D Z
          };
        }
      });
    });

    setSimLinks(edges.map(e => ({
      id: e.id,
      source: e.source_node_id,
      target: e.target_node_id
    })));

  }, [nodes, edges]);

  // Manage Simulation
  useEffect(() => {
    if (!simulation.current) {
      // Initialize simulation
      simulation.current = forceSimulation()
        .numDimensions(3) // Enable 3D
        .force('center', forceCenter())
        .force('y', forceY(0).strength(5)) // Strong vertical compression to keep layout flat (quasi-2D)
        .force('collide', forceCollide().radius((d: any) => {
           // Dynamic collision radius based on node level size
           const level = d.level || 'leaf';
           const config = LEVEL_CONFIG[level as keyof typeof LEVEL_CONFIG];
           return config.radius * 1.5; // Multiplier for breathing room
        }).iterations(3)); // Increased iterations for better packing without vertical escape
    }

    // Update simulation nodes/links
    // Note: d3 mutates these arrays
    simulation.current.nodes(simNodes);
    
    // Dynamic charge force based on node level
    simulation.current.force('charge', forceManyBody()
      .strength((d: any) => {
        const level = d.level || 'leaf';
        const config = LEVEL_CONFIG[level as keyof typeof LEVEL_CONFIG];
        return config.chargeStrength;
      })
      .distanceMax(15) // Limit repulsion range to prevent distant nodes from affecting each other
    );

    // Dynamic link distance based on node levels
    // Connect high-level nodes with longer links, low-level nodes with shorter links
    simulation.current.force('link', forceLink(simLinks)
      .id((d: any) => d.id)
      .distance((link: any) => {
        const sourceLevel = link.source.level || 'leaf';
        const targetLevel = link.target.level || 'leaf';
        
        // If either node is high level, use longer distance but much more compact than before
        if (sourceLevel === 'root' || targetLevel === 'root') return 3.0;
        if (sourceLevel === 'core' || targetLevel === 'core') return 2.0;
        if (sourceLevel === 'sub' || targetLevel === 'sub') return 1.5;
        return 1.0; // Leaf-Leaf connections are very tight
      })
    ); 
    
    // Re-heat simulation when data changes
    // Use lower alpha for incremental updates to prevent large jumps
    const isIncremental = simNodes.length > prevNodeCount.current && prevNodeCount.current > 0;
    const alpha = isIncremental ? 0.3 : 1;
    simulation.current.alpha(alpha).restart();
    
    prevNodeCount.current = simNodes.length;

    return () => {
      // Cleanup if needed
      simulation.current.stop();
    };
  }, [simNodes, simLinks]);

  // Tick simulation in useFrame
  useFrame(() => {
    if (simulation.current) {
      simulation.current.tick();
    }
  });

  return (
    <>
      <OrbitControls />
      {/* Position grid slightly lower to give a "floor" feel */}
      {showGrid && <gridHelper args={[100, 100]} position={[0, -2, 0]} />}
      
      {/* Ambient light for general illumination */}
      <ambientLight intensity={0.4} />
      {/* Point lights for 3D depth */}
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} />
      
      {/* Environment for realistic reflections and lighting */}
      <Environment preset="city" />

      {simNodes.map(node => (
        <NodeMesh key={node.id} node={node} onClick={onNodeClick} />
      ))}
      
      <LinkLines links={simLinks} />
    </>
  );
};

export const Graph3D: React.FC<Graph3DProps> = (props) => {
  return (
    <div className="w-full h-full bg-slate-900">
      {/* 
        Camera positioned higher (Y=20) and further back (Z=20) 
        to provide a "top-down perspective" (similar to 俯视图)
        FOV 50 provides a slightly flatter look
      */}
      <Canvas camera={{ position: [0, 20, 25], fov: 50 }}>
        <ForceGraphScene {...props} />
      </Canvas>
    </div>
  );
};
