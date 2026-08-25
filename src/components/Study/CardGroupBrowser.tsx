import { useState, useMemo, useEffect, useRef, Fragment } from "react";
import { useTranslation } from "react-i18next";
import { StudyCard } from "@shared/types";
import { StudyCardPreview } from "./StudyCardPreview";
import { BookOpen, Tags, ChevronDown, ChevronRight, Search } from "lucide-react";

interface PointGroup {
  pointKey: string;
  pointTitle: string;
  cards: StudyCard[];
}

interface GraphGroup {
  graphKey: string;
  graphTitle: string;
  cards: StudyCard[];
  dueCount: number;
  pointGroups: PointGroup[];
}

interface CardGroupBrowserProps {
  isDark: boolean;
  isMobile?: boolean;
  /** 当前范围（待复习/全部）下的全部卡片，用于客户端分组 */
  cards: StudyCard[];
  /** 待复习卡片 id 集合，用于到期数徽章 */
  dueCardIds: Set<string>;
  onPractice: (card: StudyCard) => void;
  onPreview: (card: StudyCard) => void;
}

/**
 * 图谱 → 知识点 两级分组浏览（左右双栏：左侧树状大纲 + 右侧卡片内容）。
 * 原为学习中心首页卡片列表的分组视图，整合题库后抽取为独立组件共用。
 */
