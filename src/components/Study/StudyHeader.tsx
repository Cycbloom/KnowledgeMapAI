import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, LayoutGrid } from "lucide-react";

interface StudyHeaderProps {
  isDark: boolean;
  isMobile: boolean;
  graphId: string | null;
  nodeId: string | null;
  nodeIds: string | null;
  viewState: "dashboard" | "quiz" | "bank" | "focus" | "quizzes";
  setViewState: (state: "dashboard" | "quiz" | "bank" | "focus" | "quizzes") => void;
}

export const StudyHeader = ({
  isDark,
  isMobile,
  graphId,
  nodeId,
  nodeIds,
  viewState,
  setViewState,
}: StudyHeaderProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const tabs: Array<{
    key: "dashboard" | "bank" | "focus" | "quizzes";
    label: string;
  }> = [
    { key: "dashboard", label: t("study.tabs.overview") },
    { key: "bank", label: t("study.tabs.bank") },
    { key: "focus", label: t("study.tabs.focus") },
    { key: "quizzes", label: t("study.tabs.quizzes") },
  ];

  return (
    <div
      className={`flex items-center ${isMobile ? "flex-col gap-3" : "justify-between"}`}
    >
      <div
        className={`flex items-center ${isMobile ? "w-full" : "space-x-4"}`}
      >
        <button
          onClick={() => window.history.back()}
          className={`min-w-[44px] min-h-[44px] p-2 rounded-lg border transition-colors flex items-center justify-center ${
            isDark
              ? "bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300"
              : "bg-white border-gray-200 hover:bg-gray-50 text-gray-600"
          }`}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className={`${isMobile ? "text-lg" : "text-2xl"} font-bold`}>
            {t("study.title")}
          </h1>
          <p
            className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}
          >
            {nodeId
              ? t("study.mode.singlePoint")
              : nodeIds
                ? t("study.mode.pathTraining")
                : t("study.mode.fullReview")}
          </p>
        </div>
      </div>

      <div
        className={`flex items-center ${isMobile ? "w-full overflow-x-auto" : "space-x-2"}`}
      >
        <div
          className={`flex p-1 rounded-lg border ${isDark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-200"} ${isMobile ? "flex-1 min-w-0" : ""}`}
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setViewState(tab.key)}
              className={`min-h-[44px] px-2 md:px-3 py-1.5 rounded-md text-xs md:text-sm font-medium transition-colors ${
                viewState === tab.key
                  ? isDark
                    ? "bg-slate-700 text-white"
                    : "bg-gray-100 text-gray-900"
                  : isDark
                    ? "text-slate-400 hover:text-slate-300"
                    : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {graphId && (
          <button
            onClick={() => navigate(`/graph/${graphId}`)}
            className={`flex items-center space-x-2 px-3 md:px-4 py-2 rounded-lg transition-colors font-medium ${
              isMobile ? "shrink-0" : ""
            } ${
              isDark
                ? "bg-primary-900/40 text-primary-300 hover:bg-primary-900/60"
                : "bg-primary-50 text-primary-700 hover:bg-primary-100"
            }`}
          >
            <LayoutGrid size={18} />
            <span className={`${isMobile ? "hidden" : "inline"}`}>
              {t("study.enterGraph")}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
