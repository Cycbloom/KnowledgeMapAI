import React from 'react';
import { Node, Edge, BranchSuggestion } from '../../types';
import { levelLabels } from '../../config/graphConfig';
import { getLearningStatus, getStatusColors } from '../../config/learningStatusColors';
import { getLevel } from '../../lib/graphUtils';
import { preprocessMarkdown } from '../../utils/markdownUtils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { 
  X, ArrowLeft, Wand2, Edit3, Trash2, Navigation, 
  GraduationCap, Sparkles, Check, Lock, Loader2, GitBranch 
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

interface NodeDetailSidebarProps {
  node: Node;
  edges: Edge[];
  prevSidebarMode: 'none' | 'create' | 'edit' | 'outline' | 'detail';
  nodeStatus?: Record<string, any>;
  onClose: () => void;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStartLevelTest: () => void;
  onStartLearningMode: () => void;
  onGenerateCards: () => void;
  onFetchRelatedNodes: () => void;
  
  // AI/Related Nodes State
  showRelatedSection: boolean;
  isRelatedLoading: boolean;
  relatedNodes: Node[];
  onRelatedNodeClick: (node: Node) => void;

  // Branch Switching
  onUpdateNode?: (nodeId: string, updates: Partial<Node>) => void;
  isExplorationMode?: boolean;
}

