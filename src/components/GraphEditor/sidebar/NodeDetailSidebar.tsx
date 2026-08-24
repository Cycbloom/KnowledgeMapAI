import React, { useCallback } from "react";
import type { Node, Edge, GraphColorMode, NodeStatus } from "../../../types";
import { levelLabels, DECAY_CONFIG } from "../../../config/graphConfig";
import { getLearningStatus, getStatusColors, } from "../../../config/learningStatusColors";
import { getLevel } from "../../../utils/graph/graphUtils";
import { preprocessMarkdown } from "../../../utils/markdownPreprocessor";
import { formatDate } from "../../../utils/formatters";
import { formatMasteryPct } from "../../../utils/formatMastery";
import {
  preprocessWikiLinks,
  WikiLinkRenderer,
} from "../../../utils/wikiLinkRemarkPlugin";
import { backlinksApi } from "../../../services/api/backlinks";
import {
  TermTooltip,
  LazyImage,
  CollapsibleSection,
} from "../../common";
import { CodeBlock } from "../../common/CodeBlock";
import { Mermaid } from "../../common/Mermaid";
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
  Check,
  Loader2,
  GitBranch,
  Calendar,
  Activity,
  Link as LinkIcon,
  ChevronRight,
  History,
  AlertTriangle,
} from "lucide-react";
import { useTheme, useIsMobile } from "../../../hooks";
import { useTranslation } from "react-i18next";

interface NodeDetailSidebarProps {
  node: Node;
  nodes?: Node[];
  edges: Edge[];
  prevSidebarMode: "none" | "create" | "edit" | "outline" | "detail";
  nodeStatus?: Record<string, NodeStatus>;
  onClose: () => void;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStartLevelTest: () => void;
  onStartLearningMode: () => void;
  onManageCards: () => void;

  onRelatedNodeClick: (node: Node) => void;

  onUpdateNode?: (nodeId: string, updates: Partial<Node>) => void;
  isExplorationMode?: boolean;

