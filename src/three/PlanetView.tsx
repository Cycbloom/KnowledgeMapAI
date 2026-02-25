import React, { useMemo, useRef, useState, useCallback, Suspense, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Stars, Line, Billboard } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { Node, Edge, ColorScheme, GraphColorMode, type Node as GraphNode } from '../types';
import { create3DForceLayout, LayoutNode3D, LayoutLink3D } from './layout/forceLayout3D';
import { useTheme } from '../hooks/useTheme';

interface PlanetViewProps {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  onNodeClick: (node: GraphNode) => void;
  width?: number;
  height?: number;
  colorScheme?: ColorScheme;
  coloringMode?: GraphColorMode;
}

const NODE_COLORS = Object.freeze({
  root: new THREE.Color('#FFD700'),
  core: new THREE.Color('#FF8C00'),
  normal: new THREE.Color('#4A90D9'),
  leaf: new THREE.Color('#00CED1'),
  selected: new THREE.Color('#FF69B4'),
  hover: new THREE.Color('#98FB98')
});

function getNodeType(node: LayoutNode3D, layoutLinks: LayoutLink3D[]): 'root' | 'core' | 'normal' | 'leaf' {
  const hasChildren = layoutLinks.some(link => link.source === node.id);
  const hasParent = layoutLinks.some(link => link.target === node.id);
  
  if (!hasParent) return 'root';
  if (hasChildren && node.level === 1) return 'core';
  if (hasChildren) return 'normal';
  return 'leaf';
}

interface PlanetNodeProps {
  node: LayoutNode3D;
  layoutLinks: LayoutLink3D[];
  isSelected: boolean;
  isHovered: boolean;
  onClick: () => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  colorScheme: ColorScheme;
  isDark: boolean;
}

function PlanetNode({
  node,
  layoutLinks,
  isSelected,
  isHovered,
  onClick,
  onPointerEnter,
  onPointerLeave,
  colorScheme: _colorScheme,
  isDark
}: PlanetNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const scaleRef = useRef(1);
  const nodePosRef = useRef(new THREE.Vector3(node.x, node.z, node.y));
  const type = getNodeType(node, layoutLinks);
  
  const baseSize = useMemo(() => {
    const minSize = 3;
    const maxSize = 8;
    return minSize + (node.importance / 5) * (maxSize - minSize);
  }, [node.importance]);

  const color = useMemo(() => {
    if (isSelected) return NODE_COLORS.selected;
    if (isHovered) return NODE_COLORS.hover;
    return NODE_COLORS[type];
  }, [isSelected, isHovered, type]);

  const tags = useMemo(() => {
    return node.data.properties?.tags || [];
  }, [node.data.properties?.tags]);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.003;
    }
    
    const distance = camera.position.distanceTo(nodePosRef.current);
    const baseDistance = 200;
    const newScale = Math.max(0.3, Math.min(2, distance / baseDistance));
    
    if (Math.abs(scaleRef.current - newScale) > 0.05) {
      scaleRef.current = newScale;
    }
  });

  useEffect(() => {
    return () => {
      if (meshRef.current) {
        meshRef.current.geometry.dispose();
        if (Array.isArray(meshRef.current.material)) {
          meshRef.current.material.forEach(m => m.dispose());
        } else {
          meshRef.current.material.dispose();
        }
      }
    };
  }, []);

  const titleFontSize = 5 * scaleRef.current;
  const tagFontSize = 3 * scaleRef.current;
  const labelOffset = baseSize + 3;

  return (
    <group position={[node.x, node.z, node.y]}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerEnter={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
          onPointerEnter();
        }}
        onPointerLeave={() => {
          document.body.style.cursor = 'default';
          onPointerLeave();
        }}
      >
        <sphereGeometry args={[baseSize, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.4}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>

      <Billboard position={[0, labelOffset, 0]}>
        <Text
          position={[0, 0, 0]}
          fontSize={titleFontSize}
          color={isDark ? '#ffffff' : '#1e293b'}
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.3}
          outlineColor={isDark ? '#000000' : '#ffffff'}
        >
          {node.data.title}
        </Text>
        {tags && tags.length > 0 && (
          <Text
            position={[0, titleFontSize + 1, 0]}
            fontSize={tagFontSize}
            color={isDark ? '#94a3b8' : '#64748b'}
            anchorX="center"
            anchorY="bottom"
          >
            {tags.slice(0, 3).join(' · ')}
          </Text>
        )}
      </Billboard>
    </group>
  );
}

interface PlanetLinkProps {
  source: LayoutNode3D;
  target: LayoutNode3D;
}

