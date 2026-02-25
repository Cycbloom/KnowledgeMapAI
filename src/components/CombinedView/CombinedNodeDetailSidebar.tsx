import React, { useMemo } from 'react';
import { Node, Edge } from '../../types';
import { levelLabels } from '../../config/graphConfig';
import { getLevel } from '../../lib/graphUtils';
import { preprocessMarkdown } from '../../utils/markdownUtils';
import { TermTooltip } from '../TermTooltip';
import { CodeBlock } from '../CodeBlock';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { 
  X, ArrowLeft, Wand2, Edit3, Trash2, Navigation, 
  GraduationCap, Sparkles, Calendar, Activity, 
  Link as LinkIcon, ChevronRight
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { Mermaid } from '../Mermaid';

interface CombinedNodeDetailSidebarProps {
  node: Node;
  graphColor: string;
  graphTitle: string;
  edges: Edge[];
  nodes: Node[];
  prevSidebarMode: 'outline' | 'detail' | 'edit' | 'connections';
  onClose: () => void;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  aiOps?: {
    handleExpandNode: (prompt?: string) => Promise<{ newNodesCount: number; newEdgesCount: number } | null>;
    handleGenerateContent: (prompt?: string) => Promise<string | null>;
    handleGenerateCards: () => Promise<number | null>;
    handleStartLevelTest: () => void;
    handleStartLearningMode: () => void;
    handleAnalyzeCrossGraphConnections: () => Promise<unknown>;
  };
  onNodeClick: (node: Node) => void;
}

export const CombinedNodeDetailSidebar: React.FC<CombinedNodeDetailSidebarProps> = ({
  node,
  graphColor,
  graphTitle,
  edges,
  nodes,
  prevSidebarMode,
  onClose,
  onBack,
  onEdit,
  onDelete,
  aiOps,
  onNodeClick
}) => {
  const { isDark } = useTheme();
  const tags: string[] = node.tags || node.properties?.tags || [];

  const parentNode = useMemo(() => {
    if (!node || !edges || !nodes) return null;
    const parentEdge = edges.find(e => e.target_knowledge_point_id === node.id);
    if (!parentEdge) return null;
    return nodes.find(n => n.id === parentEdge.source_knowledge_point_id);
  }, [node, edges, nodes]);

  const childNodes = useMemo(() => {
    if (!node || !edges || !nodes) return [];
    const childEdges = edges.filter(e => e.source_knowledge_point_id === node.id);
    const childIds = childEdges.map(e => e.target_knowledge_point_id);
    return nodes.filter(n => childIds.includes(n.id));
  }, [node, edges, nodes]);

  return (
    <div className="h-full flex flex-col p-4">
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
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: graphColor }}></div>
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">节点详情</h3>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 p-1 hover:bg-gray-100 rounded-full transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section>
          <div className="flex items-center gap-2 mb-2">
            <div 
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: graphColor }}
            />
            <span className="text-xs text-slate-500 dark:text-slate-400">{graphTitle}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-tight mb-3">{node.title}</h1>
          
          <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400 mb-4">
            <div className="flex items-center bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">
              <Activity size={14} className="mr-1.5 text-blue-500" />
              <span>{levelLabels[getLevel(node, edges)] || '普通节点'}</span>
            </div>
            
            <div className="flex items-center bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">
              <Calendar size={14} className="mr-1.5 text-gray-400" />
              <span>{node.created_at ? new Date(node.created_at).toLocaleDateString() : '未知日期'}</span>
            </div>
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {tags.map((tag, index) => (
                <span 
                  key={index} 
                  className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs rounded-full border border-gray-200 dark:border-gray-700"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="prose prose-sm dark:prose-invert max-w-none text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
          <ReactMarkdown 
            remarkPlugins={[remarkGfm, remarkMath]} 
            rehypePlugins={[rehypeKatex]}
            urlTransform={(url) => url}
            components={{
              h1: ({children}) => <h1 className="text-gray-900 dark:text-gray-100">{children}</h1>,
              h2: ({children}) => <h2 className="text-gray-900 dark:text-gray-100">{children}</h2>,
              h3: ({children}) => <h3 className="text-gray-900 dark:text-gray-100">{children}</h3>,
              h4: ({children}) => <h4 className="text-gray-900 dark:text-gray-100">{children}</h4>,
              h5: ({children}) => <h5 className="text-gray-900 dark:text-gray-100">{children}</h5>,
              h6: ({children}) => <h6 className="text-gray-900 dark:text-gray-100">{children}</h6>,
              p: ({children}) => <p className="text-gray-600 dark:text-gray-300">{children}</p>,
              li: ({children}) => <li className="text-gray-600 dark:text-gray-300">{children}</li>,
              blockquote: ({children}) => <blockquote className="text-gray-600 dark:text-gray-300 border-l-gray-300 dark:border-l-gray-600">{children}</blockquote>,
              code(props) {
                const {children, className, node} = props
                const match = /language-(\w+)/.exec(className || '')
                if (match && match[1] === 'mermaid') {
                  return <Mermaid chart={String(children).replace(/\n$/, '')} />
                }
                return <CodeBlock className={className} isDark={isDark} node={node}>{children}</CodeBlock>
              },
              img: ({node, ...props}) => <img {...props} className="rounded-lg max-w-full h-auto" loading="lazy" />,
              a: ({node, ...props}) => {
                const { href, children } = props;
                const cleanHref = href ? decodeURIComponent(href).trim() : '';
                
                if (cleanHref.startsWith('term:')) {
                    const explanation = cleanHref.substring(5);
                    return <TermTooltip term={String(children)} explanation={explanation} />;
                }
                return <a {...props} className="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer" />;
              }
            }}
          >
            {preprocessMarkdown(node.content || '*暂无内容*')}
          </ReactMarkdown>
        </section>

        {aiOps && (
          <>
            <button 
              onClick={() => aiOps.handleGenerateContent()}
              className="w-full flex items-center justify-center p-2.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors text-sm font-bold"
            >
              <Wand2 size={16} className="mr-2" />
              生成/补充节点内容
            </button>

            <section className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => aiOps.handleStartLearningMode()}
                className="col-span-2 flex items-center justify-center p-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
              >
                <Navigation size={18} className="mr-2" />
                <span className="font-bold">开启沉浸学习</span>
              </button>
              
              <button 
                onClick={() => aiOps.handleStartLevelTest()}
                className="flex items-center justify-center p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <GraduationCap size={18} className="mr-2 text-indigo-500" />
                <span className="font-medium">关卡测试</span>
              </button>
              
              <button 
                onClick={() => aiOps.handleGenerateCards()}
                className="flex items-center justify-center p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Sparkles size={18} className="mr-2 text-amber-500" />
                <span className="font-medium">生成卡片</span>
              </button>
            </section>
          </>
        )}

        <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-gray-700">
           {parentNode && (
             <div>
               <div className="text-[10px] text-gray-400 font-bold uppercase mb-1 flex items-center">
                 <LinkIcon size={10} className="mr-1" /> 上一级 (Parent)
               </div>
               <button 
                 onClick={() => onNodeClick(parentNode)}
                 className="w-full text-left p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 font-medium flex items-center transition-colors border border-gray-100 dark:border-gray-700 hover:border-blue-200 hover:text-blue-700"
               >
                 <ArrowLeft size={14} className="mr-2 text-gray-400" />
                 {parentNode.title}
               </button>
             </div>
           )}

           {childNodes.length > 0 && (
             <div>
               <div className="text-[10px] text-gray-400 font-bold uppercase mb-1 flex items-center">
                 <LinkIcon size={10} className="mr-1" /> 下一级 (Children)
               </div>
               <div className="flex flex-col gap-1.5">
                 {childNodes.map(child => (
                   <button 
                     key={child.id} 
                     onClick={() => onNodeClick(child)}
                     className="w-full text-left p-2 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 flex items-center transition-colors group border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
                   >
                     <div className="w-1.5 h-1.5 rounded-full mr-2" style={{ backgroundColor: graphColor }} />
                     <span className="truncate">{child.title}</span>
                     <ChevronRight size={14} className="ml-auto text-gray-300 group-hover:text-gray-500" />
                   </button>
                 ))}
               </div>
             </div>
           )}
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center space-x-3 bg-white dark:bg-gray-900 sticky bottom-0 z-10">
        <button
          onClick={onEdit}
          className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl hover:bg-blue-700 flex items-center justify-center font-bold shadow-lg shadow-blue-100 dark:shadow-blue-900/30 transition-all active:scale-95"
        >
          <Edit3 size={18} className="mr-2" />
          编辑节点
        </button>
        <button
          onClick={onDelete}
          className="w-12 bg-white dark:bg-gray-800 text-red-500 border border-red-100 dark:border-red-900 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center transition-all"
          title="删除节点"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
};
