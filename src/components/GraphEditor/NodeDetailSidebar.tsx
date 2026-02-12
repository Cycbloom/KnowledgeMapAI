import React from 'react';
import { Node, Edge, BranchSuggestion } from '../../types';
import { levelLabels } from '../../config/graphConfig';
import { getLearningStatus, getStatusColors } from '../../config/learningStatusColors';
import { getLevel } from '../../lib/graphUtils';
import { preprocessMarkdown } from '../../utils/markdownUtils';
import { TermTooltip } from '../TermTooltip';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { 
  X, ArrowLeft, Wand2, Edit3, Trash2, Navigation, 
  GraduationCap, Sparkles, Check, Lock, Loader2, GitBranch,
  Calendar, Activity, Link as LinkIcon, ChevronRight
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { Mermaid } from '../Mermaid';

interface NodeDetailSidebarProps {
  node: Node;
  nodes?: Node[]; // Optional to avoid breaking if not passed immediately, but we just passed it
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

  // New AI Actions
  onGenerateNodeContent: () => void;
  onDeepAnalysis: () => void;
  onGenerateQuiz: () => void;
  onBackgroundGenerate: () => void;
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
  isExplorationMode = false,
  onGenerateNodeContent,
  onDeepAnalysis,
  onGenerateQuiz,
  onBackgroundGenerate,
  nodes = []
}) => {
  const { isDark } = useTheme();
  const isMastered = nodeStatus && nodeStatus[node.id]?.mastered;
  const isLocked = nodeStatus && nodeStatus[node.id]?.locked;
  const status = getLearningStatus(nodeStatus?.[node.id]);
  const colors = getStatusColors(status, isDark);

  const isAccepted = node.is_accepted !== false;
  const tags = node.tags || node.properties?.tags || [];

  // Navigation Logic
  const parentNode = React.useMemo(() => {
    if (!node || !edges || !nodes) return null;
    const parentEdge = edges.find(e => e.target_node_id === node.id);
    if (!parentEdge) return null;
    return nodes.find(n => n.id === parentEdge.source_node_id);
  }, [node, edges, nodes]);

  const childNodes = React.useMemo(() => {
    if (!node || !edges || !nodes) return [];
    const childEdges = edges.filter(e => e.source_node_id === node.id);
    const childIds = childEdges.map(e => e.target_node_id);
    return nodes.filter(n => childIds.includes(n.id));
  }, [node, edges, nodes]);


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
          <h1 className="text-2xl font-bold text-gray-900 leading-tight mb-3">{node.title}</h1>
          
          {/* Metadata Row */}
          <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-4">
            <div className="flex items-center bg-gray-50 px-2 py-1 rounded">
              <Activity size={14} className="mr-1.5 text-blue-500" />
              <span>{levelLabels[getLevel(node, edges)] || '普通节点'}</span>
            </div>
            
            <div className="flex items-center bg-gray-50 px-2 py-1 rounded">
              <Calendar size={14} className="mr-1.5 text-gray-400" />
              <span>{node.created_at ? new Date(node.created_at).toLocaleDateString() : '未知日期'}</span>
            </div>

            {isMastered ? (
                <div className="flex items-center bg-green-50 text-green-700 px-2 py-1 rounded border border-green-100">
                  <Check size={14} className="mr-1" /> 已掌握
                </div>
              ) : (
                 <div className="flex items-center bg-gray-50 px-2 py-1 rounded">
                   <div className={`w-2 h-2 rounded-full mr-1.5`} style={{ backgroundColor: colors.primary }} />
                   {status === 'new' ? '未开始' : '学习中'}
                 </div>
              )}
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {tags.map((tag, index) => (
                <span 
                  key={index} 
                  className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full border border-gray-200"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="prose prose-sm max-w-none text-gray-600 bg-gray-50 p-4 rounded-xl border border-gray-100">
          <ReactMarkdown 
            remarkPlugins={[remarkGfm, remarkMath]} 
            rehypePlugins={[rehypeKatex]}
            urlTransform={(url) => url} // Disable default URL validation to ensure 'term:' protocol is preserved
            components={{
              code(props) {
                const {children, className, node, ...rest} = props
                const match = /language-(\w+)/.exec(className || '')
                if (match && match[1] === 'mermaid') {
                  return <Mermaid chart={String(children).replace(/\n$/, '')} />
                }
                return <code {...rest} className={className}>{children}</code>
              },
              img: ({node, ...props}) => <img {...props} className="rounded-lg max-w-full h-auto" loading="lazy" />,
              a: ({node, ...props}) => {
                const { href, children } = props;
                // Decode and trim to handle potential encoding or spacing issues
                const cleanHref = href ? decodeURIComponent(href).trim() : '';
                
                if (cleanHref.startsWith('term:')) {
                    const explanation = cleanHref.substring(5); // Remove 'term:' (length 5)
                    return <TermTooltip term={String(children)} explanation={explanation} />;
                }
                return <a {...props} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" />;
              }
            }}
          >
            {preprocessMarkdown(node.content || '*暂无内容*')}
          </ReactMarkdown>
        </section>

        {/* Quick AI Generate Content Action */}
        <button 
          onClick={onGenerateNodeContent}
          className="w-full flex items-center justify-center p-2.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-xl hover:bg-purple-100 transition-colors text-sm font-bold"
        >
          <Wand2 size={16} className="mr-2" />
          生成/补充节点内容
        </button>

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
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={onDeepAnalysis}
              className="bg-white text-purple-700 text-xs font-bold py-2 rounded-lg border border-purple-200 shadow-sm hover:bg-purple-50 transition-colors"
            >
              深度解析
            </button>
            <button 
              onClick={onGenerateQuiz}
              className="bg-white text-purple-700 text-xs font-bold py-2 rounded-lg border border-purple-200 shadow-sm hover:bg-purple-50 transition-colors"
            >
              生成测验
            </button>
            <button 
              onClick={onBackgroundGenerate}
              className="bg-white text-purple-700 text-xs font-bold py-2 rounded-lg border border-purple-200 shadow-sm hover:bg-purple-50 transition-colors"
            >
              后台生成
            </button>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="space-y-4 pt-2 border-t border-gray-100">
           {/* Parent */}
           {parentNode && (
             <div>
               <div className="text-[10px] text-gray-400 font-bold uppercase mb-1 flex items-center">
                 <LinkIcon size={10} className="mr-1" /> 上一级 (Parent)
               </div>
               <button 
                 onClick={() => onRelatedNodeClick(parentNode)}
                 className="w-full text-left p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-sm text-gray-700 font-medium flex items-center transition-colors border border-gray-100 hover:border-blue-200 hover:text-blue-700"
               >
                 <ArrowLeft size={14} className="mr-2 text-gray-400" />
                 {parentNode.title}
               </button>
             </div>
           )}

           {/* Children */}
           {childNodes.length > 0 && (
             <div>
               <div className="text-[10px] text-gray-400 font-bold uppercase mb-1 flex items-center">
                 <LinkIcon size={10} className="mr-1" /> 下一级 (Children)
               </div>
               <div className="flex flex-col gap-1.5">
                 {childNodes.map(child => (
                   <button 
                     key={child.id} 
                     onClick={() => onRelatedNodeClick(child)}
                     className="w-full text-left p-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-sm text-gray-700 flex items-center transition-colors group border border-transparent hover:border-gray-200"
                   >
                     <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-2 group-hover:scale-125 transition-transform" />
                     <span className="truncate">{child.title}</span>
                     <ChevronRight size={14} className="ml-auto text-gray-300 group-hover:text-gray-500" />
                   </button>
                 ))}
               </div>
             </div>
           )}
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
