import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { StudyCard } from "@shared/types";
import { AlertCircle, Check, X, BookOpen, ChevronUp, ChevronDown } from "lucide-react";
import { normalizeBooleanAnswer } from "../../utils/textUtils";
import { useQuizSettingsStore } from "../../store/useQuizSettingsStore";
import { resolveSecondaryTextStyle } from "../../utils/quizTypography";
import { useVoiceDictation } from "../../hooks/common/useVoiceDictation";
import {
  countClozeBlanks,
  isMatchingCorrect,
  isOrderingCorrect,
} from "../../utils/quizNewTypes";
import {
  VoiceDictationButton,
  VoiceEngineToggle,
  VoiceDictationControl,
} from "./common";

/**
 * QuizOptionArea 组件 Props
 * 负责 6 种题型的选项渲染与提交按钮
 */
interface QuizOptionAreaProps {
  /** 当前学习卡片 */
  currentCard: StudyCard;
  /** 当前题型选项数组 */
  currentOptions: string[];
  /** 是否 QA 题型 */
  isQA: boolean;
  /** 是否单选题型 */
  isChoice: boolean;
  /** 是否多选题型 */
  isMultiChoice: boolean;
  /** 是否判断题型 */
  isTrueFalse: boolean;
  /** 是否填空题型 */
  isFillBlank: boolean;
  /** 是否简答题型 */
  isEssay: boolean;
  /** 是否完形填空题型 */
  isCloze: boolean;
  /** 是否选词填空题型 */
  isSelectFromOptions: boolean;
  /** 是否匹配连线题型 */
  isMatching: boolean;
  /** 是否排序题型 */
  isOrdering: boolean;
  /** 多选已选集合 */
  selectedSet: Set<string>;
  /** 多选正确答案集合 */
  correctSet: Set<string>;
  /** 是否显示答案 */
  showAnswer: boolean;
  /** 单选/判断题选中项 */
  selectedOption: string | null;
  /** 单选/判断题点击回调 */
  onOptionClick: (option: string) => void;
  /** 多选题点击回调 */
  onMultiOptionClick: (option: string) => void;
  /** 是否暗色模式 */
  isDark: boolean;
  /** 是否移动端 */
  isMobile: boolean;
  /** 设置 showAnswer 的回调，用于提交按钮内部 */
  onSetShowAnswer: (show: boolean) => void;
}

/**
 * QuizOptionArea
 * 负责 6 种题型的选项渲染（choice/multi_choice/true_false/fill_in_the_blank/qa/essay）
 * 以及 showAnswer=false 时的提交按钮逻辑
 */
