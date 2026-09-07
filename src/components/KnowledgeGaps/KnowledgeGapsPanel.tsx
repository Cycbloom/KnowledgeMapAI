import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ScanSearch,
  Loader2,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { ragApi, type AnalyzeGapsResponse } from "../../services/api/rag";
import { message } from "../../utils/messageHelper";

interface KnowledgeGapsPanelProps {
  graphId: string;
  /** 点击盲区条目时定位到对应知识点 */
  onNavigateToNode?: (nodeId: string) => void;
}

const PRIORITY_ORDER: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/**
 * 知识盲区分析面板：调用 /rag/analyze-gaps，展示
 * ① 孤立节点 / 缺失内容节点的盲区列表（可点击定位），
 * ② AI 建议补充的知识领域。
 */
export const KnowledgeGapsPanel: React.FC<KnowledgeGapsPanelProps> = ({
  graphId,
  onNavigateToNode,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeGapsResponse | null>(null);
  const [hasRun, setHasRun] = useState(false);

  const handleAnalyze = useCallback(async () => {
    if (!graphId) return;
    setLoading(true);
    try {
      const res = await ragApi.analyzeGaps(graphId);
      setResult(res);
      setHasRun(true);
    } catch (error) {
      console.error("Knowledge gaps analysis failed:", error);
      message.error(t("learning.knowledgeGaps.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [graphId, t]);

  const sortedGaps = result
    ? [...result.gaps].sort(
        (a, b) =>
          (PRIORITY_ORDER[a.priority] ?? 9) -
          (PRIORITY_ORDER[b.priority] ?? 9),
      )
    : [];

  return (
    <div className="p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <ScanSearch className="w-4 h-4 text-primary-600 dark:text-primary-400 shrink-0" />
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
            {t("learning.knowledgeGaps.title")}
          </span>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={loading || !graphId}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[36px]"
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <ScanSearch size={14} />
          )}
          {loading
            ? t("learning.knowledgeGaps.analyzing")
            : t("learning.knowledgeGaps.analyze")}
        </button>
      </div>

      {!hasRun && !loading && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          {t("learning.knowledgeGaps.subtitle")}
        </p>
      )}

      {loading && (
        <div
          className="flex items-center justify-center py-10 flex-1"
          aria-live="polite"
        >
          <Loader2 size={20} className="animate-spin text-primary-500" />
        </div>
      )}

      {hasRun && !loading && result && (
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4">
          {sortedGaps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {t("learning.knowledgeGaps.noGaps")}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedGaps.map((gap, idx) => {
                const isHigh = gap.priority === "high";
                const clickable = Boolean(
                  gap.knowledgePointId && onNavigateToNode,
                );
                return (
                  <button
                    key={`${gap.knowledgePointId ?? gap.topic}-${idx}`}
                    type="button"
                    disabled={!clickable}
                    onClick={() =>
                      gap.knowledgePointId && onNavigateToNode?.(gap.knowledgePointId)
                    }
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      isHigh
                        ? "border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/10"
                        : "border-orange-200 dark:border-orange-800/50 bg-orange-50 dark:bg-orange-900/10"
                    } ${clickable ? "hover:opacity-80 cursor-pointer" : "cursor-default"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {gap.topic || t("learning.knowledgeGaps.untitled")}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
                          gap.kind === "isolated"
                            ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                        }`}
                      >
                        {gap.kind === "isolated"
                          ? t("learning.knowledgeGaps.isolated")
                          : t("learning.knowledgeGaps.missingContent")}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                      <AlertTriangle size={11} className="shrink-0" />
                      <span className="truncate">{gap.reason}</span>
                      {clickable && (
                        <ArrowRight size={11} className="ml-auto shrink-0 opacity-60" />
                      )}
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          {result.suggestions.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Lightbulb className="w-4 h-4 text-yellow-500" />
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {t("learning.knowledgeGaps.suggestions")}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {result.suggestions.map((s, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 text-xs rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border border-primary-100 dark:border-primary-800"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default KnowledgeGapsPanel;
