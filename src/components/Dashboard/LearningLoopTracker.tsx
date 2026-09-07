import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { RefreshCw, ArrowRight, LucideIcon } from "lucide-react";
import { api } from "../../services/api";
import { useTheme } from "../../hooks";
import { Skeleton } from "../common";
import type { ActiveLoopInfo } from "@shared/types";
import type { LoopStage } from "@shared/types/scheduler-study";

const LOOP_STAGES: LoopStage[] = ["learn", "test", "review"];

const STAGE_META: Record<LoopStage, { icon: LucideIcon; color: string }> = {
  learn: { icon: RefreshCw, color: "bg-primary-500" },
  test: { icon: ArrowRight, color: "bg-amber-500" },
  review: { icon: ArrowRight, color: "bg-indigo-500" },
  iterate: { icon: ArrowRight, color: "bg-green-500" },
};

const StageFlow = ({
  current,
  isDark,
}: {
  current: LoopStage;
  isDark: boolean;
}) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {LOOP_STAGES.map((stage, idx) => {
        const active = stage === current;
        const done = LOOP_STAGES.indexOf(current) > idx;
        const meta = STAGE_META[stage];
        return (
          <div key={stage} className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                active
                  ? `${meta.color} text-white`
                  : done
                    ? isDark
                      ? "bg-slate-700 text-slate-300"
                      : "bg-gray-100 text-gray-600"
                    : isDark
                      ? "bg-slate-800 text-slate-500 border border-slate-700"
                      : "bg-white text-gray-400 border border-gray-200"
              }`}
            >
              <meta.icon size={11} />
              {t(`dashboard.learningLoop.stage.${stage}`)}
            </span>
            {idx < LOOP_STAGES.length - 1 && (
              <span className={`text-xs ${isDark ? "text-slate-600" : "text-gray-300"}`}>→</span>
            )}
          </div>
        );
      })}
    </div>
  );
};

export const LearningLoopTracker: React.FC = () => {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery<ActiveLoopInfo[]>({
    queryKey: ["learning-loops", "list"],
    queryFn: () => api.scheduler.listActiveLearningLoops(),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-6 w-40 rounded-lg" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
    );
  }
  if (!data || data.length === 0) return null;

  const openLoop = (loop: ActiveLoopInfo) => {
    const params = new URLSearchParams();
    if (loop.knowledgePointId) params.set("node_id", loop.knowledgePointId);
    if (loop.graphId) params.set("graph_id", loop.graphId);
    navigate(`/learning?${params.toString()}`);
  };

  return (
    <div className={`p-4 md:p-5 rounded-xl shadow-sm border ${isDark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-100"}`}>
      <h3 className={`text-base md:text-lg font-bold ${isDark ? "text-white" : "text-gray-800"}`}>
        {t("dashboard.learningLoop.title")}
      </h3>
      <p className={`text-xs mt-0.5 mb-3 ${isDark ? "text-slate-400" : "text-gray-500"}`}>
        {t("dashboard.learningLoop.subtitle")}
      </p>
      <ul className="space-y-2">
        {data.map((loop) => (
          <li
            key={loop.id}
            className={isDark ? "bg-slate-700/40" : "bg-gray-50"}
          >
            <button
              type="button"
              onClick={() => openLoop(loop)}
              className={`w-full text-left p-3 rounded-xl border transition-colors cursor-pointer ${
                isDark
                  ? "border-slate-700 bg-slate-700/40 hover:bg-slate-700"
                  : "border-gray-100 bg-gray-50 hover:bg-gray-100"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className={`text-sm font-medium truncate ${isDark ? "text-slate-200" : "text-gray-800"}`}>
                  {loop.knowledgePointTitle || "Untitled"}
                </span>
                <span className={`text-[11px] flex-shrink-0 ${isDark ? "text-slate-400" : "text-gray-400"}`}>
                  {t("dashboard.learningLoop.loopCount", { count: loop.loopCount })}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <StageFlow current={loop.currentStage} isDark={isDark} />
                <span className={`text-[11px] flex-shrink-0 font-medium ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>
                  {t("dashboard.learningLoop.mastery", {
                    value: Math.round((loop.masteryLevel ?? 0) * 100),
                  })}
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
