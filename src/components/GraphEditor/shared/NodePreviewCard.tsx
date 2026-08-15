import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Node, Edge, NodeStatus } from '../../../types';
import { getLearningStatus, getStatusColors } from '../../../config/learningStatusColors';
import { getLevel, getLevelLabel } from '../../../utils/graph/graphUtils';
import { formatDate } from '../../../utils/formatters';
import { useTheme } from "../../../hooks";
import { 
  Check, 
  Lock, 
  Clock, 
  ChevronRight, 
  ChevronLeft,
  BookOpen,
  Tag
} from 'lucide-react';

interface NodePreviewCardProps {
  node: Node;
  nodes: Node[];
  edges: Edge[];
  nodeStatus?: Record<string, NodeStatus>;
  position: { x: number; y: number };
  onNavigateToNode?: (node: Node) => void;
  onMarkMastered?: (nodeId: string) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

const NodePreviewCardComponent: React.FC<NodePreviewCardProps> = ({
  node,
  nodes,
  edges,
  nodeStatus,
  position,
  onNavigateToNode,
  onMarkMastered,
  onMouseEnter,
  onMouseLeave
}) => {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  
  const status = getLearningStatus(nodeStatus?.[node.id]);
  const colors = getStatusColors(status, isDark);
  const level = getLevel(node, edges);
  const levelLabel = getLevelLabel(level);
  
  const tags = useMemo(() => {
    return node.tags || node.properties?.tags || [];
  }, [node]);
  
  const parentNode = useMemo(() => {
    const parentEdge = edges.find(e => e.target_knowledge_point_id === node.id);
    if (!parentEdge) return null;
    return nodes.find(n => n.id === parentEdge.source_knowledge_point_id);
  }, [node, edges, nodes]);
  
  const childNodes = useMemo(() => {
    const childEdges = edges.filter(e => e.source_knowledge_point_id === node.id);
    // 用 Set 替代 childIds.includes 的线性扫描（原为 O(nodes*childEdges)）
    const childIdSet = new Set(childEdges.map(e => e.target_knowledge_point_id));
    return nodes.filter(n => childIdSet.has(n.id));
  }, [node, edges, nodes]);
  
  const contentPreview = useMemo(() => {
    if (node.summary) return node.summary;
    if (!node.content) return null;
    const text = node.content.replace(/[#*`[\]]/g, '').slice(0, 150);
    return text.length < node.content.length ? `${text}...` : text;
  }, [node.summary, node.content]);
  
  const isMastered = nodeStatus?.[node.id]?.mastered;
  const isLocked = nodeStatus?.[node.id]?.locked;
  const reviewCount = nodeStatus?.[node.id]?.review_count || 0;
  const nextReview = nodeStatus?.[node.id]?.next_review;
  
  const cardStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(position.x + 20, window.innerWidth - 360),
    top: Math.min(position.y - 10, window.innerHeight - 400),
    zIndex: 1000,
    minWidth: 280,
    maxWidth: 340
  };

  return (
    <div 
      style={cardStyle}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`
        rounded-xl shadow-2xl border overflow-hidden
        animate-in fade-in zoom-in-95 duration-150
        ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}
      `}
    >
      <div 
        className="px-4 py-3 border-b"
        style={{ 
          background: isDark 
            ? `linear-gradient(135deg, ${colors.primary}20, ${colors.secondary}20)` 
            : `linear-gradient(135deg, ${colors.primary}10, ${colors.secondary}10)`,
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className={`font-bold text-base truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {node.title}
            </h4>
            <div className="flex items-center gap-2 mt-1">
              <span 
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ 
                  backgroundColor: `${colors.primary}20`,
                  color: colors.primary
                }}
              >
                {levelLabel}
              </span>
              {isMastered && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium flex items-center gap-1">
                  <Check size={10} /> {t('graphEditor.nodePreviewCard.mastered')}
                </span>
              )}
              {isLocked && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium flex items-center gap-1">
                  <Lock size={10} /> {t('graphEditor.nodePreviewCard.locked')}
                </span>
              )}
            </div>
          </div>
          <div 
            className="w-3 h-3 rounded-full shrink-0 mt-1"
            style={{ backgroundColor: colors.primary }}
          />
        </div>
      </div>
      
      <div className="px-4 py-3 space-y-3">
        {contentPreview && (
          <p className={`text-sm leading-relaxed line-clamp-3 ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>
            {contentPreview}
          </p>
        )}
        
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.slice(0, 4).map((tag: string, idx: number) => (
              <span 
                key={idx}
                className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
                  isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-600'
                }`}
              >
                <Tag size={10} />
                {tag}
              </span>
            ))}
            {tags.length > 4 && (
              <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                +{tags.length - 4}
              </span>
            )}
          </div>
        )}
        
        <div className={`grid grid-cols-2 gap-2 text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
          <div className="flex items-center gap-1.5">
            <BookOpen size={12} />
            <span>{t('graphEditor.nodePreviewCard.reviewCount', { count: reviewCount })}</span>
          </div>
          {nextReview && (
            <div className="flex items-center gap-1.5">
              <Clock size={12} />
              <span>{formatDate(nextReview, 'short')}</span>
            </div>
          )}
        </div>
        
        {(parentNode || childNodes.length > 0) && (
          <div className={`pt-2 border-t space-y-1.5 ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
            {parentNode && (
              <button
                onClick={() => onNavigateToNode?.(parentNode)}
                className={`
                  w-full text-left px-2 py-1.5 rounded-lg text-xs
                  flex items-center gap-2 transition-colors
                  ${isDark 
                    ? 'hover:bg-slate-700 text-slate-300' 
                    : 'hover:bg-gray-50 text-gray-600'}
                `}
              >
                <ChevronLeft size={12} className="shrink-0" />
                <span className="truncate">{parentNode.title}</span>
              </button>
            )}
            {childNodes.length > 0 && (
              <div className="max-h-24 overflow-y-auto space-y-1">
                {childNodes.slice(0, 3).map(child => (
                  <button
                    key={child.id}
                    onClick={() => onNavigateToNode?.(child)}
                    className={`
                      w-full text-left px-2 py-1.5 rounded-lg text-xs
                      flex items-center justify-between transition-colors
                      ${isDark 
                        ? 'hover:bg-slate-700 text-slate-300' 
                        : 'hover:bg-gray-50 text-gray-600'}
                    `}
                  >
                    <span className="truncate">{child.title}</span>
                    <ChevronRight size={12} className="shrink-0" />
                  </button>
                ))}
                {childNodes.length > 3 && (
                  <div className={`text-xs text-center py-1 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                    {t('graphEditor.nodePreviewCard.childCountMore', { count: childNodes.length - 3 })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      
      <div 
        className={`
          px-4 py-2 border-t flex items-center justify-between
          ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-50 border-gray-100'}
        `}
      >
        <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
          {t('graphEditor.nodePreviewCard.clickToViewDetail')}
        </span>
        {!isMastered && !isLocked && onMarkMastered && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMarkMastered(node.id);
            }}
            className="text-xs px-2 py-1 rounded-md bg-green-500 text-white hover:bg-green-600 transition-colors"
          >
            {t('graphEditor.nodePreviewCard.markAsMastered')}
          </button>
        )}
      </div>
    </div>
  );
};

function areEqual(prev: NodePreviewCardProps, next: NodePreviewCardProps): boolean {
  // 引用比较：父组件应保持引用稳定（useMemo/useCallback）
  if (
    prev.node !== next.node ||
    prev.nodes !== next.nodes ||
    prev.edges !== next.edges ||
    prev.nodeStatus !== next.nodeStatus ||
    prev.onNavigateToNode !== next.onNavigateToNode ||
    prev.onMarkMastered !== next.onMarkMastered ||
    prev.onMouseEnter !== next.onMouseEnter ||
    prev.onMouseLeave !== next.onMouseLeave
  ) {
    return false;
  }
  // position 每次可能为新对象，按值比较
  return prev.position.x === next.position.x && prev.position.y === next.position.y;
}

export const NodePreviewCard = React.memo(NodePreviewCardComponent, areEqual);
