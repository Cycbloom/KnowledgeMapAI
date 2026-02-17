import React, { memo, useMemo } from 'react';
import { Template, TemplateNode } from '../types';
import { ChevronRight } from 'lucide-react';

interface TemplatePreviewProps {
  template: Template;
}

const getNodeLevelColor = (level: string) => {
  switch (level) {
    case 'root':
      return 'bg-blue-500 text-white';
    case 'core':
      return 'bg-indigo-500 text-white';
    case 'sub':
      return 'bg-purple-500 text-white';
    default:
      return 'bg-gray-200 text-gray-700';
  }
};

const TreeNode: React.FC<{
  node: TemplateNode;
  allNodes: TemplateNode[];
  depth: number;
}> = memo(({ node, allNodes, depth }) => {
  const children = useMemo(
    () => allNodes.filter(n => n.parentId === node.id),
    [allNodes, node.id]
  );

  return (
    <div className="flex flex-col gap-1">
      <div 
        className="flex items-center gap-2 py-1.5 px-3 rounded-lg transition-all hover:bg-gray-50"
        style={{ marginLeft: `${depth * 20}px` }}
      >
        {depth > 0 && <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />}
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${getNodeLevelColor(node.level)}`}>
          {node.level}
        </span>
        <span className="text-sm font-medium text-gray-800 truncate flex-1">{node.title}</span>
        {node.aiPrompt && (
          <span className="text-xs text-blue-500 flex-shrink-0">AI</span>
        )}
      </div>
      {children.map(child => (
        <TreeNode key={child.id} node={child} allNodes={allNodes} depth={depth + 1} />
      ))}
    </div>
  );
});

TreeNode.displayName = 'TreeNode';

const TemplatePreviewComponent: React.FC<TemplatePreviewProps> = ({ template }) => {
  const rootNode = useMemo(
    () => template.nodes.find(n => !n.parentId),
    [template.nodes]
  );

  if (!rootNode) {
    return (
      <div className="p-6 text-center text-gray-500">
        暂无节点结构
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 max-h-80 overflow-y-auto">
      <div className="flex flex-col gap-1">
        <TreeNode node={rootNode} allNodes={template.nodes} depth={0} />
      </div>
    </div>
  );
};

export const TemplatePreview = memo(TemplatePreviewComponent);