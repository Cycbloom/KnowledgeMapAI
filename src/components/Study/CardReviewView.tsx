import { useState, useMemo, useEffect, useRef, Fragment } from "react";
import { useTranslation } from "react-i18next";
import { StudyCard } from "@shared/types";
import { StudyCardPreview } from "./StudyCardPreview";
import { StudyCardDetailModal } from "./StudyCardDetailModal";
import { StatsOverview } from "../Statistics/StatsOverview";
import { WeakPointAnalysis, type WeakPoint, type Prediction } from "./WeakPointAnalysis";
import type { ReviewForecast } from "../../hooks/queries/useStudyQueries";
import { useDebouncedSearch } from "../../hooks/common/useDebouncedSearch";
import {
  Trophy,
  Clock,
  Brain,
  Search,
  Play,
  LayoutGrid,
  BookOpen,
  Flame,
  Activity,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar,
  ListTree,
  Tags,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface Stats {
  total: number;
  mastered: number;
  due: number;
  distribution: {
    new: number;
    learning: number;
    review: number;
    relearning: number;
  };
}

interface CardReviewViewProps {
  isDark: boolean;
  isMobile: boolean;
  allCards: StudyCard[];
  dueCards: StudyCard[];
  stats: Stats;
  streakDays: number;
  weeklyStudyTime: number;
  weakPoints: WeakPoint[];
  predictions: Prediction[];
  forecast?: ReviewForecast;
  onStartQuiz: (mode: "all" | "due") => void;
  onPracticeCard: (card: StudyCard) => void;
}

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

export const CardReviewView = ({
  isDark,
  isMobile,
  allCards,
  dueCards,
  stats,
  streakDays,
  weeklyStudyTime,
  weakPoints,
  predictions,
  forecast,
  onStartQuiz,
  onPracticeCard,
}: CardReviewViewProps) => {
  const { t } = useTranslation();

  const { query: searchQuery, setQuery: setSearchQuery, debouncedQuery: debouncedSearchQuery } = useDebouncedSearch();
  const [tableMode, setTableMode] = useState<"due" | "all">("due");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;
  const [previewCard, setPreviewCard] = useState<StudyCard | null>(null);
  // 卡片列表视图：平铺（带分页） / 按知识图谱→知识点两级分组
  const [groupMode, setGroupMode] = useState(true);
  // 分组模式（大纲树）：选中的图谱/知识点，null 表示自动回退到第一个图谱
  const [selectedGraphKey, setSelectedGraphKey] = useState<string | null>(null);
  const [selectedPointKey, setSelectedPointKey] = useState<string | null>(null);
  // 大纲树中已展开的图谱（知识点为叶子节点，跟随图谱展开）
  const [expandedGraphs, setExpandedGraphs] = useState<Set<string>>(new Set());
  const didAutoExpandRef = useRef(false);

  const pieData = [
    {
      name: t("study.cardTypes.new"),
      value: stats.distribution.new,
      color: "#94a3b8",
    },
    {
      name: t("study.cardTypes.learning"),
      value: stats.distribution.learning,
      color: "#60a5fa",
    },
    {
      name: t("study.cardTypes.review"),
      value: stats.distribution.review,
      color: "#34d399",
    },
    {
      name: t("study.cardTypes.relearning"),
      value: stats.distribution.relearning,
      color: "#fbbf24",
    },
  ].filter((d) => d.value > 0);

  const tableCards = useMemo(
    () => (tableMode === "due" ? dueCards : allCards),
    [tableMode, dueCards, allCards],
  );

  const filteredCards = useMemo(() => {
    if (!debouncedSearchQuery) return tableCards;
    return tableCards.filter(
      (c) =>
        c.question.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        c.answer.toLowerCase().includes(debouncedSearchQuery.toLowerCase()),
    );
  }, [tableCards, debouncedSearchQuery]);

  const totalPages = Math.ceil(filteredCards.length / pageSize);
  const paginatedCards = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCards.slice(start, start + pageSize);
  }, [filteredCards, currentPage, pageSize]);

  const dueCardIdSet = useMemo(
    () => new Set(dueCards.map((c) => c.id)),
    [dueCards],
  );

  // 按「知识图谱 → 知识点」两级分组（基于 API 已携带的 graphTitle / knowledgePointTitle）
  const graphGroups = useMemo<GraphGroup[]>(() => {
    const graphMap = new Map<string, GraphGroup>();
    for (const card of filteredCards) {
      const graphKey = card.graph_id || card.source_graph_id || "unknown";
      const graphTitle = card.graphTitle || t("study.cardList.unknownGraph");
      let graph = graphMap.get(graphKey);
      if (!graph) {
        graph = { graphKey, graphTitle, cards: [], dueCount: 0, pointGroups: [] };
        graphMap.set(graphKey, graph);
      }
      graph.cards.push(card);
      if (dueCardIdSet.has(card.id)) graph.dueCount += 1;

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
  }, [filteredCards, t, dueCardIdSet]);

  // 分组模式下当前激活的图谱：选中项不存在时自动回退到第一个
  const activeGraph = useMemo<GraphGroup | null>(() => {
    if (graphGroups.length === 0) return null;
    return (
      graphGroups.find((g) => g.graphKey === selectedGraphKey) ?? graphGroups[0]
    );
  }, [graphGroups, selectedGraphKey]);

  // 分组模式下选中的知识点（仅当仍在激活图谱内才有效）
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

  // 前置计算每日最大复习数，避免在 forecast.daily.map 内对每个元素重复 Math.max（原为 O(n²)）
  const forecastMaxCount = useMemo(
    () => Math.max(...(forecast?.daily ?? []), 1),
    [forecast?.daily],
  );

  return (
    <>
      {/* Stats Cards & Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          <div
            className={`grid ${isMobile ? "grid-cols-3" : "grid-cols-3 sm:grid-cols-5"} gap-2 md:gap-3`}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`p-2 md:p-3 rounded-xl shadow-sm border flex items-center gap-1.5 md:gap-2 ${
                isDark
                  ? "bg-slate-800 border-slate-700"
                  : "bg-white border-gray-100 shadow-sm"
              }`}
            >
              <div
                className={`p-1.5 md:p-2 rounded-lg shrink-0 ${isDark ? "bg-primary-900/40 text-primary-400" : "bg-primary-50 text-primary-600"}`}
              >
                <LayoutGrid size={isMobile ? 16 : 18} />
              </div>
              <div className="min-w-0">
                <p
                  className={`text-[10px] md:text-xs font-medium whitespace-nowrap ${isDark ? "text-slate-400" : "text-gray-500"}`}
                >
                  {t("study.stats.totalCards")}
                </p>
                <p
                  className={`${isMobile ? "text-base" : "text-xl"} font-black`}
                >
                  {stats.total}
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className={`p-2 md:p-3 rounded-xl shadow-sm border flex items-center gap-1.5 md:gap-2 ${
                isDark
                  ? "bg-slate-800 border-slate-700"
                  : "bg-white border-gray-100 shadow-sm"
              }`}
            >
              <div
                className={`p-1.5 md:p-2 rounded-lg shrink-0 ${isDark ? "bg-emerald-900/40 text-emerald-400" : "bg-emerald-50 text-emerald-600"}`}
              >
                <Trophy size={isMobile ? 16 : 18} />
              </div>
              <div className="min-w-0">
                <p
                  className={`text-[10px] md:text-xs font-medium whitespace-nowrap ${isDark ? "text-slate-400" : "text-gray-500"}`}
                >
                  {t("study.stats.mastered")}
                </p>
                <p
                  className={`${isMobile ? "text-base" : "text-xl"} font-black`}
                >
                  {stats.mastered}
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`p-2 md:p-3 rounded-xl shadow-sm border flex items-center gap-1.5 md:gap-2 ${
                isDark
                  ? "bg-slate-800 border-slate-700"
                  : "bg-white border-gray-100 shadow-sm"
              }`}
            >
              <div
                className={`p-1.5 md:p-2 rounded-lg shrink-0 ${isDark ? "bg-amber-900/40 text-amber-400" : "bg-amber-50 text-amber-600"}`}
              >
                <Clock size={isMobile ? 16 : 18} />
              </div>
              <div className="min-w-0">
                <p
                  className={`text-[10px] md:text-xs font-medium whitespace-nowrap ${isDark ? "text-slate-400" : "text-gray-500"}`}
                >
                  {t("study.stats.due")}
                </p>
                <p
                  className={`${isMobile ? "text-base" : "text-xl"} font-black text-amber-500`}
                >
                  {stats.due}
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className={`p-2 md:p-3 rounded-xl shadow-sm border flex items-center gap-1.5 md:gap-2 ${isMobile ? "hidden sm:flex" : ""} ${
                isDark
                  ? "bg-slate-800 border-slate-700"
                  : "bg-white border-gray-100 shadow-sm"
              }`}
            >
              <div
                className={`p-1.5 md:p-2 rounded-lg shrink-0 ${isDark ? "bg-orange-900/40 text-orange-400" : "bg-orange-50 text-orange-600"}`}
              >
                <Flame size={isMobile ? 16 : 18} />
              </div>
              <div className="min-w-0">
                <p
                  className={`text-[10px] md:text-xs font-medium whitespace-nowrap ${isDark ? "text-slate-400" : "text-gray-500"}`}
                >
                  {t("study.stats.streak")}
                </p>
                <p
                  className={`${isMobile ? "text-base" : "text-xl"} font-black`}
                >
                  {streakDays}
                  {t("study.stats.days")}
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={`p-2 md:p-3 rounded-xl shadow-sm border flex items-center gap-1.5 md:gap-2 ${isMobile ? "hidden sm:flex" : ""} ${
                isDark
                  ? "bg-slate-800 border-slate-700"
                  : "bg-white border-gray-100 shadow-sm"
              }`}
            >
              <div
                className={`p-1.5 md:p-2 rounded-lg shrink-0 ${isDark ? "bg-primary-900/40 text-primary-400" : "bg-primary-50 text-primary-600"}`}
              >
                <Activity size={isMobile ? 16 : 18} />
              </div>
              <div className="min-w-0">
                <p
                  className={`text-[10px] md:text-xs font-medium whitespace-nowrap ${isDark ? "text-slate-400" : "text-gray-500"}`}
                >
                  {t("study.stats.weeklyStudy")}
                </p>
                <p
                  className={`${isMobile ? "text-base" : "text-xl"} font-black`}
                >
                  {Math.round(weeklyStudyTime / 60)}h
                </p>
              </div>
            </motion.div>
          </div>

          {/* Action Cards */}
          <div
            className={`grid grid-cols-1 ${isMobile ? "" : "md:grid-cols-2"} gap-4 md:gap-6`}
          >
            <motion.button
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              onClick={() => onStartQuiz("due")}
              disabled={dueCards.length === 0}
              className={`flex flex-col items-center text-center ${isMobile ? "p-5 rounded-2xl" : "p-8 rounded-[2.5rem]"} border-2 transition-all group relative overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${
                dueCards.length > 0
                  ? isDark
                    ? "bg-primary-900/20 border-primary-800/50 hover:border-primary-500 shadow-lg shadow-primary-900/20"
                    : "bg-primary-50 border-primary-100 hover:border-primary-400 shadow-xl shadow-primary-100/50"
                  : isDark
                    ? "bg-slate-800/50 border-slate-700 opacity-50 cursor-not-allowed"
                    : "bg-gray-50 border-gray-100 opacity-50 cursor-not-allowed"
              }`}
            >
              {dueCards.length > 0 && (
                <div className="absolute top-4 right-4 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-primary-500"></span>
                </div>
              )}
              <div
                className={`${isMobile ? "p-4 rounded-xl" : "p-6 rounded-[2rem]"} mb-3 md:mb-4 group-hover:scale-110 transition-transform duration-500 ${
                  isDark
                    ? "bg-primary-900/40 text-primary-400"
                    : "bg-white text-primary-600 shadow-md"
                }`}
              >
                <Brain size={isMobile ? 36 : 48} />
              </div>
              <h3
                className={`${isMobile ? "text-xl" : "text-2xl"} font-black mb-1 md:mb-2 ${isDark ? "text-primary-300" : "text-primary-900"}`}
              >
                {t("study.todayDue")}
              </h3>
              <p
                className={`mb-4 md:mb-8 max-w-[280px] ${isMobile ? "text-xs" : "text-sm"} font-medium ${isDark ? "text-primary-400/80" : "text-primary-700/70"}`}
              >
                {t("study.fsrsDescription")}
              </p>
              <div
                className={`${isMobile ? "px-5 py-2" : "px-8 py-3"} rounded-2xl font-black ${isMobile ? "text-base" : "text-lg"} transition-all ${
                  dueCards.length > 0
                    ? "bg-primary-600 text-white shadow-lg shadow-primary-300 group-hover:bg-primary-700 group-hover:-translate-y-1"
                    : "bg-gray-300 text-gray-500"
                }`}
              >
                {dueCards.length > 0
                  ? t("study.startNow", { count: dueCards.length })
                  : t("study.noReviewTasks")}
              </div>
            </motion.button>

            <motion.button
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
              onClick={() => onStartQuiz("all")}
              disabled={allCards.length === 0}
              className={`flex flex-col items-center text-center ${isMobile ? "p-5 rounded-2xl" : "p-8 rounded-[2.5rem]"} border-2 transition-all group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${
                allCards.length > 0
                  ? isDark
                    ? "bg-slate-800 border-slate-700 hover:border-primary-500 shadow-lg"
                    : "bg-white border-gray-100 hover:border-primary-400 shadow-xl shadow-gray-100/50"
                  : isDark
                    ? "bg-slate-800/50 border-slate-700 opacity-50 cursor-not-allowed"
                    : "bg-gray-50 border-gray-100 opacity-50 cursor-not-allowed"
              }`}
            >
              <div
                className={`${isMobile ? "p-4 rounded-xl" : "p-6 rounded-[2rem]"} mb-3 md:mb-4 group-hover:scale-110 transition-transform duration-500 ${
                  isDark
                    ? "bg-slate-700 text-slate-300"
                    : "bg-gray-50 text-gray-600"
                }`}
              >
                <Play size={isMobile ? 36 : 48} />
              </div>
              <h3
                className={`${isMobile ? "text-xl" : "text-2xl"} font-black mb-1 md:mb-2`}
              >
                {t("study.freePractice")}
              </h3>
              <p
                className={`mb-4 md:mb-8 max-w-[280px] ${isMobile ? "text-xs" : "text-sm"} font-medium ${isDark ? "text-slate-400" : "text-gray-500"}`}
              >
                {t("study.freePracticeDescription")}
              </p>
              <div
                className={`${isMobile ? "px-5 py-2" : "px-8 py-3"} rounded-2xl font-black ${isMobile ? "text-base" : "text-lg"} transition-all ${
                  allCards.length > 0
                    ? isDark
                      ? "bg-slate-700 text-white border border-slate-600 group-hover:bg-slate-600 group-hover:-translate-y-1"
                      : "bg-white text-gray-700 border-2 border-gray-100 shadow-sm group-hover:border-primary-200 group-hover:-translate-y-1"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {allCards.length > 0
                  ? t("study.startSelfTest", { count: allCards.length })
                  : t("study.noCards")}
              </div>
            </motion.button>
          </div>

          {/* Review Forecast */}
          {forecast && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className={`p-4 md:p-5 rounded-2xl border ${
                isDark
                  ? "bg-slate-800 border-slate-700"
                  : "bg-white border-gray-100 shadow-sm"
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <Calendar
                  size={isMobile ? 16 : 18}
                  className={
                    isDark ? "text-primary-400" : "text-primary-600"
                  }
                />
                <h3
                  className={`text-sm md:text-base font-bold ${
                    isDark ? "text-slate-200" : "text-gray-800"
                  }`}
                >
                  {t("study.forecast.title")}
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-3 md:gap-4">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs md:text-sm ${
                      isDark ? "text-slate-400" : "text-gray-500"
                    }`}
                  >
                    {t("study.forecast.tomorrow")}
                  </span>
                  <span
                    className={`text-lg md:text-xl font-black ${
                      forecast.tomorrow > 0
                        ? isDark
                          ? "text-amber-400"
                          : "text-amber-600"
                        : isDark
                          ? "text-slate-500"
                          : "text-gray-400"
                    }`}
                  >
                    {forecast.tomorrow}
                  </span>
                  <span
                    className={`text-xs ${
                      isDark ? "text-slate-500" : "text-gray-400"
                    }`}
                  >
                    {t("study.forecast.cards")}
                  </span>
                </div>
                <div
                  className={`h-6 w-px ${isDark ? "bg-slate-700" : "bg-gray-200"}`}
                />
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs md:text-sm ${
                      isDark ? "text-slate-400" : "text-gray-500"
                    }`}
                  >
                    {t("study.forecast.thisWeek")}
                  </span>
                  <span
                    className={`text-lg md:text-xl font-black ${
                      isDark ? "text-primary-400" : "text-primary-600"
                    }`}
                  >
                    {forecast.thisWeek}
                  </span>
                  <span
                    className={`text-xs ${
                      isDark ? "text-slate-500" : "text-gray-400"
                    }`}
                  >
                    {t("study.forecast.cards")}
                  </span>
                </div>
              </div>
              {/* 7-day bar summary */}
              {forecast.thisWeek > 0 && (
                <div className="flex items-end gap-1 mt-3 h-12">
                  {forecast.daily.map((count, idx) => {
                    const maxCount = forecastMaxCount;
                    const heightPct = Math.max(
                      (count / maxCount) * 100,
                      count > 0 ? 8 : 2,
                    );
                    return (
                      <div
                        key={idx}
                        className="flex-1 flex flex-col items-center gap-1"
                        title={t("study.forecast.dayTooltip", {
                          day: idx + 1,
                          count,
                        })}
                      >
                        <div
                          className={`w-full rounded-t transition-all ${
                            count > 0
                              ? isDark
                                ? "bg-primary-500"
                                : "bg-primary-400"
                              : isDark
                                ? "bg-slate-700"
                                : "bg-gray-100"
                          }`}
                          style={{ height: `${heightPct}%` }}
                        />
                        <span
                          className={`text-[9px] md:text-[10px] ${
                            isDark ? "text-slate-500" : "text-gray-400"
                          }`}
                        >
                          {count > 0 ? count : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </div>

        {/* Chart */}
        <div
          className={`lg:col-span-1 ${isMobile ? "hidden lg:block" : ""}`}
        >
          <StatsOverview data={pieData} />
        </div>
      </div>

      {/* Health Insights */}
      <WeakPointAnalysis
        isDark={isDark}
        weakPoints={weakPoints}
        predictions={predictions}
      />

      {/* Cards List Section */}
      <section className="space-y-4 md:space-y-5" aria-labelledby="study-card-list-heading">
        <div
          className={`flex ${isMobile ? "flex-col gap-3" : "flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4"}`}
        >
          {/* LEFT: Title + scope tabs (visually coupled because tabs are this list's view state) */}
          <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3 min-w-0">
            <h2
              id="study-card-list-heading"
              className={`flex shrink-0 items-center gap-2 ${isMobile ? "text-lg" : "text-xl"} font-bold`}
            >
              <BookOpen
                className="text-primary-500"
                size={isMobile ? 20 : 22}
                aria-hidden="true"
              />
              {t("study.cardList.title")}
            </h2>

            <div
              role="tablist"
              aria-label={t('study.cardList.filterByStatus')}
              className={`flex p-1 rounded-xl ${isMobile ? "w-full sm:w-fit" : "w-fit"} ${isDark ? "bg-slate-800" : "bg-gray-100"}`}
            >
              <button
                role="tab"
                aria-selected={tableMode === "due"}
                type="button"
                onClick={() => { setTableMode("due"); setCurrentPage(1); }}
                className={`flex-1 min-w-[84px] px-3 md:px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${
                  tableMode === "due"
                    ? isDark
                      ? "bg-primary-600 text-white shadow-md shadow-primary-900/30"
                      : "bg-white text-primary-600 shadow-sm"
                    : isDark
                      ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                      : "text-gray-500 hover:text-gray-700 hover:bg-white/60"
                }`}
              >
                {t("study.cardList.due")}
                <span
                  aria-hidden="true"
                  className={`ml-1.5 text-[11px] font-bold tabular-nums ${
                    tableMode === "due"
                      ? isDark ? "text-primary-100" : "text-primary-500"
                      : isDark ? "text-slate-500" : "text-gray-400"
                  }`}
                >
                  {dueCards.length}
                </span>
              </button>
              <button
                role="tab"
                aria-selected={tableMode === "all"}
                type="button"
                onClick={() => { setTableMode("all"); setCurrentPage(1); }}
                className={`flex-1 min-w-[84px] px-3 md:px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${
                  tableMode === "all"
                    ? isDark
                      ? "bg-primary-600 text-white shadow-md shadow-primary-900/30"
                      : "bg-white text-primary-600 shadow-sm"
                    : isDark
                      ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                      : "text-gray-500 hover:text-gray-700 hover:bg-white/60"
                }`}
              >
                {t("study.cardList.all")}
                <span
                  aria-hidden="true"
                  className={`ml-1.5 text-[11px] font-bold tabular-nums ${
                    tableMode === "all"
                      ? isDark ? "text-primary-100" : "text-primary-500"
                      : isDark ? "text-slate-500" : "text-gray-400"
                  }`}
                >
                  {allCards.length}
                </span>
              </button>
            </div>
          </div>

          {/* RIGHT: view toggle + Search */}
          <div className="flex w-full flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 md:w-auto">
            <div
              role="group"
              aria-label={t('study.cardList.toggleGroupMode')}
              className={`flex p-1 rounded-xl ${isMobile ? "w-full" : "w-fit"} ${isDark ? "bg-slate-800" : "bg-gray-100"}`}
            >
              <button
                type="button"
                aria-pressed={groupMode === false}
                onClick={() => setGroupMode(false)}
                className={`flex-1 sm:flex-none min-w-[64px] flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${
                  groupMode === false
                    ? isDark
                      ? "bg-primary-600 text-white shadow-md shadow-primary-900/30"
                      : "bg-white text-primary-600 shadow-sm"
                    : isDark
                      ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                      : "text-gray-500 hover:text-gray-700 hover:bg-white/60"
                }`}
              >
                <LayoutGrid size={15} aria-hidden="true" />
                {t("study.cardList.flatView")}
              </button>
              <button
                type="button"
                aria-pressed={groupMode === true}
                onClick={() => setGroupMode(true)}
                className={`flex-1 sm:flex-none min-w-[64px] flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${
                  groupMode === true
                    ? isDark
                      ? "bg-primary-600 text-white shadow-md shadow-primary-900/30"
                      : "bg-white text-primary-600 shadow-sm"
                    : isDark
                      ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                      : "text-gray-500 hover:text-gray-700 hover:bg-white/60"
                }`}
              >
                <ListTree size={15} aria-hidden="true" />
                {t("study.cardList.groupView")}
              </button>
            </div>

            <div
              role="search"
              aria-label={t('common.aria.searchWithTarget', { target: t('study.cardList.title') })}
              className="relative w-full md:w-auto md:min-w-[220px]"
            >
              <Search
                className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? "text-slate-500" : "text-gray-400"}`}
                size={16}
                aria-hidden="true"
              />
              <input
                type="text"
                placeholder={t("study.cardList.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className={`w-full pl-9 pr-4 py-2 rounded-xl text-sm border focus:ring-2 focus:ring-primary-500 outline-none transition-all ${
                  isDark
                    ? "bg-slate-800 border-slate-700 text-white placeholder-slate-500"
                    : "bg-white border-gray-200 text-gray-900 shadow-sm placeholder-gray-400"
                }`}
              />
            </div>
          </div>
        </div>

          {groupMode ? (
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 md:gap-6 items-start">
            {graphGroups.length === 0 ? (
              <div
                className={`py-12 text-center rounded-3xl border-2 border-dashed ${
                  isDark
                    ? "border-slate-800 text-slate-500"
                    : "border-gray-200 text-gray-400"
                }`}
              >
                <Search className="mx-auto mb-3 opacity-20" size={48} />
                <p className="mb-4">{t("study.cardList.noCardsFound")}</p>
                <div className="flex items-center justify-center gap-3">
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setCurrentPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${
                        isDark
                          ? "border-slate-600 text-slate-300 hover:bg-slate-800"
                          : "border-gray-300 text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      {t("study.cardList.clearSearch")}
                    </button>
                  )}
                  {tableMode === "due" && (
                    <button
                      onClick={() => {
                        setTableMode("all");
                        setCurrentPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${
                        isDark
                          ? "border-primary-700 text-primary-400 hover:bg-primary-900/30"
                          : "border-primary-300 text-primary-600 hover:bg-primary-50"
                      }`}
                    >
                      {t("study.cardList.switchToAll")}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
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
                            dueCardIdSet.has(c.id),
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
                                  isDark
                                    ? "border-slate-700"
                                    : "border-gray-100"
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
                                      onPreview={setPreviewCard}
                                      onPractice={onPracticeCard}
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
              </>
            )}
          </div>
        ) : (
        <motion.div
          className={`grid ${isMobile ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"} gap-3 md:gap-4`}
        >
          <AnimatePresence mode="popLayout">
          {paginatedCards.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`col-span-full py-12 text-center rounded-3xl border-2 border-dashed ${
                isDark
                  ? "border-slate-800 text-slate-500"
                  : "border-gray-200 text-gray-400"
              }`}
            >
              <Search className="mx-auto mb-3 opacity-20" size={48} />
              <p className="mb-4">{t("study.cardList.noCardsFound")}</p>
              <div className="flex items-center justify-center gap-3">
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${
                      isDark
                        ? "border-slate-600 text-slate-300 hover:bg-slate-800"
                        : "border-gray-300 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {t("study.cardList.clearSearch")}
                  </button>
                )}
                {tableMode === "due" && (
                  <button
                    onClick={() => {
                      setTableMode("all");
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${
                      isDark
                        ? "border-primary-700 text-primary-400 hover:bg-primary-900/30"
                        : "border-primary-300 text-primary-600 hover:bg-primary-50"
                    }`}
                  >
                    {t("study.cardList.switchToAll")}
                  </button>
                )}
              </div>
            </motion.div>
          ) : (
            paginatedCards.map((card, index) => (
              <motion.div
                key={card.id}
                layout
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50, transition: { duration: 0.15 } }}
                transition={{ delay: index * 0.03, duration: 0.25 }}
                className="h-full"
              >
                <StudyCardPreview
                  card={card}
                  isDark={isDark}
                  onPreview={setPreviewCard}
                  onPractice={onPracticeCard}
                />
              </motion.div>
            ))
          )}
          </AnimatePresence>
        </motion.div>
        )}

        {/* Pagination Controls (flat mode only) */}
        {!groupMode && totalPages > 1 && (
          <nav
            aria-label={t("common.aria.pagination")}
            className={`flex items-center justify-center gap-1 md:gap-2 mt-6 md:mt-8`}
          >
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              aria-label={t("common.aria.previousPage")}
              aria-disabled={currentPage === 1 ? "true" : undefined}
              className={`min-w-[44px] min-h-[44px] flex items-center justify-center ${isMobile ? "p-3" : "p-2"} rounded-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${
                currentPage === 1
                  ? "opacity-30 cursor-not-allowed"
                  : isDark
                    ? "hover:bg-slate-800 text-slate-300"
                    : "hover:bg-gray-100 text-gray-600"
              }`}
            >
              <ChevronLeft size={isMobile ? 24 : 20} aria-hidden="true" />
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (page) => {
                  if (
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1)
                  ) {
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        aria-current={currentPage === page ? "page" : undefined}
                        aria-label={t("common.aria.page", { number: page })}
                        className={`${isMobile ? "w-11 h-11 text-base" : "w-10 h-10 text-sm"} rounded-xl font-bold transition-all min-w-[44px] min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${
                          currentPage === page
                            ? "bg-primary-600 text-white shadow-lg shadow-primary-200"
                            : isDark
                              ? "hover:bg-slate-800 text-slate-400"
                              : "hover:bg-gray-100 text-gray-500"
                        }`}
                      >
                        {page}
                      </button>
                    );
                  } else if (
                    (page === currentPage - 2 && page > 1) ||
                    (page === currentPage + 2 && page < totalPages)
                  ) {
                    return (
                      <span key={page} className="px-1 text-slate-400">
                        ...
                      </span>
                    );
                  }
                  return null;
                },
              )}
            </div>

            <button
              onClick={() =>
                setCurrentPage((p) => Math.min(totalPages, p + 1))
              }
              disabled={currentPage === totalPages}
              aria-label={t("common.aria.nextPage")}
              aria-disabled={currentPage === totalPages ? "true" : undefined}
              className={`min-w-[44px] min-h-[44px] flex items-center justify-center ${isMobile ? "p-3" : "p-2"} rounded-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 ${
                currentPage === totalPages
                  ? "opacity-30 cursor-not-allowed"
                  : isDark
                    ? "hover:bg-slate-800 text-slate-300"
                    : "hover:bg-gray-100 text-gray-600"
              }`}
            >
              <ChevronRight size={isMobile ? 24 : 20} aria-hidden="true" />
            </button>
          </nav>
        )}
      </section>

      {/* Card Preview Modal */}
      <StudyCardDetailModal
        card={previewCard}
        isOpen={!!previewCard}
        onClose={() => setPreviewCard(null)}
        isDark={isDark}
        onPractice={onPracticeCard}
      />
    </>
  );
};
