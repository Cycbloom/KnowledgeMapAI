import React from 'react';
import type { Node, Edge } from '../../../types';
import { getLearningStatus, getStatusColors } from '../../../config/learningStatusColors';
import { getLevel, getLevelLabel } from '../../../lib/graphUtils';
import { useTheme } from "../../../hooks";
import { useTranslation } from 'react-i18next';
import { 
  Check, 
  Lock, 
  ChevronRight, 
  ChevronLeft,
  BookOpen,
  Tag,
  X,
  Maximize2
} from 'lucide-react';

interface MobileNodePreviewCardProps {
  node: Node;
  nodes: Node[];
  edges: Edge[];
  nodeStatus?: Record<string, any>;
  onNavigateToNode?: (node: Node) => void;
  onMarkMastered?: (nodeId: string) => void;
  onOpenDetail?: () => void;
  onClose?: () => void;
}

export const MobileNodePreviewCard: React.FC<MobileNodePreviewCardProps> = ({
  node,
  nodes,
  edges,
  nodeStatus,
  onNavigateToNode,
  onMarkMastered,
  onOpenDetail,
  onClose
}) => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  
  const status = getLearningStatus(nodeStatus?.[node.id]);
  const colors = getStatusColors(status, isDark);
  const level = getLevel(node, edges);
  const levelLabel = getLevelLabel(level);
  
  const tags = React.useMemo(() => {
    return node.tags || node.properties?.tags || [];
  }, [node]);
  
  const parentNode = React.useMemo(() => {
    const parentEdge = edges.find(e => e.target_knowledge_point_id === node.id);
    if (!parentEdge) return null;
    return nodes.find(n => n.id === parentEdge.source_knowledge_point_id);
  }, [node, edges, nodes]);
  
  const childNodes = React.useMemo(() => {
    const childEdges = edges.filter(e => e.source_knowledge_point_id === node.id);
    const childIds = childEdges.map(e => e.target_knowledge_point_id);
    return nodes.filter(n => childIds.includes(n.id));
  }, [node, edges, nodes]);
  
  const contentPreview = React.useMemo(() => {
    if (!node.content) return null;
    const text = node.content.replace(/[#*`[\]]/g, '').slice(0, 120);
    return text.length < node.content.length ? `${text}...` : text;
  }, [node.content]);
  
  const isMastered = nodeStatus?.[node.id]?.mastered;
  const isLocked = nodeStatus?.[node.id]?.locked;
  const reviewCount = nodeStatus?.[node.id]?.review_count || 0;

  return (
    <div 
      className={`
        fixed bottom-14 left-2 right-2 z-40
        rounded-t-2xl shadow-2xl border overflow-hidden
        ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}
      `}
    >
      <div className="flex justify-center pt-2 pb-1">
        <div className={`w-10 h-1 rounded-full ${isDark ? 'bg-slate-600' : 'bg-gray-300'}`} />
      </div>
      
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
            <div className="flex items-center gap-2 mt-1 flex-wrap">
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
                  <Check size={10} /> {t("nodeDetail.mastered")}
                </span>
              )}
              {isLocked && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium flex items-center gap-1">
                  <Lock size={10} /> {t("nodeDetail.locked")}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {onOpenDetail && (
              <button
                onClick={onOpenDetail}
                className={`p-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-colors ${
                  isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-gray-100 text-gray-500'
                }`}
                title={t("nodeDetail.viewDetails")}
                aria-label={t("nodeDetail.viewDetails")}
              >
                <Maximize2 size={22} />
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className={`p-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-colors ${
                  isDark ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-gray-100 text-gray-500'
                }`}
                title={t("nodeDetail.close")}
                aria-label={t("nodeDetail.close")}
              >
                <X size={22} />
              </button>
            )}
          </div>
        </div>
      </div>
      
      <div className="px-4 py-3 space-y-3 max-h-[40vh] overflow-y-auto">
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
            <span>{t("nodeDetail.reviewCount", { count: reviewCount })}</span>
          </div>
        </div>
        
        {(parentNode || childNodes.length > 0) && (
          <div className={`pt-2 border-t space-y-1.5 ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
            {parentNode && (
              <button
                onClick={() => onNavigateToNode?.(parentNode)}
                className={`
                  w-full text-left px-3 py-3 min-h-[48px] rounded-xl text-sm
                  flex items-center gap-2 transition-colors
                  ${isDark 
                    ? 'hover:bg-slate-700 active:bg-slate-600 text-slate-300' 
                    : 'hover:bg-gray-50 active:bg-gray-100 text-gray-600'}
                `}
                aria-label={t("nodeDetail.viewParentNode", { title: parentNode.title })}
              >
                <ChevronLeft size={16} className="shrink-0" />
                <span className="truncate font-medium">{parentNode.title}</span>
              </button>
            )}
            {childNodes.length > 0 && (
              <div className="max-h-32 overflow-y-auto space-y-1">
                {childNodes.slice(0, 3).map(child => (
                  <button
                    key={child.id}
                    onClick={() => onNavigateToNode?.(child)}
                    className={`
                      w-full text-left px-3 py-3 min-h-[48px] rounded-xl text-sm
                      flex items-center justify-between transition-colors
                      ${isDark 
                        ? 'hover:bg-slate-700 active:bg-slate-600 text-slate-300' 
                        : 'hover:bg-gray-50 active:bg-gray-100 text-gray-600'}
                    `}
                    aria-label={t("nodeDetail.viewChildNode", { title: child.title })}
                  >
                    <span className="truncate font-medium">{child.title}</span>
                    <ChevronRight size={16} className="shrink-0" />
                  </button>
                ))}
                {childNodes.length > 3 && (
                  <div className={`text-xs text-center py-2 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                    {t("nodeDetail.moreChildren", { count: childNodes.length - 3 })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      
      <div 
        className={`
          px-4 py-2 border-t flex items-center justify-between gap-2
          ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-gray-50 border-gray-100'}
        `}
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {!isMastered && !isLocked && onMarkMastered && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMarkMastered(node.id);
            }}
            className="flex-1 text-sm px-4 py-3 min-h-[44px] rounded-xl bg-green-500 text-white hover:bg-green-600 active:bg-green-700 transition-colors font-medium"
            aria-label={t("nodeDetail.markMastered")}
          >
            {t("nodeDetail.markMastered")}
          </button>
        )}
        {onOpenDetail && (
          <button
            onClick={onOpenDetail}
            className={`flex-1 text-sm px-4 py-3 min-h-[44px] rounded-xl font-medium transition-colors ${
              isDark 
                ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800' 
                : 'bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700'
            }`}
            aria-label={t("nodeDetail.viewDetails")}
          >
            {t("nodeDetail.viewDetails")}
          </button>
        )}
      </div>
    </div>
  );
};