export const CardGroupBrowser = ({
  isDark,
  isMobile = false,
  cards,
  dueCardIds,
  onPractice,
  onPreview,
}: CardGroupBrowserProps) => {
  const { t } = useTranslation();

  // 大纲树：选中的图谱/知识点，null 表示自动回退到第一个图谱
  const [selectedGraphKey, setSelectedGraphKey] = useState<string | null>(null);
  const [selectedPointKey, setSelectedPointKey] = useState<string | null>(null);
  // 大纲树中已展开的图谱（知识点为叶子节点，跟随图谱展开）
  const [expandedGraphs, setExpandedGraphs] = useState<Set<string>>(new Set());
  const didAutoExpandRef = useRef(false);

  // 按「知识图谱 → 知识点」两级分组（基于 API 已携带的 graphTitle / knowledgePointTitle）
  const graphGroups = useMemo<GraphGroup[]>(() => {
    const graphMap = new Map<string, GraphGroup>();
    for (const card of cards) {
      const graphKey = card.graph_id || card.source_graph_id || "unknown";
      const graphTitle = card.graphTitle || t("study.cardList.unknownGraph");
      let graph = graphMap.get(graphKey);
      if (!graph) {
        graph = { graphKey, graphTitle, cards: [], dueCount: 0, pointGroups: [] };
        graphMap.set(graphKey, graph);
      }
      graph.cards.push(card);
      if (dueCardIds.has(card.id)) graph.dueCount += 1;

      const pointKey = `${graphKey}::${card.knowledge_point_id || "unknown"}`;
      const pointTitle =
        card.knowledgePointTitle || t("study.cardList.unknownPoint");
      let point = graph.pointGroups.find((p) => p.pointKey === pointKey);
      if (!point) {
        point = { pointKey, pointTitle, cards: [] };
        graph.pointGroups.push(point);
      }
      point.cards.push(card);
    }
    const graphs = Array.from(graphMap.values());
    // 未归属图谱固定沉底，其余按标题排序，避免「其他」组挡在前面
    graphs.sort((a, b) => {
      const aUnknown = a.graphKey === "unknown" ? 1 : 0;
      const bUnknown = b.graphKey === "unknown" ? 1 : 0;
      if (aUnknown !== bUnknown) return aUnknown - bUnknown;
      return a.graphTitle.localeCompare(b.graphTitle);
    });
    for (const graph of graphs) {
      graph.pointGroups.sort((a, b) => a.pointTitle.localeCompare(b.pointTitle));
    }
    return graphs;
  }, [cards, dueCardIds, t]);

  // 当前激活的图谱：选中项不存在时自动回退到第一个
  const activeGraph = useMemo<GraphGroup | null>(() => {
    if (graphGroups.length === 0) return null;
    return (
      graphGroups.find((g) => g.graphKey === selectedGraphKey) ?? graphGroups[0]
    );
  }, [graphGroups, selectedGraphKey]);

  // 选中的知识点（仅当仍在激活图谱内才有效）
  const activePoint = useMemo<PointGroup | null>(() => {
    if (!selectedPointKey || !activeGraph) return null;
    return (
      activeGraph.pointGroups.find((p) => p.pointKey === selectedPointKey) ??
      null
    );
  }, [selectedPointKey, activeGraph]);

  // 初始加载时默认展开所有图谱（知识点随图谱展开）
  useEffect(() => {
    if (!didAutoExpandRef.current && graphGroups.length > 0) {
      didAutoExpandRef.current = true;
      setExpandedGraphs(new Set(graphGroups.map((g) => g.graphKey)));
    }
  }, [graphGroups]);

  const toggleGraphExpand = (key: string) => {
    setExpandedGraphs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const selectGraph = (graph: GraphGroup) => {
    setSelectedGraphKey(graph.graphKey);
    setSelectedPointKey(null);
    setExpandedGraphs((prev) => {
      if (prev.has(graph.graphKey)) return prev;
      const next = new Set(prev);
      next.add(graph.graphKey);
      return next;
    });
  };
  const selectPoint = (graph: GraphGroup, point: PointGroup) => {
    setSelectedGraphKey(graph.graphKey);
    setSelectedPointKey(point.pointKey);
  };
  const clearPointSelection = () => {
    setSelectedPointKey(null);
  };
  const expandAllGroups = () => {
    setExpandedGraphs(new Set(graphGroups.map((g) => g.graphKey)));
  };
  const collapseAllGroups = () => {
    setExpandedGraphs(new Set());
  };

  if (graphGroups.length === 0) {
    return (
      <div
        className={`py-12 text-center rounded-3xl border-2 border-dashed ${
          isDark
            ? "border-slate-800 text-slate-500"
            : "border-gray-200 text-gray-400"
        }`}
      >
        <Search className="mx-auto mb-3 opacity-20" size={48} />
        <p className="mb-4">{t("study.cardList.noCardsFound")}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 md:gap-6 items-start">
      {/* LEFT: 图谱→知识点 大纲树（移动端为横向 chips，桌面端为粘性侧栏） */}
      <div className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto custom-scrollbar">
        <div className="hidden lg:flex items-center justify-between mb-2 px-1">
          <p
            className={`text-xs font-semibold ${
              isDark ? "text-slate-400" : "text-gray-500"
            }`}
          >
            {t("study.cardList.outlineTitle")}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={expandAllGroups}
              aria-label={t("study.cardList.expandAll")}
              title={t("study.cardList.expandAll")}
              className="p-1.5 rounded transition-colors text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              <ChevronDown size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={collapseAllGroups}
              aria-label={t("study.cardList.collapseAll")}
              title={t("study.cardList.collapseAll")}
              className="p-1.5 rounded transition-colors text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div
          role="tree"
          aria-label={t("study.cardList.outlineTitle")}
          className="flex lg:flex-col gap-1.5 lg:gap-0.5 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0 -mx-1 px-1 lg:mx-0 lg:px-0"
        >
          {graphGroups.map((graph) => {
            const isUnknown = graph.graphKey === "unknown";
            const graphExpanded = expandedGraphs.has(graph.graphKey);
            const graphActive = activeGraph?.graphKey === graph.graphKey;
            const graphSelected = graphActive && !activePoint;
            const hasPoints = graph.pointGroups.length > 0;
            return (
              <Fragment key={graph.graphKey}>
                {isUnknown && (
                  <div
                    className={`hidden lg:block border-t my-1 ${
                      isDark ? "border-slate-700" : "border-gray-200"
                    }`}
                  />
                )}
                {/* 图谱行 */}
                <div
                  role="treeitem"
                  aria-level={1}
                  aria-expanded={hasPoints ? graphExpanded : undefined}
                  aria-selected={graphSelected}
                  className={`shrink-0 lg:w-full flex items-center gap-1 px-1 lg:px-2 py-1.5 rounded-lg text-left transition-colors ${
                    graphSelected
                      ? "bg-primary-600 text-white shadow-md shadow-primary-200"
                      : isDark
                        ? "text-slate-300 hover:bg-slate-800"
                        : "text-gray-700 hover:bg-gray-100"
                  } ${isUnknown && !graphSelected ? "opacity-80" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleGraphExpand(graph.graphKey)}
                    disabled={!hasPoints}
                    aria-hidden="true"
                    tabIndex={-1}
                    className={`w-5 h-5 shrink-0 flex items-center justify-center rounded hover:bg-black/10 dark:hover:bg-white/10 ${
                      hasPoints ? "visible" : "invisible"
                    }`}
                  >
                    {graphExpanded ? (
                      <ChevronDown size={14} aria-hidden="true" />
                    ) : (
                      <ChevronRight size={14} aria-hidden="true" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => selectGraph(graph)}
                    aria-label={t("study.cardList.selectGraph", {
                      title: graph.graphTitle,
                    })}
                    className="flex items-center gap-1.5 min-w-0 flex-1 text-left"
                  >
                    <BookOpen
                      size={14}
                      className="shrink-0"
                      aria-hidden="true"
                    />
                    <span className="truncate text-sm font-medium">
                      {graph.graphTitle}
                    </span>
                  </button>
                  <span
                    className={`shrink-0 px-1.5 py-0.5 rounded-full text-[11px] font-medium tabular-nums ${
                      graphSelected
                        ? "bg-white/20 text-white"
                        : isDark
                          ? "bg-slate-700 text-slate-300"
                          : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {graph.cards.length}
                  </span>
                  {graph.dueCount > 0 && (
                    <span
                      className={`shrink-0 px-1.5 py-0.5 rounded-full text-[11px] font-bold tabular-nums ${
                        graphSelected
                          ? "bg-amber-400 text-amber-900"
                          : isDark
                            ? "bg-amber-500/15 text-amber-400"
                            : "bg-amber-500/15 text-amber-600"
                      }`}
                    >
                      {graph.dueCount}
                    </span>
                  )}
                </div>
                {/* 知识点子行（叶子节点） */}
                {graphExpanded &&
                  graph.pointGroups.map((point) => {
                    const pointActive = selectedPointKey === point.pointKey;
                    return (
                      <button
                        key={point.pointKey}
                        type="button"
                        role="treeitem"
                        aria-level={2}
                        aria-selected={pointActive}
                        onClick={() => selectPoint(graph, point)}
                        className={`shrink-0 lg:w-full flex items-center gap-1.5 px-2 lg:pl-9 py-1 rounded-lg text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                          pointActive
                            ? "bg-primary-600 text-white shadow-md shadow-primary-200"
                            : isDark
                              ? "text-slate-400 hover:bg-slate-800"
                              : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        <Tags
                          size={13}
                          className="shrink-0"
                          aria-hidden="true"
                        />
                        <span className="truncate text-sm">
                          {point.pointTitle}
                        </span>
                        <span
                          className={`ml-auto shrink-0 px-1.5 py-0.5 rounded-full text-[11px] font-medium tabular-nums ${
                            pointActive
                              ? "bg-white/20 text-white"
                              : isDark
                                ? "bg-slate-700 text-slate-300"
                                : "bg-gray-200 text-gray-600"
                          }`}
                        >
                          {point.cards.length}
                        </span>
                      </button>
                    );
                  })}
              </Fragment>
            );
          })}
        </div>
      </div>

      {/* RIGHT: 选中图谱（或知识点）的卡片内容 */}
      <div className="min-w-0 space-y-4 md:space-y-5">
        {activeGraph ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 md:gap-3 min-w-0">
                <BookOpen
                  size={isMobile ? 16 : 18}
                  className="shrink-0 text-primary-500"
                  aria-hidden="true"
                />
                {activePoint ? (
                  <h3 className="font-bold truncate">
                    {activeGraph.graphTitle}
                    <span
                      className={`font-normal ${
                        isDark ? "text-slate-400" : "text-gray-500"
                      }`}
                    >
                      {" / "}
                    </span>
                    {activePoint.pointTitle}
                  </h3>
                ) : (
                  <h3 className="font-bold truncate">
                    {activeGraph.graphTitle}
                  </h3>
                )}
                <span
                  className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                    isDark
                      ? "bg-slate-700 text-slate-300"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {t("study.cardList.cardCount", {
                    count: activePoint
                      ? activePoint.cards.length
                      : activeGraph.cards.length,
                  })}
                </span>
                {!activePoint && activeGraph.dueCount > 0 && (
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-bold tabular-nums ${
                      isDark
                        ? "bg-amber-500/15 text-amber-400"
                        : "bg-amber-500/15 text-amber-600"
                    }`}
                  >
                    {t("study.cardList.dueCount", {
                      count: activeGraph.dueCount,
                    })}
                  </span>
                )}
              </div>
              {activePoint && (
                <button
                  type="button"
                  onClick={clearPointSelection}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${
                    isDark
                      ? "border-slate-600 text-slate-300 hover:bg-slate-800"
                      : "border-gray-300 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {t("study.cardList.showAllPoints")}
                </button>
              )}
            </div>

            {(activePoint ? [activePoint] : activeGraph.pointGroups).map(
              (point) => {
                const pointDue = point.cards.filter((c) =>
                  dueCardIds.has(c.id),
                ).length;
                return (
                  <div
                    key={point.pointKey}
                    className={`rounded-xl border ${
                      isDark
                        ? "border-slate-700 bg-slate-800/60"
                        : "border-gray-200 bg-gray-50/60"
                    }`}
                  >
                    <div
                      className={`flex items-center justify-between gap-3 px-3 md:px-4 py-2.5 border-b ${
                        isDark ? "border-slate-700" : "border-gray-100"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Tags
                          size={isMobile ? 14 : 16}
                          className="shrink-0 text-primary-500"
                          aria-hidden="true"
                        />
                        <span className="text-sm font-medium truncate">
                          {point.pointTitle}
                        </span>
                        <span
                          className={`shrink-0 px-1.5 py-0.5 rounded-full text-[11px] font-medium ${
                            isDark
                              ? "bg-slate-700 text-slate-300"
                              : "bg-gray-200 text-gray-600"
                          }`}
                        >
                          {point.cards.length}
                        </span>
                        {pointDue > 0 && (
                          <span
                            className={`shrink-0 px-1.5 py-0.5 rounded-full text-[11px] font-bold tabular-nums ${
                              isDark
                                ? "bg-amber-500/15 text-amber-400"
                                : "bg-amber-500/15 text-amber-600"
                            }`}
                          >
                            {pointDue}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="p-2 md:p-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                        {point.cards.map((card) => (
                          <StudyCardPreview
                            key={card.id}
                            card={card}
                            isDark={isDark}
                            onPreview={onPreview}
                            onPractice={onPractice}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              },
            )}
          </>
        ) : null}
      </div>
    </div>
  );
};
