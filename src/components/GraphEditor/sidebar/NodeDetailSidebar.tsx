import React from "react";
import type { Node, Edge } from "../../../types";
import { levelLabels } from "../../../config/graphConfig";
import {
  getLearningStatus,
  getStatusColors,
} from "../../../config/learningStatusColors";
import { getLevel } from "../../../lib/graphUtils";
import { preprocessMarkdown } from "../../../utils/markdownUtils";
import { TermTooltip } from "../../common";
import { CodeBlock, Mermaid } from "../../common";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import {
  X,
  ArrowLeft,
  Wand2,
  Edit3,
  Trash2,
  Navigation,
  GraduationCap,
  Sparkles,
  Check,
  Loader2,
  GitBranch,
  Calendar,
  Activity,
  Link as LinkIcon,
  ChevronRight,
} from "lucide-react";
import { useTheme } from "../../../hooks/useTheme";
import { useIsMobile } from "../../../hooks/useIsMobile";

interface NodeDetailSidebarProps {
  node: Node;
  nodes?: Node[]; // Optional to avoid breaking if not passed immediately, but we just passed it
  edges: Edge[];
  prevSidebarMode: "none" | "create" | "edit" | "outline" | "detail";
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
  nodes = [],
}) => {
  const { isDark } = useTheme();
  const { isMobile } = useIsMobile();
  const isMastered = nodeStatus && nodeStatus[node.id]?.mastered;
  const status = getLearningStatus(nodeStatus?.[node.id]);
  const colors = getStatusColors(status, isDark);

  const isAccepted = node.is_accepted !== false;
  const tags: string[] = node.tags || node.properties?.tags || [];

  // Navigation Logic
  const parentNode = React.useMemo(() => {
    if (!node || !edges || !nodes) return null;
    const parentEdge = edges.find(
      (e) => e.target_knowledge_point_id === node.id,
    );
    if (!parentEdge) return null;
    return nodes.find((n) => n.id === parentEdge.source_knowledge_point_id);
  }, [node, edges, nodes]);

  const childNodes = React.useMemo(() => {
    if (!node || !edges || !nodes) return [];
    const childEdges = edges.filter(
      (e) => e.source_knowledge_point_id === node.id,
    );
    const childIds = childEdges.map((e) => e.target_knowledge_point_id);
    return nodes.filter((n) => childIds.includes(n.id));
  }, [node, edges, nodes]);

  return (
    <div className="h-full flex flex-col">
      <div
        className={`flex justify-between items-center ${isMobile ? "mb-4 px-2" : "mb-6"}`}
      >
        <div className="flex items-center space-x-2">
          {prevSidebarMode === "outline" && (
            <button
              onClick={onBack}
              className={`text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all ${isMobile ? "mr-2 p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center" : "mr-1 p-1.5"}`}
              title="返回大纲"
            >
              <ArrowLeft size={isMobile ? 20 : 18} />
            </button>
          )}
          <div
            className={`rounded-full ${isMobile ? "w-4 h-4" : "w-3 h-3"}`}
            style={{ backgroundColor: colors.primary }}
          ></div>
          <h3
            className={`font-bold text-gray-800 dark:text-gray-100 ${isMobile ? "text-xl" : "text-lg"}`}
          >
            节点详情
          </h3>
        </div>
        <button
          onClick={onClose}
          className={`text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors ${isMobile ? "p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center" : "p-1"}`}
        >
          <X size={isMobile ? 24 : 20} />
        </button>
      </div>

      <div
        className={`flex-1 space-y-6 overflow-y-auto ${isMobile ? "pr-0 px-2 pb-24" : "pr-1"}`}
      >
        <section>
          <h1
            className={`font-bold text-gray-900 dark:text-gray-100 leading-tight ${isMobile ? "text-xl mb-4" : "text-2xl mb-3"}`}
          >
            {node.title}
          </h1>

          {/* Metadata Row */}
          <div
            className={`flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400 ${isMobile ? "mb-4" : "gap-3 mb-4"}`}
          >
            <div
              className={`flex items-center bg-gray-50 dark:bg-gray-800 rounded ${isMobile ? "px-2.5 py-1.5" : "px-2 py-1"}`}
            >
              <Activity size={14} className="mr-1.5 text-blue-500" />
              <span>{levelLabels[getLevel(node, edges)] || "普通节点"}</span>
            </div>

            <div
              className={`flex items-center bg-gray-50 dark:bg-gray-800 rounded ${isMobile ? "px-2.5 py-1.5" : "px-2 py-1"}`}
            >
              <Calendar size={14} className="mr-1.5 text-gray-400" />
              <span>
                {node.created_at
                  ? new Date(node.created_at).toLocaleDateString()
                  : "未知日期"}
              </span>
            </div>

            {isMastered ? (
              <div
                className={`flex items-center bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded border border-green-100 dark:border-green-800 ${isMobile ? "px-2.5 py-1.5" : "px-2 py-1"}`}
              >
                <Check size={14} className="mr-1" /> 已掌握
              </div>
            ) : (
              <div
                className={`flex items-center bg-gray-50 dark:bg-gray-800 rounded ${isMobile ? "px-2.5 py-1.5" : "px-2 py-1"}`}
              >
                <div
                  className={`rounded-full mr-1.5 ${isMobile ? "w-2.5 h-2.5" : "w-2 h-2"}`}
                  style={{ backgroundColor: colors.primary }}
                />
                {status === "new" ? "未开始" : "学习中"}
              </div>
            )}
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
              h1: ({ children }) => (
                <h1 className="text-gray-900 dark:text-gray-100">{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-gray-900 dark:text-gray-100">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-gray-900 dark:text-gray-100">{children}</h3>
              ),
              h4: ({ children }) => (
                <h4 className="text-gray-900 dark:text-gray-100">{children}</h4>
              ),
              h5: ({ children }) => (
                <h5 className="text-gray-900 dark:text-gray-100">{children}</h5>
              ),
              h6: ({ children }) => (
                <h6 className="text-gray-900 dark:text-gray-100">{children}</h6>
              ),
              p: ({ children }) => (
                <p className="text-gray-600 dark:text-gray-300">{children}</p>
              ),
              li: ({ children }) => (
                <li className="text-gray-600 dark:text-gray-300">{children}</li>
              ),
              blockquote: ({ children }) => (
                <blockquote className="text-gray-600 dark:text-gray-300 border-l-gray-300 dark:border-l-gray-600">
                  {children}
                </blockquote>
              ),
              code(props) {
                const { children, className } = props;
                const match = /language-(\w+)/.exec(className || "");
                if (match && match[1] === "mermaid") {
                  return (
                    <Mermaid chart={String(children).replace(/\n$/, "")} />
                  );
                }
                return (
                  <CodeBlock className={className} isDark={isDark}>
                    {children}
                  </CodeBlock>
                );
              },
              img: (props) => (
                <img
                  {...props}
                  className="rounded-lg max-w-full h-auto"
                  loading="lazy"
                />
              ),
              a: (props) => {
                const { href, children } = props;
                const cleanHref = href ? decodeURIComponent(href).trim() : "";

                if (cleanHref.startsWith("term:")) {
                  const explanation = cleanHref.substring(5);
                  return (
                    <TermTooltip
                      term={String(children)}
                      explanation={explanation}
                    />
                  );
                }
                return (
                  <a
                    {...props}
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                );
              },
            }}
          >
            {preprocessMarkdown(node.content || "*暂无内容*")}
          </ReactMarkdown>
        </section>

        {/* Quick AI Generate Content Action */}
        <button
          onClick={onGenerateNodeContent}
          className={`w-full flex items-center justify-center bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors text-sm font-bold ${isMobile ? "p-3.5 min-h-[48px]" : "p-2.5"}`}
        >
          <Wand2 size={isMobile ? 18 : 16} className="mr-2" />
          生成/补充节点内容
        </button>

        {/* Learning Actions */}
        <section
          className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}
        >
          <button
            onClick={onStartLearningMode}
            className={`flex items-center justify-center bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.98] ${isMobile ? "p-4 min-h-[52px]" : "col-span-2 p-3"}`}
          >
            <Navigation size={isMobile ? 20 : 18} className="mr-2" />
            <span className={`font-bold ${isMobile ? "text-base" : ""}`}>
              开启沉浸学习
            </span>
          </button>

          <button
            onClick={onStartLevelTest}
            className={`flex items-center justify-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${isMobile ? "p-3.5 min-h-[48px]" : "p-3"}`}
          >
            <GraduationCap
              size={isMobile ? 20 : 18}
              className="mr-2 text-indigo-500"
            />
            <span className="font-medium">关卡测试</span>
          </button>

          <button
            onClick={onGenerateCards}
            className={`flex items-center justify-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${isMobile ? "p-3.5 min-h-[48px]" : "p-3"}`}
          >
            <Sparkles
              size={isMobile ? 20 : 18}
              className="mr-2 text-amber-500"
            />
            <span className="font-medium">生成卡片</span>
          </button>
        </section>

        {/* AI Analysis Section */}
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-2xl p-4 border border-purple-100 dark:border-purple-800">
          <div className="flex items-center justify-between mb-3">
            <h3
              className={`font-bold text-purple-900 dark:text-purple-300 flex items-center ${isMobile ? "text-base" : ""}`}
            >
              <Wand2 size={isMobile ? 18 : 16} className="mr-2" />
              AI 深度探索
            </h3>
            <span className="text-[10px] bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-300 px-2 py-0.5 rounded-full">
              Beta
            </span>
          </div>
          <p className="text-xs text-purple-700 dark:text-purple-400 mb-4 leading-relaxed">
            使用 AI 分析当前节点，发现潜在的关联知识点或生成深度思考问题。
          </p>
          <div
            className={`grid gap-2 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}
          >
            <button
              onClick={onDeepAnalysis}
              className={`bg-white dark:bg-gray-800 text-purple-700 dark:text-purple-300 text-xs font-bold rounded-lg border border-purple-200 dark:border-purple-700 shadow-sm hover:bg-purple-50 dark:hover:bg-gray-700 transition-colors ${isMobile ? "py-3 min-h-[44px]" : "py-2"}`}
            >
              深度解析
            </button>
            <button
              onClick={onGenerateQuiz}
              className={`bg-white dark:bg-gray-800 text-purple-700 dark:text-purple-300 text-xs font-bold rounded-lg border border-purple-200 dark:border-purple-700 shadow-sm hover:bg-purple-50 dark:hover:bg-gray-700 transition-colors ${isMobile ? "py-3 min-h-[44px]" : "py-2"}`}
            >
              生成测验
            </button>
            <button
              onClick={onBackgroundGenerate}
              className={`bg-white dark:bg-gray-800 text-purple-700 dark:text-purple-300 text-xs font-bold rounded-lg border border-purple-200 dark:border-purple-700 shadow-sm hover:bg-purple-50 dark:hover:bg-gray-700 transition-colors ${isMobile ? "py-3 min-h-[44px]" : "py-2"}`}
            >
              后台生成
            </button>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-gray-700">
          {/* Parent */}
          {parentNode && (
            <div>
              <div className="text-[10px] text-gray-400 font-bold uppercase mb-1 flex items-center">
                <LinkIcon size={10} className="mr-1" /> 上一级 (Parent)
              </div>
              <button
                onClick={() => onRelatedNodeClick(parentNode)}
                className="w-full text-left p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 font-medium flex items-center transition-colors border border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-700 hover:text-blue-700 dark:hover:text-blue-400"
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
                {childNodes.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => onRelatedNodeClick(child)}
                    className="w-full text-left p-2 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 flex items-center transition-colors group border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-2 group-hover:scale-125 transition-transform" />
                    <span className="truncate">{child.title}</span>
                    <ChevronRight
                      size={14}
                      className="ml-auto text-gray-300 group-hover:text-gray-500"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Related Nodes Section */}
        <div className="mt-4 pt-4 border-t border-purple-200 dark:border-purple-800">
          <div className="flex justify-between items-center mb-2">
            <h5 className="text-xs font-bold text-purple-700 dark:text-purple-400">
              🔗 语义相关节点
            </h5>
            {!showRelatedSection && (
              <button
                onClick={onFetchRelatedNodes}
                className="text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-2 py-1 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
              >
                加载相关
              </button>
            )}
          </div>

          {showRelatedSection && (
            <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-2 min-h-[60px]">
              {isRelatedLoading ? (
                <div className="flex justify-center py-2">
                  <Loader2 className="animate-spin text-purple-400" size={16} />
                </div>
              ) : relatedNodes.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {relatedNodes.map((rNode) => (
                    <button
                      key={rNode.id}
                      onClick={() => onRelatedNodeClick(rNode)}
                      className="text-xs bg-white dark:bg-gray-700 border border-purple-100 dark:border-purple-800 text-purple-600 dark:text-purple-400 px-2 py-1 rounded-md shadow-sm hover:bg-purple-50 dark:hover:bg-gray-600 transition-colors truncate max-w-full"
                    >
                      {rNode.title}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center py-2">
                  暂无相关节点
                </p>
              )}
            </div>
          )}
        </div>

        {/* Branch Status Section */}
        {isExplorationMode && (
          <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
            <div className="flex justify-between items-center mb-2">
              <h5 className="text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center">
                <GitBranch size={14} className="mr-1" />
                分支状态
              </h5>
            </div>
            <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                    {isAccepted ? "已选择" : "未选择"}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {isAccepted
                      ? "此分支已被选中，显示为圆形+实线"
                      : "此分支未被选中，显示为方形+虚线"}
                  </div>
                </div>
                {onUpdateNode && (
                  <button
                    onClick={() =>
                      onUpdateNode(node.id, { is_accepted: !isAccepted })
                    }
                    className={`px-4 py-2 rounded-lg font-bold transition-colors whitespace-nowrap ${
                      isAccepted
                        ? "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                        : "bg-blue-500 text-white hover:bg-blue-600"
                    }`}
                  >
                    {isAccepted ? "取消选择" : "选择此分支"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div
        className={`${
          isMobile
            ? "fixed bottom-0 left-0 right-0 p-4 border-t border-gray-100 dark:border-gray-700 flex items-center gap-3 bg-white dark:bg-gray-900 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]"
            : "mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center space-x-3 bg-white dark:bg-gray-900 sticky bottom-0 z-10"
        }`}
        style={
          isMobile
            ? { paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }
            : undefined
        }
      >
        <button
          onClick={onEdit}
          className={`flex-1 bg-blue-600 text-white rounded-xl hover:bg-blue-700 flex items-center justify-center font-bold shadow-lg shadow-blue-100 dark:shadow-blue-900/30 transition-all active:scale-95 ${isMobile ? "py-3.5 min-h-[52px]" : "py-2.5"}`}
        >
          <Edit3 size={isMobile ? 20 : 18} className="mr-2" />
          编辑节点
        </button>
        <button
          onClick={onDelete}
          className={`bg-white dark:bg-gray-800 text-red-500 border border-red-100 dark:border-red-900 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center transition-all ${isMobile ? "w-14 h-[52px] min-h-[52px]" : "w-12"}`}
          title="删除节点"
        >
          <Trash2 size={isMobile ? 20 : 18} />
        </button>
      </div>
    </div>
  );
};
