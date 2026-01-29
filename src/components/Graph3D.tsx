import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Line } from '@react-three/drei';
import * as THREE from 'three';
import { Node, Edge } from '../types';

interface Graph3DProps {
  nodes: Node[];
  edges: Edge[];
  onNodeClick: (node: Node) => void;
}

const NodeMesh = ({ node, onClick }: { node: Node; onClick: (node: Node) => void }) => {
  // Simple random position if 0,0 (should be persisted in real app)
  // For demo, we assume x_position/y_position are used as x/z, and y is 0.
  // Or we map them to 3D space.
  const position = new THREE.Vector3(node.x_position / 10, 0, node.y_position / 10);
  
  return (
    <group position={position} onClick={(e) => { e.stopPropagation(); onClick(node); }}>
      <mesh>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial color={node.color || "#3B82F6"} />
      </mesh>
      <Text position={[0, 0.8, 0]} fontSize={0.3} color="white" anchorX="center" anchorY="middle">
        {node.title}
      </Text>
    </group>
  );
};

const EdgeLine = ({ edge, nodes }: { edge: Edge; nodes: Node[] }) => {
  const source = nodes.find(n => n.id === edge.source_node_id);
  const target = nodes.find(n => n.id === edge.target_node_id);

  if (!source || !target) return null;

  const start = new THREE.Vector3(source.x_position / 10, 0, source.y_position / 10);
  const end = new THREE.Vector3(target.x_position / 10, 0, target.y_position / 10);

  // Line component from drei takes points prop
  return (
    <Line
      points={[start, end]}
      color="#999"
      lineWidth={1}
    />
  );
};

export const Graph3D: React.FC<Graph3DProps> = ({ nodes, edges, onNodeClick }) => {
  return (
    <div className="w-full h-full bg-slate-900">
      <Canvas camera={{ position: [0, 10, 10], fov: 60 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <OrbitControls />
        <gridHelper args={[100, 100]} />
        
        {nodes.map(node => (
          <NodeMesh key={node.id} node={node} onClick={onNodeClick} />
        ))}
        
        {edges.map(edge => (
          <EdgeLine key={edge.id} edge={edge} nodes={nodes} />
        ))}
      </Canvas>
    </div>
  );
};
