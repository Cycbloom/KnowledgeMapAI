import React, { useState } from 'react';
import { LayoutGrid, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTheme } from "../../../hooks";
import { frontendEventBus } from "../../../services/timer/FrontendEventBus";
import { api } from '../../../services/api';
import { useQueryClient } from '@tanstack/react-query';
import type { Node, Edge } from '../../../types';

interface LayoutOrganizerProps {
  graphId: string;
  nodes: Node[];
  edges: Edge[];
  onLayoutUpdate: (positions: Map<string, { x: number; y: number }>) => void;
}

export const LayoutOrganizer: React.FC<LayoutOrganizerProps> = ({
  graphId,
  nodes,
  edges,
  onLayoutUpdate
}) => {
  const { isDark: _isDark } = useTheme();
  const queryClient = useQueryClient();
  
  const [isApplying, setIsApplying] = useState(false);

  const organizeLayout = async () => {
    if (!nodes || nodes.length === 0) {
      frontendEventBus.publish("message_show", { type: 'warning', content: '没有节点可以调整' });
      return;
    }

    setIsApplying(true);
    
    try {
      const positions = calculateOrganizedPositions(nodes, edges);
      
      const positionsArray = Array.from(positions.entries()).map(([id, pos]) => ({
        id,
        x_position: pos.x,
        y_position: pos.y
      }));

      await api.nodes.batchUpdatePositions(positionsArray);
      
      onLayoutUpdate(positions);
      
      queryClient.invalidateQueries({ queryKey: ['graphData', graphId] });
      
      frontendEventBus.publish("message_show", { type: 'success', content: '节点位置已整理' });
    } catch (error) {
      console.error('Layout organize error:', error);
      frontendEventBus.publish("message_show", { type: 'error', content: '整理节点位置失败' });
    } finally {
      setIsApplying(false);
    }
  };

  const calculateOrganizedPositions = (
    nodes: Node[], 
    edges: Edge[]
  ): Map<string, { x: number; y: number }> => {
    const positions = new Map<string, { x: number; y: number }>();
    
    const rootNode = nodes.find(n => n.level === 'root') || nodes[0];
    
    const childrenMap = new Map<string, string[]>();
    const parentMap = new Map<string, string>();
    nodes.forEach(n => childrenMap.set(n.id, []));
    edges.forEach(e => {
      const children = childrenMap.get(e.source_knowledge_point_id);
      if (children) {
        children.push(e.target_knowledge_point_id);
      }
      parentMap.set(e.target_knowledge_point_id, e.source_knowledge_point_id);
    });

    const nodeLevelMap = new Map<string, number>();
    const levelNodesMap = new Map<number, string[]>();
    
    const calculateLevel = (nodeId: string, level: number): void => {
      if (nodeLevelMap.has(nodeId)) return;
      nodeLevelMap.set(nodeId, level);
      
      if (!levelNodesMap.has(level)) {
        levelNodesMap.set(level, []);
      }
      levelNodesMap.get(level)!.push(nodeId);
      
      const children = childrenMap.get(nodeId) || [];
      children.forEach(childId => calculateLevel(childId, level + 1));
    };
    
    calculateLevel(rootNode.id, 0);
    
    nodes.forEach(node => {
      if (!nodeLevelMap.has(node.id)) {
        const maxLevel = Math.max(...Array.from(levelNodesMap.keys()), 0);
        nodeLevelMap.set(node.id, maxLevel + 1);
        if (!levelNodesMap.has(maxLevel + 1)) {
          levelNodesMap.set(maxLevel + 1, []);
        }
        levelNodesMap.get(maxLevel + 1)!.push(node.id);
      }
    });

    const levelGap = 200;
    const minNodeGap = 180;
    
    const maxLevel = Math.max(...Array.from(levelNodesMap.keys()));
    
    for (let level = 0; level <= maxLevel; level++) {
      const levelNodes = levelNodesMap.get(level) || [];
      if (levelNodes.length === 0) continue;
      
      const y = level * levelGap;
      
      let totalWidth = 0;
      const nodeWidths = new Map<string, number>();
      
      levelNodes.forEach(nodeId => {
        const children = childrenMap.get(nodeId) || [];
        const subtreeWidth = Math.max(minNodeGap, children.length * minNodeGap);
        nodeWidths.set(nodeId, subtreeWidth);
        totalWidth += subtreeWidth;
      });
      
      let currentX = -totalWidth / 2;
      
      levelNodes.forEach(nodeId => {
        const nodeWidth = nodeWidths.get(nodeId) || minNodeGap;
        const x = currentX + nodeWidth / 2;
        positions.set(nodeId, { x, y });
        currentX += nodeWidth;
      });
    }

    for (let iter = 0; iter < 10; iter++) {
      const displacements = new Map<string, { dx: number; dy: number }>();
      nodes.forEach(n => displacements.set(n.id, { dx: 0, dy: 0 }));
      
      positions.forEach((pos1, id1) => {
        positions.forEach((pos2, id2) => {
          if (id1 === id2) return;
          
          const dx = pos1.x - pos2.x;
          const dy = pos1.y - pos2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < minNodeGap && dist > 0) {
            const force = (minNodeGap - dist) / 2;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            
            const d1 = displacements.get(id1)!;
            displacements.set(id1, { dx: d1.dx + fx, dy: d1.dy + fy });
          }
        });
      });
      
      displacements.forEach((d, id) => {
        const pos = positions.get(id);
        if (pos) {
          positions.set(id, {
            x: pos.x + d.dx * 0.5,
            y: pos.y + d.dy * 0.5
          });
        }
      });
    }

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    positions.forEach(pos => {
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x);
      minY = Math.min(minY, pos.y);
      maxY = Math.max(maxY, pos.y);
    });
    
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    positions.forEach((pos, id) => {
      positions.set(id, {
        x: pos.x - centerX,
        y: pos.y - centerY
      });
    });
    
    return positions;
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={organizeLayout}
      disabled={isApplying}
      className={`p-2 bg-white dark:bg-slate-800 rounded shadow-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition-colors ${
        isApplying ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      }`}
      title="整理布局"
    >
      {isApplying ? (
        <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
      ) : (
        <LayoutGrid className="w-5 h-5" />
      )}
    </motion.button>
  );
};
