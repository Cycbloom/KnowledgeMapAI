import React, { memo, useMemo } from 'react';
import { Template, TemplateNode } from '../types';
import { ChevronRight } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

interface TemplatePreviewProps {
  template: Template;
}

const getNodeLevelColor = (level: string, isDark: boolean) => {
  if (isDark) {
    switch (level) {
      case 'root':
        return 'bg-blue-600 text-white';
      case 'core':
        return 'bg-indigo-600 text-white';
      case 'sub':
        return 'bg-purple-600 text-white';
      default:
        return 'bg-slate-700 text-slate-300';
    }
  }
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
  isDark: boolean;
}> = memo(({ node, allNodes, depth, isDark }) => {
  const children = useMemo(
    () => allNodes.filter(n => n.parentId === node.id),
    [allNodes, node.id]
  );

  return (
    <div className="flex flex-col gap-1">
      <div 
        className={`flex items-center gap-2 py-1.5 px-3 rounded-lg transition-all ${
          isDark ? 'hover:bg-slate-700' : 'hover:bg-gray-50'
        }`}
        style={{ marginLeft: `${depth * 20}px` }}
      >
        {depth > 0 && <ChevronRight size={14} className={`${isDark ? 'text-slate-500' : 'text-gray-400'} flex-shrink-0`} />}
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${getNodeLevelColor(node.level, isDark)}`}>
          {node.level}
        </span>
        <span className={`text-sm font-medium truncate flex-1 ${
          isDark ? 'text-slate-200' : 'text-gray-800'
        }`}>{node.title}</span>
        {node.aiPrompt && (
          <span className="text-xs text-blue-500 flex-shrink-0">AI</span>
        )}
      </div>
      {children.map(child => (
        <TreeNode key={child.id} node={child} allNodes={allNodes} depth={depth + 1} isDark={isDark} />
      ))}
    </div>
  );
});

TreeNode.displayName = 'TreeNode';

const TemplatePreviewComponent: React.FC<TemplatePreviewProps> = ({ template }) => {
  const { isDark } = useTheme();
  const nodes = template.nodes || [];
  
  const rootNode = useMemo(
    () => nodes.find(n => !n.parentId),
    [nodes]
  );

  if (!rootNode || nodes.length === 0) {
    return (
      <div className={`p-6 text-center ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
        暂无节点结构
      </div>
    );
  }

  return (
    <div className={`p-4 rounded-xl border max-h-80 overflow-y-auto ${
      isDark 
        ? 'bg-slate-800 border-slate-700' 
        : 'bg-gray-50 border-gray-200'
    }`}>
      <div className="flex flex-col gap-1">
        <TreeNode node={rootNode} allNodes={nodes} depth={0} isDark={isDark} />
      </div>
    </div>
  );
};

export const TemplatePreview = memo(TemplatePreviewComponent);
