import React, { useMemo } from "react";
import { Node, Edge } from "../../types";
import { levelLabels } from "../../config/graphConfig";
import { getLevel } from "../../utils/graph/graphUtils";
import { preprocessMarkdown } from "../../utils/markdownPreprocessor";
import { TermTooltip, LazyImage } from "../common";
import { CodeBlock } from "../common/CodeBlock";
import { Mermaid } from "../common/Mermaid";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {
  X,
  ArrowLeft,
  Wand2,
  Edit3,
  Trash2,
  Navigation,
  GraduationCap,
  Sparkles,
  Calendar,
  Activity,
  Link as LinkIcon,
  ChevronRight,
} from "lucide-react";
import { useTheme } from "../../hooks";
import { useTranslation } from "react-i18next";
import { formatDate } from "../../utils/formatters";

interface CombinedNodeDetailSidebarProps {
  node: Node;
  graphColor: string;
  graphTitle: string;
  edges: Edge[];
  nodes: Node[];
  prevSidebarMode: "outline" | "detail" | "edit" | "connections";
  onClose: () => void;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  aiOps?: {
    handleExpandNode: (
      prompt?: string,
    ) => Promise<{ newNodesCount: number; newEdgesCount: number } | null>;
    handleGenerateContent: (prompt?: string) => Promise<string | null>;
    handleGenerateCards: () => Promise<number | null>;
    handleStartLevelTest: () => void;
    handleStartLearningMode: () => void;
    handleAnalyzeCrossGraphConnections: () => Promise<unknown>;
  };
  onNodeClick: (node: Node) => void;
}

export const CombinedNodeDetailSidebar: React.FC<
  CombinedNodeDetailSidebarProps
