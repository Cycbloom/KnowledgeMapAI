import React from 'react';
import { Network, LayoutList } from 'lucide-react';
import { Node, Edge } from '../../types';
import { GraphOutline } from './GraphOutline';

interface MobileGraphListProps {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId?: string;
  selectedNodeIds: Set<string>;
  onNodeClick: (node: Node) => void;
  onSelectionChange: (ids: Set<string>) => void;
  onBatchAction: (action: string) => void;
  stats: {
    nodeCount: number;
    edgeCount: number;
    masteredCount: number;
    lockedCount: number;
    dueTodayCount: number;
  };
}

export const MobileGraphList: React.FC<MobileGraphListProps> = ({
  nodes,
  edges,
  selectedNodeId,
  selectedNodeIds,
  onNodeClick,
  onSelectionChange,
  onBatchAction,
  stats
}) => {
  return (
    <div className="h-full w-full bg-white relative pt-14">
      <GraphOutline 
        nodes={nodes} 
        edges={edges}
        onNodeClick={onNodeClick}
        selectedNodeId={selectedNodeId}
        selectedNodeIds={selectedNodeIds}
        onSelectionChange={onSelectionChange}
        onBatchAction={onBatchAction}
        stats={stats}
        className="h-full border-none"
      />
    </div>
  );
};

interface MobileViewToggleProps {
  viewMode: 'list' | '3d';
  onToggle: () => void;
}

export const MobileViewToggle: React.FC<MobileViewToggleProps> = ({
  viewMode,
  onToggle
}) => {
  return (
    <div className="absolute top-20 left-4 z-10 flex flex-col gap-2">
      <button 
        onClick={onToggle}
        className="bg-white p-2 rounded-lg shadow text-gray-700"
      >
        {viewMode === 'list' ? <Network size={20} /> : <LayoutList size={20} />}
      </button>
    </div>
  );
};