  onGenerateNodeContent: () => void;
  isReadOnly?: boolean;
  onShowVersionHistory?: () => void;
  isGeneratingContent?: boolean;
  coloringMode?: GraphColorMode;
  onNavigateToNode?: (knowledgePointId: string, graphId?: string) => void;
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
  onManageCards,
  onRelatedNodeClick,
  onUpdateNode,
  isExplorationMode = false,
  onGenerateNodeContent,
  nodes = [],
  isReadOnly = false,
  onShowVersionHistory,
  isGeneratingContent = false,
  coloringMode = "status",
  onNavigateToNode,
}) => {
  /** @mastery display - 节点详情侧边栏：display_mastery 用于衰退指示器、掌握度徽章/进度条（纯 UI） */
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { isMobile } = useIsMobile();
  const isMastered = nodeStatus && nodeStatus?.[node.id]?.mastered;
  const status = getLearningStatus(nodeStatus?.[node.id]);
  const colors = getStatusColors(status, isDark);

  // 双链点击：搜索节点并跳转
  const handleWikiLinkClick = useCallback(
    async (title: string) => {
      try {
        const hits = await backlinksApi.search(title, { limit: 1 });
        const hit = hits[0];
        if (hit) {
          onNavigateToNode?.(hit.id, hit.graphIds[0]);
        } else {
          console.warn(t("graphEditor.backlinks.notFound"), title);
        }
      } catch {
        console.warn(t("graphEditor.backlinks.notFound"), title);
      }
    },
    [onNavigateToNode, t],
  );

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
    // 用 Set 替代 childIds.includes 的线性扫描（原为 O(nodes*childEdges)）
    const childIdSet = new Set(
      childEdges.map((e) => e.target_knowledge_point_id),
    );
    return nodes.filter((n) => childIdSet.has(n.id));
  }, [node, edges, nodes]);

  const statusInfo = nodeStatus?.[node.id];
  /** @mastery display - 掌握度衰退度量：display_mastery 优先于 retrievability 用于 UI 渲染进度条/徽章 */
  const displayMastery = statusInfo?.display_mastery;
  const fsrsRetrievability = statusInfo?.fsrs_retrievability;
  const decayMetric = displayMastery != null ? displayMastery : fsrsRetrievability;

  return (
    <div className="h-full flex flex-col">
      <div
        className={`flex justify-between items-center ${isMobile ? "mb-4 px-2" : "mb-6"}`}
      >
        <div className="flex items-center space-x-2">
          {prevSidebarMode === "outline" && (
            <button
              onClick={onBack}
              className={`text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg transition-all ${isMobile ? "mr-2 p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center" : "mr-1 p-1.5"}`}
              title={t("nodeDetail.backToOutline")}
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
            {t("nodeDetail.title")}
          </h3>
        </div>
        <button
          onClick={onClose}
          className={`text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors ${isMobile ? "p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center" : "p-1"}`}
        >
          <X size={isMobile ? 24 : 20} />
        </button>
      </div>

      {isReadOnly && (
        <div className="mb-4 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
            🔒 {t("nodeDetail.readOnlyMode")} - {t("nodeDetail.readOnlyHint")}
          </p>
        </div>
      )}

      {coloringMode === "decay" && decayMetric != null && decayMetric < DECAY_CONFIG.severeDecayThreshold && (
        <div className="mb-4 px-3 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertTriangle size={14} className="text-amber-500" />
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
              {t("nodeDetail.memoryDecay")}
            </span>
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-500 mb-2">
            {displayMastery != null
              ? t("nodeDetail.mastery", { percent: formatMasteryPct(displayMastery).replace('%', '') })
              : t("nodeDetail.retrievability", { percent: formatMasteryPct(fsrsRetrievability ?? 0).replace('%', '') })}
          </p>
          <button
            onClick={onStartLearningMode}
            className={`w-full flex items-center justify-center bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors text-xs font-bold ${isMobile ? "py-2.5 min-h-[40px]" : "py-1.5"}`}
          >
            <Navigation size={14} className="mr-1.5" />
            {t("nodeDetail.reviewNow")}
          </button>
        </div>
      )}

      <div
        className={`flex-1 space-y-6 overflow-y-auto ${isMobile ? "pr-0 px-2 pb-24" : "pr-1"}`}
      >
        <section>
          <h2
            className={`font-bold text-gray-900 dark:text-gray-100 leading-tight ${isMobile ? "text-xl mb-2" : "text-2xl mb-2"}`}
          >
            {node.title}
          </h2>

          {node.summary && (
            <p className={`text-gray-500 dark:text-gray-400 leading-relaxed ${isMobile ? "text-sm mb-3" : "text-sm mb-3"}`}>
              {node.summary}
            </p>
          )}

          {/* Metadata Row */}
          <div
            className={`flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400 ${isMobile ? "mb-4" : "gap-3 mb-4"}`}
          >
            <div
              className={`flex items-center bg-gray-50 dark:bg-gray-800 rounded ${isMobile ? "px-2.5 py-1.5" : "px-2 py-1"}`}
            >
              <Activity size={14} className="mr-1.5 text-primary-500" />
              <span>{t(levelLabels[getLevel(node, edges)], { defaultValue: t("nodeDetail.normalNode") })}</span>
            </div>

            <div
              className={`flex items-center bg-gray-50 dark:bg-gray-800 rounded ${isMobile ? "px-2.5 py-1.5" : "px-2 py-1"}`}
            >
              <Calendar size={14} className="mr-1.5 text-gray-400" />
              <span>
                {node.created_at
                  ? formatDate(node.created_at, "short")
                  : t("nodeDetail.unknownDate")}
              </span>
            </div>

            {onShowVersionHistory && (
              <button
                onClick={onShowVersionHistory}
                className={`flex items-center bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors cursor-pointer ${isMobile ? "px-2.5 py-1.5" : "px-2 py-1"}`}
              >
                <History size={14} className="mr-1.5" />
                <span>{t("nodeDetail.versionHistory")}</span>
              </button>
            )}

            {isMastered ? (
              <div
                className={`flex items-center bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded border border-green-100 dark:border-green-800 ${isMobile ? "px-2.5 py-1.5" : "px-2 py-1"}`}
              >
                <Check size={14} className="mr-1" /> {t("nodeDetail.mastered")}
              </div>
            ) : (
              <div
                className={`flex items-center bg-gray-50 dark:bg-gray-800 rounded ${isMobile ? "px-2.5 py-1.5" : "px-2 py-1"}`}
              >
                <div
                  className={`rounded-full mr-1.5 ${isMobile ? "w-2.5 h-2.5" : "w-2 h-2"}`}
                  style={{ backgroundColor: colors.primary }}
                />
                {status === "new" ? t("nodeDetail.notStarted") : t("nodeDetail.learning")}
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

        <CollapsibleSection
          id="content"
          title={t("common.aria.details")}
          storagePrefix="node-detail"
          className="prose prose-sm dark:prose-invert max-w-none text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700"
        >
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
              a: (props) => {
                const { href, children } = props;
                const cleanHref = href ? decodeURIComponent(href).trim() : "";

                if (cleanHref.startsWith("wiki://")) {
                  return (
                    <WikiLinkRenderer
                      href={href}
                      onWikiLinkClick={handleWikiLinkClick}
                    >
                      {children}
                    </WikiLinkRenderer>
                  );
                }

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
            {preprocessWikiLinks(preprocessMarkdown(node.content || `*${t("nodeDetail.noContent")}*`))}
          </ReactMarkdown>
        </CollapsibleSection>

        {/* Quick AI Generate Content Action */}
        {!isReadOnly && (
          <button
            onClick={onGenerateNodeContent}
            disabled={isGeneratingContent}
            className={`w-full flex items-center justify-center bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800 rounded-xl transition-colors text-sm font-bold ${isMobile ? "p-3.5 min-h-[48px]" : "p-2.5"} ${
              isGeneratingContent
                ? "opacity-60 cursor-not-allowed"
                : "hover:bg-primary-100 dark:hover:bg-primary-900/30"
            }`}
          >
            {isGeneratingContent ? (
              <>
                <Loader2 size={isMobile ? 18 : 16} className="mr-2 animate-spin" />
                {t("nodeDetail.generating")}
              </>
            ) : (
              <>
                <Wand2 size={isMobile ? 18 : 16} className="mr-2" />
                {t("nodeDetail.generateContent")}
              </>
            )}
          </button>
        )}

        {/* Learning Actions */}
        {!isReadOnly && (
          <section
            className={`grid gap-3 ${isMobile ? "grid-cols-1" : "grid-cols-2"}`}
          >
            <button
              onClick={onStartLearningMode}
              className={`flex items-center justify-center bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.98] ${isMobile ? "p-4 min-h-[52px]" : "col-span-2 p-3"}`}
            >
              <Navigation size={isMobile ? 20 : 18} className="mr-2" />
              <span className={`font-bold ${isMobile ? "text-base" : ""}`}>
                {t("nodeDetail.startImmersiveLearning")}
              </span>
            </button>

            <button
              onClick={onStartLevelTest}
              className={`flex items-center justify-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${isMobile ? "p-3.5 min-h-[48px]" : "p-3"}`}
            >
              <GraduationCap
                size={isMobile ? 20 : 18}
                className="mr-2 text-primary-500"
              />
              <span className="font-medium">{t("nodeDetail.levelTest")}</span>
            </button>

            <button
              onClick={onManageCards}
              className={`flex items-center justify-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${isMobile ? "p-3.5 min-h-[48px]" : "p-3"}`}
            >
              <Sparkles
                size={isMobile ? 20 : 18}
                className="mr-2 text-amber-500"
              />
              <span className="font-medium">{t("nodeDetail.manageCards")}</span>
            </button>
          </section>
        )}

        {/* Navigation Links */}
        <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-gray-700">
          {/* Parent */}
          {parentNode && (
            <div>
              <div className="text-[10px] text-gray-400 font-bold uppercase mb-1 flex items-center">
                <LinkIcon size={10} className="mr-1" /> {t("nodeDetail.parent")} (Parent)
              </div>
              <button
                onClick={() => onRelatedNodeClick(parentNode)}
                className="w-full text-left p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 font-medium flex items-center transition-colors border border-gray-100 dark:border-gray-700 hover:border-primary-200 dark:hover:border-primary-700 hover:text-primary-700 dark:hover:text-primary-400"
              >
                <ArrowLeft size={14} className="mr-2 text-gray-400" />
                {parentNode.title}
              </button>
            </div>
          )}

          {/* Children */}
          {childNodes.length > 0 && (
            <CollapsibleSection
              id="children"
              storagePrefix="node-detail"
              title={
                <div className="text-[10px] text-gray-400 font-bold uppercase flex items-center">
                  <LinkIcon size={10} className="mr-1" /> {t("nodeDetail.children")} (Children)
                </div>
              }
            >
              <div className="flex flex-col gap-1.5">
                {childNodes.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => onRelatedNodeClick(child)}
                    className="w-full text-left p-2 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 flex items-center transition-colors group border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-primary-400 mr-2 group-hover:scale-125 transition-transform" />
                    <span className="truncate">{child.title}</span>
                    <ChevronRight
                      size={14}
                      className="ml-auto text-gray-300 group-hover:text-gray-500"
                    />
                  </button>
                ))}
              </div>
            </CollapsibleSection>
          )}
        </div>

        {/* Branch Status Section */}
        {isExplorationMode && (
          <CollapsibleSection
            id="branch"
            storagePrefix="node-detail"
            className="mt-4 pt-4 border-t border-primary-200 dark:border-primary-800"
            title={
              <h5 className="text-xs font-bold text-primary-700 dark:text-primary-400 flex items-center">
                <GitBranch size={14} className="mr-1" />
                {t("nodeDetail.branchStatus")}
              </h5>
            }
          >
            <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                    {isAccepted ? t("nodeDetail.selected") : t("nodeDetail.notSelected")}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {isAccepted
                      ? t("nodeDetail.branchSelectedDesc")
                      : t("nodeDetail.branchNotSelectedDesc")}
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
                        : "bg-primary-500 text-white hover:bg-primary-600"
                    }`}
                  >
                    {isAccepted ? t("nodeDetail.cancelSelection") : t("nodeDetail.selectBranch")}
                  </button>
                )}
              </div>
            </div>
          </CollapsibleSection>
        )}
      </div>

      {!isReadOnly && (
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
            className={`flex-1 bg-primary-600 text-white rounded-xl hover:bg-primary-700 flex items-center justify-center font-bold shadow-lg shadow-primary-100 dark:shadow-primary-900/30 transition-all active:scale-95 ${isMobile ? "py-3.5 min-h-[52px]" : "py-2.5"}`}
          >
            <Edit3 size={isMobile ? 20 : 18} className="mr-2" />
            {t("nodeDetail.editNode")}
          </button>
          <button
            onClick={onDelete}
            className={`bg-white dark:bg-gray-800 text-red-500 border border-red-100 dark:border-red-900 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center transition-all ${isMobile ? "w-14 h-[52px] min-h-[52px]" : "w-12"}`}
            title={t("nodeDetail.deleteNode")}
            aria-label={t("nodeDetail.deleteNode")}
          >
            <Trash2 size={isMobile ? 20 : 18} />
          </button>
        </div>
      )}
    </div>
  );
};