export const NodeDetailSidebar: React.FC<NodeDetailSidebarProps> = ({
  node,
  edges,
  prevSidebarMode,
  nodeStatus,
  onClose,
  onBack,
  onEdit,
  onDelete,
  onStartLevelTest,
  onStartLearningMode,
  onGenerateCards,
  onFetchRelatedNodes,
  showRelatedSection,
  isRelatedLoading,
  relatedNodes,
  onRelatedNodeClick,
  onUpdateNode,
  isExplorationMode = false
}) => {
  const { isDark } = useTheme();
  const isMastered = nodeStatus && nodeStatus[node.id]?.mastered;
  const isLocked = nodeStatus && nodeStatus[node.id]?.locked;
  const status = getLearningStatus(nodeStatus?.[node.id]);
  const colors = getStatusColors(status, isDark);

  const isAccepted = node.is_accepted !== false;

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-2">
          {prevSidebarMode === 'outline' && (
            <button 
              onClick={onBack}
              className="mr-1 p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
              title="返回大纲"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.primary }}></div>
          <h3 className="text-lg font-bold text-gray-800">节点详情</h3>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 p-1 hover:bg-gray-100 rounded-full transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section>
          <h1 className="text-xl font-bold text-gray-900 leading-tight mb-2">{node.title}</h1>
          <div className="flex items-center space-x-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border`} style={{ 
              borderColor: colors.primary,
              color: colors.text,
              backgroundColor: colors.background
            }}>
              {levelLabels[getLevel(node, edges)] || '未知层级'}
            </span>
            {isMastered && (
              <span className="flex items-center text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                <Check size={12} className="mr-1" /> 已掌握
              </span>
            )}
            {isLocked && (
              <span className="flex items-center text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                <Lock size={12} className="mr-1" /> 未解锁
              </span>
            )}
          </div>
        </section>

        <section className="prose prose-sm max-w-none text-gray-600 bg-gray-50 p-4 rounded-xl border border-gray-100">
          <ReactMarkdown 
            remarkPlugins={[remarkGfm, remarkMath]} 
            rehypePlugins={[rehypeKatex]}
            components={{
              img: ({node, ...props}) => <img {...props} className="rounded-lg max-w-full h-auto" loading="lazy" />,
              a: ({node, ...props}) => <a {...props} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" />
            }}
          >
            {preprocessMarkdown(node.content || '*暂无内容*')}
          </ReactMarkdown>
        </section>

        {/* Learning Actions */}
        <section className="grid grid-cols-2 gap-3">
          <button 
            onClick={onStartLearningMode}
            className="col-span-2 flex items-center justify-center p-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
          >
            <Navigation size={18} className="mr-2" />
            <span className="font-bold">开启沉浸学习</span>
          </button>
          
          <button 
            onClick={onStartLevelTest}
            className="flex items-center justify-center p-3 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <GraduationCap size={18} className="mr-2 text-indigo-500" />
            <span className="font-medium">关卡测试</span>
          </button>
          
          <button 
            onClick={onGenerateCards}
            className="flex items-center justify-center p-3 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <Sparkles size={18} className="mr-2 text-amber-500" />
            <span className="font-medium">生成卡片</span>
          </button>
        </section>

        {/* AI Analysis Section */}
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-4 border border-purple-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-purple-900 flex items-center">
              <Wand2 size={16} className="mr-2" />
              AI 深度探索
            </h3>
            <span className="text-[10px] bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full">Beta</span>
          </div>
          <p className="text-xs text-purple-700 mb-4 leading-relaxed">
            使用 AI 分析当前节点，发现潜在的关联知识点或生成深度思考问题。
          </p>
          <div className="flex space-x-2">
            <button className="flex-1 bg-white text-purple-700 text-xs font-bold py-2 rounded-lg border border-purple-200 shadow-sm hover:bg-purple-50 transition-colors">
              深度解析
            </button>
            <button className="flex-1 bg-white text-purple-700 text-xs font-bold py-2 rounded-lg border border-purple-200 shadow-sm hover:bg-purple-50 transition-colors">
              生成测验
            </button>
            <button className="flex-1 bg-white text-purple-700 text-xs font-bold py-2 rounded-lg border border-purple-200 shadow-sm hover:bg-purple-50 transition-colors">
              后台生成
            </button>
          </div>
        </div>
        
        {/* Related Nodes Section */}
        <div className="mt-4 pt-4 border-t border-purple-200">
           <div className="flex justify-between items-center mb-2">
             <h5 className="text-xs font-bold text-purple-700">🔗 语义相关节点</h5>
             {!showRelatedSection && (
               <button 
                 onClick={onFetchRelatedNodes}
                 className="text-[10px] bg-purple-100 text-purple-700 px-2 py-1 rounded hover:bg-purple-200 transition-colors"
               >
                 加载相关
               </button>
             )}
           </div>
           
           {showRelatedSection && (
             <div className="bg-white/50 rounded-lg p-2 min-h-[60px]">
               {isRelatedLoading ? (
                 <div className="flex justify-center py-2">
                   <Loader2 className="animate-spin text-purple-400" size={16} />
                 </div>
               ) : relatedNodes.length > 0 ? (
                 <div className="flex flex-wrap gap-2">
                   {relatedNodes.map(rNode => (
                     <button
                       key={rNode.id}
                       onClick={() => onRelatedNodeClick(rNode)}
                       className="text-xs bg-white border border-purple-100 text-purple-600 px-2 py-1 rounded-md shadow-sm hover:bg-purple-50 transition-colors truncate max-w-full"
                     >
                       {rNode.title}
                     </button>
                   ))}
                 </div>
               ) : (
                 <p className="text-xs text-gray-400 text-center py-2">暂无相关节点</p>
               )}
             </div>
           )}
        </div>

        {/* Branch Status Section */}
        {isExplorationMode && (
          <div className="mt-4 pt-4 border-t border-blue-200">
            <div className="flex justify-between items-center mb-2">
              <h5 className="text-xs font-bold text-blue-700 flex items-center">
                <GitBranch size={14} className="mr-1" />
                分支状态
              </h5>
            </div>
            <div className="bg-white/50 rounded-lg p-3 border border-gray-200">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="text-sm font-bold text-gray-700 mb-1">
                    {isAccepted ? '已选择' : '未选择'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {isAccepted ? '此分支已被选中，显示为圆形+实线' : '此分支未被选中，显示为方形+虚线'}
                  </div>
                </div>
                {onUpdateNode && (
                  <button
                    onClick={() => onUpdateNode(node.id, { is_accepted: !isAccepted })}
                    className={`px-4 py-2 rounded-lg font-bold transition-colors whitespace-nowrap ${
                      isAccepted 
                        ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' 
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                  >
                    {isAccepted ? '取消选择' : '选择此分支'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-100 flex items-center space-x-3 bg-white sticky bottom-0 z-10">
        <button
          onClick={onEdit}
          className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl hover:bg-blue-700 flex items-center justify-center font-bold shadow-lg shadow-blue-100 transition-all active:scale-95"
        >
          <Edit3 size={18} className="mr-2" />
          编辑节点
        </button>
        <button
          onClick={onDelete}
          className="w-12 bg-white text-red-500 border border-red-100 rounded-xl hover:bg-red-50 flex items-center justify-center transition-all"
          title="删除节点"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
};