function PlanetLink({ source, target }: PlanetLinkProps) {
  const curveRef = useRef<THREE.QuadraticBezierCurve3 | null>(null);
  
  const points = useMemo(() => {
    const start: [number, number, number] = [source.x, source.z, source.y];
    const end: [number, number, number] = [target.x, target.z, target.y];
    const mid: [number, number, number] = [
      (source.x + target.x) / 2,
      (source.z + target.z) / 2 + 15,
      (source.y + target.y) / 2
    ];
    
    if (!curveRef.current) {
      curveRef.current = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(...start),
        new THREE.Vector3(...mid),
        new THREE.Vector3(...end)
      );
    } else {
      curveRef.current.v0.set(...start);
      curveRef.current.v1.set(...mid);
      curveRef.current.v2.set(...end);
    }
    return curveRef.current.getPoints(20).map(p => [p.x, p.y, p.z] as [number, number, number]);
  }, [source, target]);

  return (
    <Line
      points={points}
      color="#6366f1"
      lineWidth={1.5}
      transparent
      opacity={0.5}
    />
  );
}

function StarField() {
  return <Stars radius={500} depth={100} count={3000} factor={6} saturation={0} fade speed={0.5} />;
}

function Scene({ 
  layoutNodes, 
  layoutLinks,
  selectedNodeId,
  hoveredNodeId,
  onNodeClick,
  onNodeHover,
  colorScheme,
  isDark
}: { 
  layoutNodes: LayoutNode3D[];
  layoutLinks: LayoutLink3D[];
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  onNodeClick: (node: LayoutNode3D) => void;
  onNodeHover: (id: string | null) => void;
  colorScheme: ColorScheme;
  isDark: boolean;
}) {
  const controlsRef = useRef<any>(null);
  
  const nodeMap = useMemo(() => {
    const map = new Map<string, LayoutNode3D>();
    layoutNodes.forEach(n => map.set(n.id, n));
    return map;
  }, [layoutNodes]);

  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[200, 200, 200]} intensity={1.2} />
      <pointLight position={[-200, -100, -200]} intensity={0.6} color="#6366f1" />
      
      <StarField />
      
      {layoutLinks.map((link, index) => {
        const source = nodeMap.get(link.source);
        const target = nodeMap.get(link.target);
        if (!source || !target) return null;
        return (
          <PlanetLink 
            key={`${link.source}-${link.target}-${index}`} 
            source={source} 
            target={target} 
          />
        );
      })}
      
      {layoutNodes.map(node => (
        <PlanetNode
          key={node.id}
          node={node}
          layoutLinks={layoutLinks}
          isSelected={node.id === selectedNodeId}
          isHovered={node.id === hoveredNodeId}
          onClick={() => onNodeClick(node)}
          onPointerEnter={() => onNodeHover(node.id)}
          onPointerLeave={() => onNodeHover(null)}
          colorScheme={colorScheme}
          isDark={isDark}
        />
      ))}
      
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.05}
        minDistance={30}
        maxDistance={800}
        enablePan
        panSpeed={0.8}
        rotateSpeed={0.8}
        maxPolarAngle={Math.PI * 2}
        minPolarAngle={0}
      />

      <EffectComposer>
        <Bloom
          intensity={0.3}
          luminanceThreshold={0.6}
          luminanceSmoothing={0.9}
        />
      </EffectComposer>
    </>
  );
}

export const PlanetView: React.FC<PlanetViewProps> = ({
  nodes,
  edges,
  selectedNodeId,
  onNodeClick,
  width = 800,
  height = 600,
  colorScheme = 'default',
  coloringMode: _coloringMode
}) => {
  const { isDark } = useTheme();
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const layout = useMemo(() => {
    return create3DForceLayout(nodes, edges, {
      width,
      height,
      depth: height
    });
  }, [nodes, edges, width, height]);

  const handleNodeClick = useCallback((node: LayoutNode3D) => {
    onNodeClick(node.data);
  }, [onNodeClick]);

  const handleNodeHover = useCallback((id: string | null) => {
    setHoveredNodeId(id);
  }, []);

  return (
    <div 
      style={{ 
        width: '100%', 
        height: '100%',
        background: isDark 
          ? 'linear-gradient(135deg, #050510 0%, #0a0a1a 50%, #0f0f2a 100%)'
          : 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 50%, #a5b4fc 100%)',
        borderRadius: '8px',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 0,
      }}
    >
      <Canvas
        camera={{ position: [200, 150, 200], fov: 60, near: 0.1, far: 3000 }}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={null}>
          <Scene
            layoutNodes={layout.nodes}
            layoutLinks={layout.links}
            selectedNodeId={selectedNodeId}
            hoveredNodeId={hoveredNodeId}
            onNodeClick={handleNodeClick}
            onNodeHover={handleNodeHover}
            colorScheme={colorScheme}
            isDark={isDark}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};