export function QuizOptionArea({
  currentCard,
  currentOptions,
  isQA,
  isChoice,
  isMultiChoice,
  isTrueFalse,
  isFillBlank,
  isEssay,
  isCloze,
  isSelectFromOptions,
  isMatching,
  isOrdering,
  selectedSet,
  correctSet,
  showAnswer,
  selectedOption,
  onOptionClick,
  onMultiOptionClick,
  isDark,
  isMobile,
  onSetShowAnswer,
}: QuizOptionAreaProps) {
  const { t } = useTranslation();

  const { fontSize, lineHeight } = useQuizSettingsStore(
    useShallow((s) => ({
      fontSize: s.fontSize,
      lineHeight: s.lineHeight,
    })),
  );
  const secondaryTextStyle = resolveSecondaryTextStyle(fontSize, lineHeight);

  /** 完形填空：用户的逐空输入 */
  const [clozeInputs, setClozeInputs] = useState<string[]>([]);
  /** 匹配连线：left -> right 配对；以及当前选中的左列项 */
  const [matchingPairs, setMatchingPairs] = useState<Record<string, string | undefined>>({});
  const [matchingSelectedLeft, setMatchingSelectedLeft] = useState<string | null>(null);
  /** 排序：当前顺序 */
  const [order, setOrder] = useState<string[]>([]);

  /** QA/简答/填空题的文字作答 */
  const [textAnswer, setTextAnswer] = useState("");
  /** 完形填空语音听写的目标空格索引（null 表示无） */
  const [activeClozeIdx, setActiveClozeIdx] = useState<number | null>(null);
  /** 听写发起时的卡片 id，切卡后到达的转写结果据此丢弃 */
  const textVoiceCardIdRef = useRef<string | null>(null);
  const clozeVoiceCardIdRef = useRef<string | null>(null);
  const activeClozeIdxRef = useRef<number | null>(null);

  const handleTextVoiceValue = useCallback(
    (next: string) => {
      if (textVoiceCardIdRef.current !== currentCard.id) return;
      setTextAnswer(next);
    },
    [currentCard.id],
  );
  const textDictation = useVoiceDictation(textAnswer, handleTextVoiceValue);

  const handleClozeVoiceValue = useCallback(
    (next: string) => {
      const idx = activeClozeIdxRef.current;
      if (idx === null || clozeVoiceCardIdRef.current !== currentCard.id) return;
      setClozeInputs((prev) => {
        const nextInputs = [...prev];
        nextInputs[idx] = next;
        return nextInputs;
      });
    },
    [currentCard.id],
  );
  const activeClozeValue = activeClozeIdx !== null ? clozeInputs[activeClozeIdx] ?? "" : "";
  const clozeDictation = useVoiceDictation(activeClozeValue, handleClozeVoiceValue);

  const handleTextMicToggle = () => {
    if (!textDictation.isListening && !textDictation.isTranscribing && !textDictation.isConnecting) {
      textVoiceCardIdRef.current = currentCard.id;
    }
    void textDictation.toggleListening();
  };

  const handleTextEngineToggle = () => {
    textDictation.setEngine(textDictation.engine === "realtime" ? "file" : "realtime");
  };

  const handleClozeMicToggle = (idx: number) => {
    const isSameTarget =
      activeClozeIdxRef.current === idx && clozeVoiceCardIdRef.current === currentCard.id;
    if (clozeDictation.isListening && isSameTarget) {
      void clozeDictation.toggleListening();
      return;
    }
    if (clozeDictation.isListening || clozeDictation.isTranscribing || clozeDictation.isConnecting) return;
    activeClozeIdxRef.current = idx;
    clozeVoiceCardIdRef.current = currentCard.id;
    setActiveClozeIdx(idx);
    void clozeDictation.toggleListening();
  };

  const handleClozeEngineToggle = () => {
    clozeDictation.setEngine(clozeDictation.engine === "realtime" ? "file" : "realtime");
  };

  // 切卡时停止正在进行的录音，避免结果串到下一题
  const textDictationRef = useRef(textDictation);
  useEffect(() => {
    textDictationRef.current = textDictation;
  }, [textDictation]);
  const clozeDictationRef = useRef(clozeDictation);
  useEffect(() => {
    clozeDictationRef.current = clozeDictation;
  }, [clozeDictation]);

  /** 匹配连线的候选右列项（从 answer JSON 去重提取） */
  const rightOptions = useMemo(() => {
    if (!currentCard.answer) return [];
    try {
      const parsed = JSON.parse(currentCard.answer) as unknown;
      if (!Array.isArray(parsed)) return [];
      const rights = parsed
        .map((p) => (p as { right?: unknown })?.right)
        .filter((v): v is string => typeof v === "string");
      return Array.from(new Set(rights));
    } catch {
      return [];
    }
  }, [currentCard.answer]);

  /** 匹配连线：left -> 正确 right（用于展示对错） */
  const expectedRightByLeft = useMemo(() => {
    const map: Record<string, string> = {};
    try {
      const parsed = JSON.parse(currentCard.answer ?? "") as unknown;
      if (Array.isArray(parsed)) {
        parsed.forEach((p) => {
          const item = p as { left?: unknown; right?: unknown };
          if (typeof item.left === "string" && typeof item.right === "string") {
            map[item.left] = item.right;
          }
        });
      }
    } catch {
      // ignore parse errors
    }
    return map;
  }, [currentCard.answer]);

  // 当前卡片变化时重置本地交互状态
  useEffect(() => {
    void textDictationRef.current.stopListening();
    void clozeDictationRef.current.stopListening();
    setClozeInputs(new Array(countClozeBlanks(currentCard.question)).fill(""));
    setMatchingPairs({});
    setMatchingSelectedLeft(null);
    setOrder(currentOptions);
    setTextAnswer("");
    setActiveClozeIdx(null);
    activeClozeIdxRef.current = null;
  }, [currentCard, currentOptions]);

  const updateClozeInput = (idx: number, value: string) => {
    setClozeInputs((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  };

  const handleMatchingLeftClick = (left: string) => {
    if (showAnswer) return;
    setMatchingSelectedLeft((prev) => (prev === left ? null : left));
  };

  const handleMatchingRightClick = (right: string) => {
    if (showAnswer || !matchingSelectedLeft) return;
    setMatchingPairs((prev) => ({
      ...prev,
      [matchingSelectedLeft]: prev[matchingSelectedLeft] === right ? undefined : right,
    }));
    setMatchingSelectedLeft(null);
  };

  const moveOrderItem = (idx: number, dir: "up" | "down") => {
    if (showAnswer) return;
    const target = dir === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= order.length) return;
    setOrder((prev) => {
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const matchingIsCorrect = isMatching
    ? isMatchingCorrect(currentCard.answer, matchingPairs)
    : false;

  return (
    <div className="w-full pb-4 md:pb-6">
      {(isChoice || isSelectFromOptions) && currentOptions.length > 0 && (
        <div className="flex flex-col gap-2 md:gap-2 mt-3 md:mt-4">
          {currentOptions.map((option: string, idx: number) => {
            const isSelected = selectedOption === option;
            const isCorrect = option === currentCard.answer;

            let btnClass = `group ${isMobile ? "p-3.5" : "p-3"} rounded-xl border transition-all duration-200 relative flex items-start gap-3 shadow-sm `;
            if (showAnswer) {
              if (isCorrect)
                {btnClass += isDark
                  ? "bg-gradient-to-r from-emerald-900/30 to-emerald-900/10 border-emerald-500 text-emerald-400 shadow-md"
                  : "bg-gradient-to-r from-emerald-100 to-emerald-50 border-emerald-400 text-emerald-700 shadow-md";}
              else if (isSelected)
                {btnClass += isDark
                  ? "bg-gradient-to-r from-red-900/30 to-red-900/10 border-red-500 text-red-400 shadow-md"
                  : "bg-gradient-to-r from-red-100 to-red-50 border-red-400 text-red-700 shadow-md";}
              else
                {btnClass += isDark
                  ? "bg-slate-800/50 border-slate-700 text-slate-500"
                  : "bg-gray-50 border-gray-200 text-gray-400";}
            } else {
              btnClass += isDark
                ? "bg-gradient-to-r from-slate-800 to-slate-800/50 border-slate-700 hover:from-primary-900/30 hover:to-slate-800/50 hover:border-primary-500 cursor-pointer text-slate-200 hover:shadow-md"
                : "bg-gradient-to-r from-white to-slate-50 border-slate-200 hover:from-primary-50 hover:to-white hover:border-primary-300 cursor-pointer text-gray-700 hover:shadow-md";
            }

            return (
              <button
                key={idx}
                onClick={() => onOptionClick(option)}
                disabled={showAnswer}
                className={btnClass}
              >
                <span
                  className={`flex-shrink-0 ${isMobile ? "w-8 h-8" : "w-7 h-7"} rounded-lg flex items-center justify-center font-bold ${isMobile ? "text-base" : "text-sm"} transition-all ${
                    isSelected
                      ? "bg-primary-500 text-white shadow-sm scale-105"
                      : isDark
                        ? "bg-slate-700 text-slate-400 group-hover:bg-slate-600"
                        : "bg-slate-100 text-slate-500 group-hover:bg-primary-100 group-hover:text-primary-600"
                  }`}
                >
                  {String.fromCharCode(65 + idx)}
                </span>
                <span
                  className={`flex-1 ${isMobile ? "text-base" : "text-sm"} font-medium leading-snug`}
                  style={secondaryTextStyle}
                >
                  {option.replace(/^[A-Z]\.\s*/, "")}
                </span>
                {showAnswer && isCorrect && (
                  <Check
                    className="text-emerald-500 flex-shrink-0"
                    size={isMobile ? 20 : 18}
                  />
                )}
                {showAnswer && isSelected && !isCorrect && (
                  <X
                    className="text-red-500 flex-shrink-0"
                    size={isMobile ? 20 : 18}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {isMultiChoice && currentOptions.length > 0 && (
        <div className="flex flex-col gap-2 md:gap-2 mt-3 md:mt-4">
          {currentOptions.map((option: string, idx: number) => {
            const isSelected = selectedSet.has(option);
            const isCorrect = correctSet.has(option);

            let btnClass = `group ${isMobile ? "p-3.5" : "p-3"} rounded-xl border transition-all duration-200 relative flex items-start gap-3 shadow-sm `;
            if (showAnswer) {
              if (isCorrect)
                {btnClass += isDark
                  ? "bg-gradient-to-r from-emerald-900/30 to-emerald-900/10 border-emerald-500 text-emerald-400 shadow-md"
                  : "bg-gradient-to-r from-emerald-100 to-emerald-50 border-emerald-400 text-emerald-700 shadow-md";}
              else if (isSelected)
                {btnClass += isDark
                  ? "bg-gradient-to-r from-red-900/30 to-red-900/10 border-red-500 text-red-400 shadow-md"
                  : "bg-gradient-to-r from-red-100 to-red-50 border-red-400 text-red-700 shadow-md";}
              else
                {btnClass += isDark
                  ? "bg-slate-800/50 border-slate-700 text-slate-500"
                  : "bg-gray-50 border-gray-200 text-gray-400";}
            } else {
              btnClass += isSelected
                ? isDark
                  ? "bg-gradient-to-r from-primary-900/40 to-primary-900/20 border-primary-500 text-primary-300 shadow-md"
                  : "bg-gradient-to-r from-primary-100 to-primary-50 border-primary-400 text-primary-700 shadow-md"
                : isDark
                  ? "bg-gradient-to-r from-slate-800 to-slate-800/50 border-slate-700 hover:from-primary-900/30 hover:to-slate-800/50 hover:border-primary-500 cursor-pointer text-slate-200 hover:shadow-md"
                  : "bg-gradient-to-r from-white to-slate-50 border-slate-200 hover:from-primary-50 hover:to-white hover:border-primary-300 cursor-pointer text-gray-700 hover:shadow-md";
            }

            return (
              <button
                key={idx}
                onClick={() => onMultiOptionClick(option)}
                disabled={showAnswer}
                className={btnClass}
              >
                <span
                  className={`flex-shrink-0 ${isMobile ? "w-8 h-8" : "w-7 h-7"} rounded-lg flex items-center justify-center font-bold ${isMobile ? "text-base" : "text-sm"} transition-all ${
                    isSelected
                      ? "bg-primary-500 text-white shadow-sm scale-105"
                      : isDark
                        ? "bg-slate-700 text-slate-400 group-hover:bg-slate-600"
                        : "bg-slate-100 text-slate-500 group-hover:bg-primary-100 group-hover:text-primary-600"
                  }`}
                >
                  {String.fromCharCode(65 + idx)}
                </span>
                <span
                  className={`flex-1 ${isMobile ? "text-base" : "text-sm"} font-medium leading-snug`}
                  style={secondaryTextStyle}
                >
                  {option.replace(/^[A-Z]\.\s*/, "")}
                </span>
                {showAnswer && isCorrect && (
                  <Check
                    className="text-emerald-500 flex-shrink-0"
                    size={isMobile ? 20 : 18}
                  />
                )}
                {showAnswer && isSelected && !isCorrect && (
                  <X
                    className="text-red-500 flex-shrink-0"
                    size={isMobile ? 20 : 18}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {isTrueFalse && (
        <div
          className={`flex ${isMobile ? "flex-col gap-3" : "flex-col md:flex-row gap-3"} justify-center mt-3 md:mt-4`}
        >
          {(["True", "False"] as const).map((option) => {
            const isSelected = selectedOption === option;
            const correctAnswer = normalizeBooleanAnswer(currentCard.answer);
            const isCorrect = option === correctAnswer;

            let btnClass = `group flex-1 ${isMobile ? "p-5" : "p-4"} rounded-xl border transition-all duration-200 font-bold ${isMobile ? "text-lg" : "text-base"} relative flex flex-col items-center justify-center gap-2 shadow-sm `;
            if (showAnswer) {
              if (isCorrect)
                {btnClass += isDark
                  ? "bg-gradient-to-r from-emerald-900/30 to-emerald-900/10 border-emerald-500 text-emerald-400 shadow-md"
                  : "bg-gradient-to-r from-emerald-100 to-emerald-50 border-emerald-400 text-emerald-700 shadow-md";}
              else if (isSelected)
                {btnClass += isDark
                  ? "bg-gradient-to-r from-red-900/30 to-red-900/10 border-red-500 text-red-400 shadow-md"
                  : "bg-gradient-to-r from-red-100 to-red-50 border-red-400 text-red-700 shadow-md";}
              else
                {btnClass += isDark
                  ? "bg-slate-800/50 border-slate-700 text-slate-500"
                  : "bg-gray-50 border-gray-200 text-gray-400";}
            } else {
              btnClass += isDark
                ? "bg-gradient-to-r from-slate-800 to-slate-800/50 border-slate-700 hover:from-primary-900/30 hover:to-slate-800/50 hover:border-primary-500 cursor-pointer text-slate-200 hover:shadow-md"
                : "bg-gradient-to-r from-white to-slate-50 border-slate-200 hover:from-primary-50 hover:to-white hover:border-primary-300 cursor-pointer text-gray-700 hover:shadow-md";
            }

            return (
              <button
                key={option}
                onClick={() => onOptionClick(option)}
                disabled={showAnswer}
                className={btnClass}
              >
                <span
                  className={`${isMobile ? "text-xl" : "text-lg"} font-bold`}
                >
                  {option === "True" ? "TRUE" : "FALSE"}
                </span>
                <span
                  className={`text-xs opacity-60 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                >
                  {option === "True"
                    ? t("study.quiz.correct")
                    : t("study.quiz.incorrect")}
                </span>
                {showAnswer && isCorrect && (
                  <Check
                    className="text-emerald-500 absolute top-3 right-3"
                    size={isMobile ? 20 : 16}
                  />
                )}
                {showAnswer && isSelected && !isCorrect && (
                  <X
                    className="text-red-500 absolute top-3 right-3"
                    size={isMobile ? 20 : 16}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {isCloze && (
        <div className="flex flex-col gap-3 mt-3 md:mt-4">
          {!showAnswer && clozeDictation.hasSupport && (
            <div className="flex items-center justify-end gap-1.5">
              <VoiceEngineToggle
                isDark={isDark}
                engine={clozeDictation.engine}
                onToggle={handleClozeEngineToggle}
              />
              <span
                className={`text-xs ${isDark ? "text-slate-500" : "text-gray-400"}`}
              >
                {clozeDictation.engine === "realtime"
                  ? t("study.quiz.voiceRealtimeActive")
                  : t("study.quiz.voiceFileMode")}
              </span>
            </div>
          )}
          {clozeInputs.map((value, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span
                className={`flex-shrink-0 ${isMobile ? "w-8 h-8" : "w-7 h-7"} rounded-lg flex items-center justify-center font-bold ${isMobile ? "text-base" : "text-sm"} ${isDark ? "bg-slate-700 text-slate-400" : "bg-slate-100 text-slate-500"}`}
              >
                {idx + 1}
              </span>
              <input
                type="text"
                value={value}
                disabled={showAnswer}
                onChange={(e) => updateClozeInput(idx, e.target.value)}
                className={`flex-1 px-3 py-2.5 rounded-xl border text-sm font-medium outline-none transition-colors ${isMobile ? "text-base" : "text-sm"} ${isDark ? "bg-slate-800 border-slate-700 text-slate-200 focus:border-primary-500" : "bg-white border-gray-200 text-gray-800 focus:border-primary-400"} disabled:opacity-60`}
                placeholder={`${t("study.quiz.fillContent")} ${idx + 1}`}
              />
              {!showAnswer && clozeDictation.hasSupport && (
                <VoiceDictationButton
                  isDark={isDark}
                  engine={clozeDictation.engine}
                  isListening={clozeDictation.isListening && activeClozeIdx === idx}
                  isTranscribing={clozeDictation.isTranscribing && activeClozeIdx === idx}
                  isConnecting={clozeDictation.isConnecting && activeClozeIdx === idx}
                  disabled={showAnswer || (clozeDictation.isListening && activeClozeIdx !== idx)}
                  onToggle={() => handleClozeMicToggle(idx)}
                />
              )}
            </div>
          ))}
          {!showAnswer && clozeDictation.hasSupport && (clozeDictation.isConnecting || clozeDictation.isListening || clozeDictation.error) && (
            <div
              className={`flex items-center gap-1.5 text-xs ${
                clozeDictation.error
                  ? isDark ? "text-red-400" : "text-red-600"
                  : isDark ? "text-slate-400" : "text-slate-500"
              }`}
              role={clozeDictation.error ? "alert" : undefined}
              aria-live="polite"
              aria-atomic="true"
            >
              {clozeDictation.error ? (
                <>
                  <AlertCircle size={14} aria-hidden="true" />
                  {clozeDictation.error}
                </>
              ) : clozeDictation.isConnecting ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  {t("study.quiz.voiceConnecting")}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  {t("study.quiz.voiceListening")}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {(isQA || isEssay) && (
        <div className="mt-3 md:mt-4">
          <div
            className={`rounded-xl border transition-colors ${isDark ? "bg-slate-800 border-slate-700 focus-within:border-primary-500" : "bg-white border-gray-200 focus-within:border-primary-400"} ${showAnswer ? "opacity-60" : ""}`}
          >
            <textarea
              value={textAnswer}
              disabled={showAnswer}
              onChange={(e) => setTextAnswer(e.target.value)}
              rows={isMobile ? 3 : 4}
              placeholder={t("study.quiz.yourAnswer")}
              aria-label={t("study.quiz.yourAnswer")}
              className={`w-full bg-transparent resize-none outline-none px-3 pt-2.5 pb-1 font-medium ${isMobile ? "text-base" : "text-sm"} ${isDark ? "text-slate-200 placeholder-slate-500" : "text-gray-800 placeholder-gray-400"}`}
            />
            <div className="flex items-center justify-end gap-2 px-2 pb-2">
              {!showAnswer && textDictation.hasSupport && (
                <VoiceDictationControl
                  isDark={isDark}
                  engine={textDictation.engine}
                  isListening={textDictation.isListening}
                  isTranscribing={textDictation.isTranscribing}
                  isConnecting={textDictation.isConnecting}
                  error={textDictation.error}
                  hasSupport={textDictation.hasSupport}
                  onToggle={handleTextMicToggle}
                  onToggleEngine={handleTextEngineToggle}
                  className="items-end"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {isFillBlank && !showAnswer && (
        <div className="mt-3 md:mt-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={textAnswer}
              onChange={(e) => setTextAnswer(e.target.value)}
              className={`flex-1 px-3 py-2.5 rounded-xl border text-sm font-medium outline-none transition-colors ${isMobile ? "text-base" : "text-sm"} ${isDark ? "bg-slate-800 border-slate-700 text-slate-200 focus:border-primary-500" : "bg-white border-gray-200 text-gray-800 focus:border-primary-400"}`}
              placeholder={t("study.quiz.fillContent")}
              aria-label={t("study.quiz.fillContent")}
            />
            {textDictation.hasSupport && (
              <VoiceDictationControl
                isDark={isDark}
                engine={textDictation.engine}
                isListening={textDictation.isListening}
                isTranscribing={textDictation.isTranscribing}
                isConnecting={textDictation.isConnecting}
                error={textDictation.error}
                hasSupport={textDictation.hasSupport}
                onToggle={handleTextMicToggle}
                onToggleEngine={handleTextEngineToggle}
              />
            )}
          </div>
        </div>
      )}

      {isMatching && (
        <div className="flex flex-col gap-3 mt-3 md:mt-4">
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            <div className="flex flex-col gap-2">
              {currentOptions.map((left, idx) => {
                const isSelected = matchingSelectedLeft === left;
                const isPaired = matchingPairs[left] !== undefined && matchingPairs[left] !== "";
                const isRowCorrect = matchingPairs[left] === expectedRightByLeft[left];
                let btnClass = `group ${isMobile ? "p-3" : "p-2.5"} rounded-xl border transition-all duration-200 relative flex items-center gap-2 shadow-sm text-left `;
                if (!showAnswer) {
                  btnClass += isSelected
                    ? isDark
                      ? "bg-gradient-to-r from-primary-900/40 to-primary-900/20 border-primary-500 text-primary-300 shadow-md cursor-pointer"
                      : "bg-gradient-to-r from-primary-100 to-primary-50 border-primary-400 text-primary-700 shadow-md cursor-pointer"
                    : isPaired
                      ? isDark
                        ? "bg-slate-800 border-slate-600 text-slate-200"
                        : "bg-slate-50 border-slate-300 text-gray-700"
                      : isDark
                        ? "bg-gradient-to-r from-slate-800 to-slate-800/50 border-slate-700 hover:border-primary-500 cursor-pointer text-slate-200"
                        : "bg-gradient-to-r from-white to-slate-50 border-slate-200 hover:border-primary-300 cursor-pointer text-gray-700";
                } else {
                  btnClass += isRowCorrect
                    ? isDark
                      ? "bg-emerald-900/30 border-emerald-500 text-emerald-400"
                      : "bg-emerald-50 border-emerald-400 text-emerald-700"
                    : isPaired
                      ? isDark
                        ? "bg-red-900/30 border-red-500 text-red-400"
                        : "bg-red-50 border-red-400 text-red-700"
                      : isDark
                        ? "bg-slate-800/50 border-slate-700 text-slate-500"
                        : "bg-gray-50 border-gray-200 text-gray-400";
                }
                return (
                  <button
                    key={left}
                    onClick={() => handleMatchingLeftClick(left)}
                    disabled={showAnswer}
                    className={btnClass}
                  >
                    <span
                      className={`flex-shrink-0 ${isMobile ? "w-7 h-7" : "w-6 h-6"} rounded-md flex items-center justify-center font-bold text-xs ${isDark ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-500"}`}
                    >
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="flex-1 text-sm font-medium leading-snug" style={secondaryTextStyle}>
                      {left}
                    </span>
                    {showAnswer && isRowCorrect && <Check className="text-emerald-500 flex-shrink-0" size={18} />}
                    {showAnswer && isPaired && !isRowCorrect && <X className="text-red-500 flex-shrink-0" size={18} />}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col gap-2">
              {rightOptions.map((right) => {
                const usedBy = Object.entries(matchingPairs).find(([, v]) => v === right)?.[0];
                return (
                  <button
                    key={right}
                    onClick={() => handleMatchingRightClick(right)}
                    disabled={showAnswer || !matchingSelectedLeft}
                    className={`group p-2.5 rounded-xl border transition-all duration-200 relative flex items-center gap-2 shadow-sm text-left ${isMobile ? "p-3" : "p-2.5"} ${usedBy ? (isDark ? "bg-slate-800 border-slate-600 text-slate-300" : "bg-slate-50 border-slate-300 text-gray-600") : isDark ? "bg-gradient-to-r from-slate-800 to-slate-800/50 border-slate-700 hover:border-primary-500 text-slate-300" : "bg-gradient-to-r from-white to-slate-50 border-slate-200 hover:border-primary-300 text-gray-600"} ${!showAnswer && matchingSelectedLeft && !usedBy ? "cursor-pointer" : "opacity-60"}`}
                  >
                    {usedBy && (
                      <span className={`flex-shrink-0 ${isMobile ? "w-6 h-6" : "w-5 h-5"} rounded-md flex items-center justify-center font-bold text-xs ${isDark ? "bg-primary-900/50 text-primary-300" : "bg-primary-100 text-primary-600"}`}>
                        {String.fromCharCode(65 + currentOptions.indexOf(usedBy))}
                      </span>
                    )}
                    <span className="flex-1 text-sm font-medium leading-snug" style={secondaryTextStyle}>
                      {right}
                    </span>
                    {usedBy && !showAnswer && (
                      <X
                        className="text-slate-400 flex-shrink-0"
                        size={18}
                        onClick={(e) => {
                          e.stopPropagation();
                          setMatchingPairs((prev) => ({ ...prev, [usedBy]: undefined }));
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          {showAnswer && (
            <div
              className={`text-center text-sm font-medium ${isDark ? "text-slate-400" : "text-gray-500"}`}
            >
              {matchingIsCorrect ? (
                <span className={isDark ? "text-emerald-400" : "text-emerald-600"}>{t("study.quiz.correct")}</span>
              ) : (
                <span className={isDark ? "text-red-400" : "text-red-600"}>{t("study.quiz.incorrect")}</span>
              )}
            </div>
          )}
        </div>
      )}

      {isOrdering && order.length > 0 && (
        <div className="flex flex-col gap-2 mt-3 md:mt-4">
          {order.map((item, idx) => (
            <div
              key={item}
              className={`flex items-center gap-2 ${isMobile ? "p-3" : "p-2.5"} rounded-xl border shadow-sm ${isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-gray-200 text-gray-700"}`}
            >
              <span
                className={`flex-shrink-0 ${isMobile ? "w-7 h-7" : "w-6 h-6"} rounded-md flex items-center justify-center font-bold text-xs ${isDark ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-500"}`}
              >
                {idx + 1}
              </span>
              <span className="flex-1 text-sm font-medium leading-snug" style={secondaryTextStyle}>
                {item}
              </span>
              {!showAnswer && (
                <div className="flex flex-col gap-0.5 flex-shrink-0">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveOrderItem(idx, "up")}
                    className={`p-1 rounded-md transition-colors ${idx === 0 ? "opacity-30 cursor-not-allowed" : isDark ? "hover:bg-slate-700 text-slate-300" : "hover:bg-gray-100 text-gray-500"}`}
                    aria-label={t("study.quiz.prevCard")}
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    type="button"
                    disabled={idx === order.length - 1}
                    onClick={() => moveOrderItem(idx, "down")}
                    className={`p-1 rounded-md transition-colors ${idx === order.length - 1 ? "opacity-30 cursor-not-allowed" : isDark ? "hover:bg-slate-700 text-slate-300" : "hover:bg-gray-100 text-gray-500"}`}
                    aria-label={t("study.quiz.nextCard")}
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}
          {showAnswer && (
            <div
              className={`text-center text-sm font-medium ${isDark ? "text-slate-400" : "text-gray-500"}`}
            >
              {isOrderingCorrect(currentCard.answer, order) ? (
                <span className={isDark ? "text-emerald-400" : "text-emerald-600"}>{t("study.quiz.correct")}</span>
              ) : (
                <span className={isDark ? "text-red-400" : "text-red-600"}>{t("study.quiz.incorrect")}</span>
              )}
            </div>
          )}
        </div>
      )}

      {!showAnswer && (
        <div className="w-full mt-4 md:mt-6">
          {isQA || isEssay || isFillBlank || isCloze || isMatching || isOrdering ? (
            <button
              onClick={() => onSetShowAnswer(true)}
              className={`w-full ${isMobile ? "py-4" : "py-4"} bg-primary-600 text-white rounded-2xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-200 flex items-center justify-center gap-2`}
            >
              <BookOpen size={isMobile ? 22 : 20} />
              <span className={isMobile ? "text-lg" : ""}>
                {t("study.quiz.showAnswer")}
              </span>
            </button>
          ) : isMultiChoice ? (
            <button
              onClick={() => onSetShowAnswer(true)}
              disabled={!selectedOption || selectedSet.size === 0}
              className={`w-full ${isMobile ? "py-4" : "py-4"} bg-primary-600 text-white rounded-2xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-200 disabled:opacity-50 disabled:shadow-none ${isMobile ? "text-lg" : ""}`}
            >
              {t("study.quiz.submitAnswer")}
            </button>
          ) : (
            <div
              className={`text-center py-4 ${isMobile ? "text-base" : "text-sm"} font-medium ${isDark ? "text-slate-500" : "text-gray-400"}`}
            >
              {t("study.quiz.selectOption")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