> = ({
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
  onNodeClick,
}) => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const tags: string[] = node.tags || node.properties?.tags || [];

  const parentNode = useMemo(() => {
    if (!node || !edges || !nodes) return null;
    const parentEdge = edges.find(
      (e) => e.target_knowledge_point_id === node.id,
    );
    if (!parentEdge) return null;
    return nodes.find((n) => n.id === parentEdge.source_knowledge_point_id);
  }, [node, edges, nodes]);

  const childNodes = useMemo(() => {
    if (!node || !edges || !nodes) return [];
    const childEdges = edges.filter(
      (e) => e.source_knowledge_point_id === node.id,
    );
    // 预建 childIdSet，避免对每个节点线性 includes（原为 O(nodes*childIds)）
    const childIdSet = new Set(
      childEdges.map((e) => e.target_knowledge_point_id),
    );
    return nodes.filter((n) => childIdSet.has(n.id));
  }, [node, edges, nodes]);

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-2">
          {prevSidebarMode === "outline" && (
            <button
              onClick={onBack}
              className="mr-1 p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
              title={t("nodeDetail.backToOutline")}
              aria-label={t("nodeDetail.backToOutline")}
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: graphColor }}
          ></div>
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            {t("nodeDetail.title")}
          </h3>
        </div>
        <button
          onClick={onClose}
          aria-label={t('common.aria.close')}
          className="text-gray-500 hover:text-gray-700 p-1 hover:bg-gray-100 rounded-full transition-colors min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 flex items-center justify-center"
        >
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
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {graphTitle}
            </span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-tight mb-2">
            {node.title}
          </h2>

          {node.summary && (
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-3">
              {node.summary}
            </p>
          )}

          <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400 mb-4">
            <div className="flex items-center bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">
              <Activity size={14} className="mr-1.5 text-primary-500" />
              <span>{t(levelLabels[getLevel(node, edges)], { defaultValue: t("nodeDetail.normalNode") })}</span>
            </div>

            <div className="flex items-center bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">
              <Calendar size={14} className="mr-1.5 text-gray-400 dark:text-gray-500" />
              <span>
                {node.created_at
                  ? formatDate(node.created_at, "short")
                  : t("nodeDetail.unknownDate")}
              </span>
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
              h1: ({ children }) => (
                <h2 className="text-gray-900 dark:text-gray-100">{children}</h2>
              ),
              h2: ({ children }) => (
                <h3 className="text-gray-900 dark:text-gray-100">{children}</h3>
              ),
              h3: ({ children }) => (
                <h4 className="text-gray-900 dark:text-gray-100">{children}</h4>
              ),
              h4: ({ children }) => (
                <h5 className="text-gray-900 dark:text-gray-100">{children}</h5>
              ),
              h5: ({ children }) => (
                <h6 className="text-gray-900 dark:text-gray-100">{children}</h6>
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
                const { children, className, node } = props;
                const match = /language-(\w+)/.exec(className || "");
                if (match && match[1] === "mermaid") {
                  return (
                    <Mermaid chart={String(children).replace(/\n$/, "")} />
                  );
                }
                return (
                  <CodeBlock className={className} isDark={isDark} node={node}>
                    {children}
                  </CodeBlock>
                );
              },
              img: (props) => {
                const { src, alt } = props;
                if (typeof src !== "string" || !src) {
                  return null;
                }
                return (
                  <LazyImage
                    src={src}
                    alt={alt ?? ""}
                    className="rounded-lg max-w-full h-auto"
                    showSkeleton={false}
                  />
                );
              },
              a: ({ node: _node, ...props }) => {
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
                    className="text-primary-600 dark:text-primary-400 underline"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={props.href}
                  >
                    {props.href}
                  </a>
                );
              },
            }}
          >
            {preprocessMarkdown(node.content || `*${t("nodeDetail.noContent")}*`)}
          </ReactMarkdown>
        </section>

        {aiOps && (
          <>
            <button
              onClick={() => aiOps.handleGenerateContent()}
              className="w-full flex items-center justify-center p-2.5 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800 rounded-xl hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors text-sm font-bold"
            >
              <Wand2 size={16} className="mr-2" />
              {t("nodeDetail.generateContent")}
            </button>

            <section className="grid grid-cols-2 gap-3">
              <button
                onClick={() => aiOps.handleStartLearningMode()}
                className="col-span-2 flex items-center justify-center p-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
              >
                <Navigation size={18} className="mr-2" />
                <span className="font-bold">{t("nodeDetail.startImmersiveLearning")}</span>
              </button>

              <button
                onClick={() => aiOps.handleStartLevelTest()}
                className="flex items-center justify-center p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <GraduationCap size={18} className="mr-2 text-primary-500" />
                <span className="font-medium">{t("nodeDetail.levelTest")}</span>
              </button>

              <button
                onClick={() => aiOps.handleGenerateCards()}
                className="flex items-center justify-center p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Sparkles size={18} className="mr-2 text-amber-500" />
                <span className="font-medium">{t("nodeDetail.generateCards")}</span>
              </button>
            </section>
          </>
        )}

        <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-gray-700">
          {parentNode && (
            <div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase mb-1 flex items-center">
                <LinkIcon size={10} className="mr-1" /> {t("nodeDetail.parent")} (Parent)
              </div>
              <button
                onClick={() => onNodeClick(parentNode)}
                className="w-full text-left p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 font-medium flex items-center transition-colors border border-gray-100 dark:border-gray-700 hover:border-primary-200 hover:text-primary-700"
              >
                <ArrowLeft size={14} className="mr-2 text-gray-400 dark:text-gray-500" />
                {parentNode.title}
              </button>
            </div>
          )}

          {childNodes.length > 0 && (
            <div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase mb-1 flex items-center">
                <LinkIcon size={10} className="mr-1" /> {t("nodeDetail.children")} (Children)
              </div>
              <div className="flex flex-col gap-1.5">
                {childNodes.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => onNodeClick(child)}
                    className="w-full text-left p-2 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 flex items-center transition-colors group border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full mr-2"
                      style={{ backgroundColor: graphColor }}
                    />
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
      </div>

      <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center space-x-3 bg-white dark:bg-gray-900 sticky bottom-0 z-10">
        <button
          onClick={onEdit}
          className="flex-1 bg-primary-600 text-white py-2.5 rounded-xl hover:bg-primary-700 flex items-center justify-center font-bold shadow-lg shadow-primary-100 dark:shadow-primary-900/30 transition-all active:scale-95"
        >
          <Edit3 size={18} className="mr-2" />
          {t("nodeDetail.editNode")}
        </button>
        <button
          onClick={onDelete}
          className="w-12 bg-white dark:bg-gray-800 text-red-500 border border-red-100 dark:border-red-900 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center transition-all"
          aria-label={t("nodeDetail.deleteNode")}
          title={t("nodeDetail.deleteNode")}
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
};
