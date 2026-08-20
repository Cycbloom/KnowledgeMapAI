import { useTranslation } from "react-i18next";
import { StudyCard } from "@shared/types";
import { Check, ThumbsUp, ThumbsDown } from "lucide-react";
import { useUpdateCardProgressMutation } from "../../hooks/mutations";

/**
 * 进度更新 Mutation 类型，从 useUpdateCardProgressMutation 返回值推导
 */
type UpdateProgressMutation = ReturnType<typeof useUpdateCardProgressMutation>;

/**
 * QuizRatingBar 组件 Props
 * 底部记忆程度 4 按钮评级组 + spinner + disabled/correctSet 判定
 */
interface QuizRatingBarProps {
  /** 多选正确答案集合（用于后续判定正确率等） */
  correctSet: Set<string>;
  /** 是否多选题型 */
  isMultiChoice: boolean;
  /** 当前学习卡片 */
  currentCard: StudyCard;
  /** 单选/判断题选中项 */
  selectedOption: string | null;
  /** 是否显示答案（showAnswer=false 时不渲染） */
  showAnswer: boolean;
  /** 进度更新 Mutation 对象 */
  updateProgressMutation: UpdateProgressMutation;
  /** 是否暗色模式 */
  isDark: boolean;
  /** 是否移动端 */
  isMobile: boolean;
  /** 评分回调函数，参数为 quality: 1|2|3|4 */
  onRate: (quality: number) => void;
}

/**
 * QuizRatingBar
 * 底部记忆程度 4 按钮评级组 + spinner + disabled/correctSet 判定
 * 此组件同时被 Flash 与 Focus 布局调用
 */
export function QuizRatingBar({
  correctSet,
  isMultiChoice,
  currentCard,
  selectedOption,
  showAnswer,
  updateProgressMutation,
  isDark,
  isMobile,
  onRate,
}: QuizRatingBarProps) {
  const { t } = useTranslation();

  void correctSet;
  void isMultiChoice;
  void currentCard;
  void selectedOption;

  if (!showAnswer) {
    return null;
  }

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
      <div
        className={`grid ${isMobile ? "grid-cols-4 gap-2" : "grid-cols-2 md:grid-cols-4 gap-3"}`}
      >
        <button
          onClick={() => onRate(1)}
          className={`relative flex flex-col items-center justify-center ${isMobile ? "py-2.5 px-1" : "py-3"} rounded-xl font-bold transition-all ${
            isDark
              ? "bg-red-900/20 text-red-400 hover:bg-red-900/40"
              : "bg-red-50 text-red-700 hover:bg-red-100"
          }`}
          disabled={updateProgressMutation.isPending}
        >
          <span
            className={`absolute top-1 right-1 ${isMobile ? "text-[9px]" : "text-[10px]"} font-bold opacity-60 px-1 rounded ${isDark ? "bg-slate-900/40" : "bg-white/60"}`}
          >
            1
          </span>
          <ThumbsDown
            size={isMobile ? 16 : 16}
            className={isMobile ? "mb-1" : "mb-1"}
          />
          <span className={isMobile ? "text-xs" : "text-xs"}>
            {t("study.rating.again")}
          </span>
        </button>
        <button
          onClick={() => onRate(2)}
          className={`relative flex flex-col items-center justify-center ${isMobile ? "py-2.5 px-1" : "py-3"} rounded-xl font-bold transition-all ${
            isDark
              ? "bg-orange-900/20 text-orange-400 hover:bg-orange-900/40"
              : "bg-orange-50 text-orange-700 hover:bg-orange-100"
          }`}
          disabled={updateProgressMutation.isPending}
        >
          <span
            className={`absolute top-1 right-1 ${isMobile ? "text-[9px]" : "text-[10px]"} font-bold opacity-60 px-1 rounded ${isDark ? "bg-slate-900/40" : "bg-white/60"}`}
          >
            2
          </span>
          <span className={isMobile ? "text-xs" : "text-xs"}>
            {t("study.rating.hard")}
          </span>
        </button>
        <button
          onClick={() => onRate(3)}
          className={`relative flex flex-col items-center justify-center ${isMobile ? "py-2.5 px-1" : "py-3"} rounded-xl font-bold transition-all ${
            isDark
              ? "bg-primary-900/20 text-primary-400 hover:bg-primary-900/40"
              : "bg-primary-50 text-primary-700 hover:bg-primary-100"
          }`}
          disabled={updateProgressMutation.isPending}
        >
          <span
            className={`absolute top-1 right-1 ${isMobile ? "text-[9px]" : "text-[10px]"} font-bold opacity-60 px-1 rounded ${isDark ? "bg-slate-900/40" : "bg-white/60"}`}
          >
            3
          </span>
          <ThumbsUp
            size={isMobile ? 16 : 16}
            className={isMobile ? "mb-1" : "mb-1"}
          />
          <span className={isMobile ? "text-xs" : "text-xs"}>
            {t("study.rating.good")}
          </span>
        </button>
        <button
          onClick={() => onRate(4)}
          className={`relative flex flex-col items-center justify-center ${isMobile ? "py-2.5 px-1" : "py-3"} rounded-xl font-bold transition-all ${
            isDark
              ? "bg-emerald-900/20 text-emerald-400 hover:bg-emerald-900/40"
              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          }`}
          disabled={updateProgressMutation.isPending}
        >
          <span
            className={`absolute top-1 right-1 ${isMobile ? "text-[9px]" : "text-[10px]"} font-bold opacity-60 px-1 rounded ${isDark ? "bg-slate-900/40" : "bg-white/60"}`}
          >
            4
          </span>
          <span className={isMobile ? "text-xs" : "text-xs"}>
            {t("study.rating.easy")}
          </span>
        </button>
      </div>
    </div>
  );
}
