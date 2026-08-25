import { useTranslation } from "react-i18next";
import {
  Check,
  ThumbsDown,
  Meh,
  ThumbsUp,
  Smile,
  type LucideIcon,
} from "lucide-react";
import { useUpdateCardProgressMutation } from "../../hooks/mutations";

/**
 * 进度更新 Mutation 类型，从 useUpdateCardProgressMutation 返回值推导
 */
type UpdateProgressMutation = ReturnType<typeof useUpdateCardProgressMutation>;

/**
 * QuizRatingBar 组件 Props
 * 底部记忆程度 4 按钮评级组 + spinner
 */
interface QuizRatingBarProps {
  /** 是否显示答案（showAnswer=false 时不渲染） */
  showAnswer: boolean;
  /** 进度更新 Mutation 对象 */
  updateProgressMutation: UpdateProgressMutation;
  /** 是否暗色模式 */
  isDark: boolean;
  /** 是否移动端 */
  isMobile: boolean;
  /** 客观对错判定（来自 QuizOptionArea），用于预选默认评分与提示 */
  autoVerdict?: "correct" | "incorrect" | null;
  /** 评分回调函数，参数为 quality: 1|2|3|4 */
  onRate: (quality: number) => void;
}

/**
 * QuizRatingBar
 * 底部记忆程度 4 按钮评级组 + spinner
 * 四按钮统一图标（拇指/表情语义），由 FSRS quality 1-4 驱动
 * 此组件同时被 Flash 与 Focus 布局调用
 */
export function QuizRatingBar({
  showAnswer,
  updateProgressMutation,
  isDark,
  isMobile,
  autoVerdict = null,
  onRate,
}: QuizRatingBarProps) {
  const { t } = useTranslation();

  if (!showAnswer) {
    return null;
  }

  // 依据客观对错映射到 FSRS 建议评分：答对→Good(3)，答错→Again(1)
  const suggestedQuality =
    autoVerdict === "correct" ? 3 : autoVerdict === "incorrect" ? 1 : null;

  const ratingButtons: Array<{
    quality: number;
    Icon: LucideIcon;
    label: string;
    classes: string;
  }> = [
    {
      quality: 1,
      Icon: ThumbsDown,
      label: t("study.rating.again"),
      classes: isDark
        ? "bg-red-900/20 text-red-400 hover:bg-red-900/40"
        : "bg-red-50 text-red-700 hover:bg-red-100",
    },
    {
      quality: 2,
      Icon: Meh,
      label: t("study.rating.hard"),
      classes: isDark
        ? "bg-orange-900/20 text-orange-400 hover:bg-orange-900/40"
        : "bg-orange-50 text-orange-700 hover:bg-orange-100",
    },
    {
      quality: 3,
      Icon: ThumbsUp,
      label: t("study.rating.good"),
      classes: isDark
        ? "bg-primary-900/20 text-primary-400 hover:bg-primary-900/40"
        : "bg-primary-50 text-primary-700 hover:bg-primary-100",
    },
    {
      quality: 4,
      Icon: Smile,
      label: t("study.rating.easy"),
      classes: isDark
        ? "bg-emerald-900/20 text-emerald-400 hover:bg-emerald-900/40"
        : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    },
  ];

  return (
    <div className="w-full">
      <div
        className={`flex items-center gap-2 mb-2 md:mb-3 text-slate-400 dark:text-slate-500`}
      >
        <Check size={14} />
        <h4 className="font-bold tracking-wider text-[10px] uppercase">
          {t("study.quiz.rateMemory")}
        </h4>
        {updateProgressMutation.isPending && (
          <span
            className="ml-1 inline-flex items-center gap-1.5 text-xs font-medium text-primary-500"
            role="status"
            aria-live="polite"
          >
            <span
              className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"
              aria-hidden="true"
            />
            {t("study.rating.submitting")}
          </span>
        )}
      </div>

      {autoVerdict && (
        <div
          className={`mb-2 flex items-center gap-2 rounded-lg px-2.5 py-1.5 ${
            autoVerdict === "correct"
              ? isDark
                ? "bg-emerald-900/30 text-emerald-300"
                : "bg-emerald-50 text-emerald-700"
              : isDark
                ? "bg-red-900/30 text-red-300"
                : "bg-red-50 text-red-700"
          }`}
          role="status"
          aria-live="polite"
        >
          {autoVerdict === "correct" ? (
            <Check size={13} aria-hidden="true" />
          ) : (
            <ThumbsDown size={13} aria-hidden="true" />
          )}
          <span className="text-xs font-medium">
            {autoVerdict === "correct"
              ? t("study.rating.judgedCorrect")
              : t("study.rating.judgedWrong")}
          </span>
          {suggestedQuality !== null && (
            <span
              className={`ml-auto inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded ${
                isDark ? "bg-slate-800/60 text-primary-300" : "bg-white/70 text-primary-600"
              }`}
            >
              {t("study.rating.suggested")}
            </span>
          )}
        </div>
      )}

      <div
        className={`grid ${isMobile ? "grid-cols-4 gap-2" : "grid-cols-2 md:grid-cols-4 gap-3"}`}
      >
        {ratingButtons.map(({ quality, Icon, label, classes }) => {
          const isSuggested = suggestedQuality === quality;
          const highlighted = isSuggested
            ? `${classes} ${isDark ? "ring-2 ring-primary-400" : "ring-2 ring-primary-500"}`
            : classes;
          return (
            <button
              key={quality}
              type="button"
              onClick={() => onRate(quality)}
              aria-label={label}
              aria-pressed={isSuggested}
              className={`relative flex flex-col items-center justify-center ${isMobile ? "py-2.5 px-1" : "py-3"} rounded-xl font-bold transition-all ${highlighted}`}
              disabled={updateProgressMutation.isPending}
            >
              <Icon size={isMobile ? 16 : 18} className="mb-1" />
              <span className={isMobile ? "text-xs" : "text-xs"}>{label}</span>
              {isSuggested && (
                <span
                  className={`absolute -top-1.5 -right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                    isDark ? "bg-primary-500 text-white" : "bg-primary-500 text-white"
                  }`}
                >
                  {t("study.rating.suggested")}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
