import React, { useState, useRef, useEffect, useCallback, useId, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  X,
  Send,
  Loader2,
  Sparkles,
  RefreshCw,
  Zap,
  Target,
  Check,
  Route,
  Clock,
  Mic,
  MicOff,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { learningPathsApi, type CrossGraphPathVariant } from "../../services/api/learningPaths";
import { api } from "../../services/api";
import { message } from "../../utils/messageHelper";
import { getErrorMessage } from "../../utils/errors";
import { useFocusTrap } from "../../hooks/common/useFocusTrap";
import { useEscapeKey } from "../../hooks/common/useEscapeKey";
import { useSpeechRecognition } from "../../hooks/common/useSpeechRecognition";
import { useGoalDialogVariantNotificationStore } from "../../store/useGoalDialogVariantNotificationStore";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

type WizardStep = 1 | 2 | 3 | 4;

/** 图谱地图选中上下文：用户在图谱地图上选中的图谱（节点）与领域 */
export interface GraphMapSelectionContext {
  selectedGraphs: Array<{ id: string; title: string }>;
  selectedDomains: Array<{ id: string; name: string }>;
}

interface GoalDrivenPathDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** 保存成功回调（pathId），由父级负责 invalidate + 跳转 */
  onSaved: (pathId: string) => void;
  /** 跳过对话，用规则算法快速生成 */
  onQuickGenerate?: () => void;
  /** 图谱地图选中上下文（选中的图谱/领域），作为学习路径创建的主要上下文 */
  context?: GraphMapSelectionContext;
  /** 后台生成候选路径任务的 id：由完成通知「继续」传入，打开后回填变体续接 */
  initialVariantTaskId?: string | null;
}

const EMPHASIS_LABEL_KEYS = {
  goal_oriented: "graphMap.crossGraph.goalDialog.emphasis.goalOriented",
  systematic: "graphMap.crossGraph.goalDialog.emphasis.systematic",
  quick_overview: "graphMap.crossGraph.goalDialog.emphasis.quickOverview",
} as const;

const EMPHASIS_COLORS: Record<string, string> = {
  goal_oriented: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  systematic: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  quick_overview: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

const STEP_TOTAL = 4;

export const GoalDrivenPathDialog: React.FC<GoalDrivenPathDialogProps> = ({
  isOpen,
  onClose,
  onSaved,
  onQuickGenerate,
  context,
  initialVariantTaskId,
}) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<WizardStep>(1);
  // Step1：学习目标
  const [suggestedGoals, setSuggestedGoals] = useState<string[]>([]);
  const [isLoadingSuggest, setIsLoadingSuggest] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState("");
  const [customGoal, setCustomGoal] = useState("");
  // Step2：对话细化（可选）
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState("");
  // Step3：候选路径
  const [variants, setVariants] = useState<CrossGraphPathVariant[] | null>(null);
  const [isGeneratingVariants, setIsGeneratingVariants] = useState(false);
  const [isLoadingVariantsFromTask, setIsLoadingVariantsFromTask] =
    useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  // Step4：保存
  const [dailyMinutes, setDailyMinutes] = useState(30);
  const [isSaving, setIsSaving] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // 直接跟随地图上的实时选中：用户在地图上点选/切换节点或领域时，对话框上下文同步更新
  const activeContext = context ?? { selectedGraphs: [], selectedDomains: [] };
  const hasActiveContext =
    activeContext.selectedGraphs.length > 0 ||
    activeContext.selectedDomains.length > 0;

  // 语音输入（文件转写 STT）：录音 → 后端转写 → transcript 追加到输入框
  const {
    isListening,
    isTranscribing,
    transcript,
    error: sttError,
    startListening,
    stopListening,
    resetTranscript,
    hasRecognitionSupport,
  } = useSpeechRecognition();

  const prevTranscriptRef = useRef("");
  // 转写结果追加到哪个输入框：Step1 自定义目标 / Step2 对话输入（录音开始时定格）
  const transcriptTargetRef = useRef<"customGoal" | "chatInput">("chatInput");

  const appendTranscript = useCallback((target: "customGoal" | "chatInput") => {
    if (transcript && transcript !== prevTranscriptRef.current) {
      const newPart = transcript.slice(prevTranscriptRef.current.length);
      if (newPart) {
        if (target === "customGoal") {
          setCustomGoal((prev) => {
            const separator = prev.trim() ? " " : "";
            const next = prev + separator + newPart.trim();
            if (next.trim()) setSelectedGoal("");
            return next;
          });
        } else {
          setInputValue((prev) => {
            const separator = prev.trim() ? " " : "";
            return prev + separator + newPart.trim();
          });
        }
      }
      prevTranscriptRef.current = transcript;
      resetTranscript();
    }
  }, [transcript, resetTranscript]);

  useEffect(() => {
    appendTranscript(transcriptTargetRef.current);
  }, [appendTranscript]);

  useEffect(() => {
    if (!isListening) {
      prevTranscriptRef.current = "";
    }
  }, [isListening]);

  const handleMicClick = useCallback((target: "customGoal" | "chatInput") => {
    if (isListening) {
      void stopListening();
    } else if (!isTranscribing) {
      transcriptTargetRef.current = target;
      void startListening();
    }
  }, [isListening, isTranscribing, stopListening, startListening]);

  // 打开面板时初始化向导
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setMessages([]);
      setSelectedGoal("");
      setCustomGoal("");
      setVariants(null);
      setSelectedVariantId(null);
      setInputValue("");
      setIsStreaming(false);
      setIsGeneratingVariants(false);
      setIsSaving(false);
      setSessionId(crypto.randomUUID());
      suggestSeqRef.current++;
      loadedContextSignatureRef.current = contextSignature;
      void loadSuggestedGoals();
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // 打开面板时若带后台任务 id（完成通知「继续」进来的）：从任务 output_data
  // 回填候选路径并直接跳到变体选择步骤续接（无需重走 Step1/Step2）
  useEffect(() => {
    if (!isOpen || !initialVariantTaskId) return;
    let cancelled = false;
    setIsLoadingVariantsFromTask(true);
    (async () => {
      try {
        const task = (await api.ai.getTaskStatus(initialVariantTaskId)) as {
          status?: string;
          output_data?: { variants?: CrossGraphPathVariant[] };
        };
        if (cancelled) return;
        const list = Array.isArray(task?.output_data?.variants)
          ? task.output_data.variants
          : [];
        if (list.length > 0) {
          setVariants(list);
          setSelectedVariantId(null);
          setStep(3);
        } else if (task?.status === "failed") {
          message.error(
            t("graphMap.crossGraph.goalDialog.generationFailed"),
          );
        } else {
          message.info(
            t("graphMap.crossGraph.goalDialog.variantStillGenerating"),
          );
        }
      } catch (error: unknown) {
        if (cancelled) return;
        const errMsg =
          getErrorMessage(error) ||
          t("graphMap.crossGraph.goalDialog.loadVariantsFailed");
        message.error(errMsg);
      } finally {
        if (!cancelled) setIsLoadingVariantsFromTask(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, initialVariantTaskId, t]);

  // 建议请求序号守卫：丢弃过期响应（用户快速切换节点时，旧请求可能后到）
  const suggestSeqRef = useRef(0);
  const loadSuggestedGoals = useCallback(async () => {
    const seq = ++suggestSeqRef.current;
    setIsLoadingSuggest(true);
    try {
      const result = await learningPathsApi.suggestGoals({
        selected_graph_ids: activeContext.selectedGraphs.map((g) => g.id),
        selected_domain_ids: activeContext.selectedDomains.map((d) => d.id),
      });
      if (seq !== suggestSeqRef.current) return; // 过期响应丢弃
      setSuggestedGoals(result.data.suggestedGoals);
    } catch (error: unknown) {
      if (seq !== suggestSeqRef.current) return;
      setSuggestedGoals([]);
      const errMsg =
        getErrorMessage(error) ||
        t("graphMap.crossGraph.goalDialog.suggestFailed");
      message.error(errMsg);
    } finally {
      if (seq === suggestSeqRef.current) setIsLoadingSuggest(false);
    }
  }, [activeContext, t]);

  // 地图上选中内容变化时，Step1 防抖重新拉取建议，让建议跟随切换
  const contextSignature = useMemo(
    () =>
      [
        activeContext.selectedGraphs.map((g) => g.id).join(","),
        activeContext.selectedDomains.map((d) => d.id).join(","),
      ].join("|"),
    [activeContext],
  );
  const loadedContextSignatureRef = useRef("");

  useEffect(() => {
    if (!isOpen || step !== 1) return;
    if (loadedContextSignatureRef.current === contextSignature) return;
    loadedContextSignatureRef.current = contextSignature;
    const timer = setTimeout(() => {
      void loadSuggestedGoals();
    }, 500);
    return () => clearTimeout(timer);
  }, [contextSignature, isOpen, step, loadSuggestedGoals]);

  // 自动滚动到底部
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, variants]);

  const titleId = useId();
  const containerRef = useFocusTrap({ enabled: isOpen, restoreFocus: true });
  useEscapeKey(onClose, isOpen);

  const targetGoal = useCallback(() => {
    if (customGoal.trim()) return customGoal.trim();
    return selectedGoal;
  }, [customGoal, selectedGoal]);

  const conversationTranscript = useCallback(
    () => messages.filter((m) => m.role === "user").map((m) => m.content).join("\n"),
    [messages],
  );

  const canProceedFromStep1 =
    !isLoadingSuggest && (!!selectedGoal || customGoal.trim().length > 0);

  const handleNextFromStep1 = () => {
    setMessages([
      {
        role: "assistant",
        content: t("graphMap.crossGraph.goalDialog.welcome", {
          goal: targetGoal(),
        }),
      },
    ]);
    setStep(2);
  };

  const handleSend = async () => {
    const content = inputValue.trim();
    if (!content || isStreaming) return;

    const historyForApi = messages
      .slice(1)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [
      ...prev,
      { role: "user", content },
      { role: "assistant", content: "", isStreaming: true },
    ]);
    setInputValue("");
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await learningPathsApi.dialogStream(
        {
          message: content,
          history: historyForApi,
          session_id: sessionId,
          selected_graph_ids: activeContext.selectedGraphs.map((g) => g.id),
          selected_domain_ids: activeContext.selectedDomains.map((d) => d.id),
        },
        (chunk) => {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.role === "assistant") {
              next[next.length - 1] = { ...last, content: last.content + chunk };
            }
            return next;
          });
        },
        controller.signal,
      );
    } catch (error: unknown) {
      if (!controller.signal.aborted) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              getErrorMessage(error) ||
              t("graphMap.crossGraph.goalDialog.sendFailed"),
          },
        ]);
      }
    } finally {
      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1 && m.isStreaming
            ? { ...m, isStreaming: false }
            : m,
        ),
      );
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const handleGenerateVariants = async () => {
    if (isGeneratingVariants) return;
    setIsGeneratingVariants(true);
    try {
      const result = await learningPathsApi.generateVariantsBackground({
        target_goal: targetGoal(),
        conversation_transcript: conversationTranscript(),
        daily_time_minutes: dailyMinutes,
        variant_count: 3,
        selected_graph_ids: activeContext.selectedGraphs.map((g) => g.id),
        selected_domain_ids: activeContext.selectedDomains.map((d) => d.id),
      });
      // 交给后台任务执行并跟踪完成：可关闭面板，完成后右下角通知「继续」续接
      useGoalDialogVariantNotificationStore
        .getState()
        .startTracking(result.data.taskId);
      message.success(t("graphMap.crossGraph.goalDialog.submittedBackground"));
      onClose();
    } catch (error: unknown) {
      const errMsg =
        getErrorMessage(error) ||
        t("graphMap.crossGraph.goalDialog.generationFailed");
      message.error(errMsg);
    } finally {
      setIsGeneratingVariants(false);
    }
  };

  const handleSave = async () => {
    const selected = variants?.find((v) => v.id === selectedVariantId);
    if (!selected || isSaving) return;

    setIsSaving(true);
    try {
      const result = await learningPathsApi.saveVariant({
        variant: {
          id: selected.id,
          name: selected.name,
          description: selected.description,
          emphasis: selected.emphasis,
          stages: selected.stages.map((s) => ({
            graph_id: s.graphId,
            graph_title: s.graphTitle,
            order: s.order,
            priority: s.priority,
            reason: s.reason,
            estimated_time: s.estimatedTime,
          })),
        },
        target_goal: targetGoal(),
        daily_time_minutes: dailyMinutes,
      });
      onSaved(result.data.pathId);
    } catch (error: unknown) {
      const errMsg =
        getErrorMessage(error) || t("graphMap.crossGraph.goalDialog.saveFailed");
      message.error(errMsg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, x: 320 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 320 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-y-0 right-0 z-40 w-[440px] max-w-[92vw] bg-white dark:bg-slate-800 shadow-2xl border-l border-gray-200 dark:border-gray-700 flex flex-col"
      >
        {/* 头部：标题 + 步骤指示器 + 关闭 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary-500" aria-hidden="true" />
            <h2 id={titleId} className="text-base font-semibold text-gray-900 dark:text-white">
              {t("graphMap.crossGraph.goalDialog.title")}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <ol className="flex items-center gap-1.5 list-none m-0 p-0" aria-label={t("graphMap.crossGraph.goalDialog.stepIndicator", { current: step, total: STEP_TOTAL })}>
              {[1, 2, 3, 4].map((s) => (
                <li
                  key={s}
                  aria-current={s === step ? "step" : undefined}
                  className={`w-6 h-1 rounded-full transition-colors ${
                    s <= step ? "bg-primary-500" : "bg-gray-200 dark:bg-gray-700"
                  }`}
                />
              ))}
            </ol>
            <button
              onClick={onClose}
              aria-label={t("common.aria.close")}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
          {/* ── Step 1：学习目标 ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <Target className="w-4 h-4 text-primary-500" aria-hidden="true" />
                <span>{t("graphMap.crossGraph.goalDialog.step1Title")}</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t("graphMap.crossGraph.goalDialog.step1Hint")}
              </p>

              {hasActiveContext && (
                <div className="p-3 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 text-xs text-gray-600 dark:text-gray-300 space-y-1">
                  <div className="flex items-center gap-1.5 text-primary-600 dark:text-primary-400 font-medium">
                    <Zap className="w-3.5 h-3.5" aria-hidden="true" />
                    {t("graphMap.crossGraph.goalDialog.contextBanner")}
                  </div>
                  {activeContext.selectedGraphs.length > 0 && (
                    <p className="leading-relaxed">
                      {t("graphMap.crossGraph.goalDialog.contextGraphs", {
                        count: activeContext.selectedGraphs.length,
                        names: activeContext.selectedGraphs
                          .map((g) => g.title)
                          .join("、"),
                      })}
                    </p>
                  )}
                  {activeContext.selectedDomains.length > 0 && (
                    <p className="leading-relaxed">
                      {t("graphMap.crossGraph.goalDialog.contextDomains", {
                        count: activeContext.selectedDomains.length,
                        names: activeContext.selectedDomains
                          .map((d) => d.name)
                          .join("、"),
                      })}
                    </p>
                  )}
                </div>
              )}

              {isLoadingSuggest ? (
                <div className="flex items-center gap-2 py-4 text-sm text-gray-500 dark:text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin text-primary-500" aria-hidden="true" />
                  {t("graphMap.crossGraph.goalDialog.suggesting")}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => void loadSuggestedGoals()}
                      disabled={isLoadingSuggest}
                      className="flex items-center gap-1 text-xs text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSuggest ? "animate-spin" : ""}`} aria-hidden="true" />
                      {t("graphMap.crossGraph.goalDialog.refreshGoals")}
                    </button>
                  </div>
                  {suggestedGoals.map((goal, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        setSelectedGoal(goal);
                        setCustomGoal("");
                      }}
                      className={`w-full p-3 rounded-lg text-left text-sm transition-all ${
                        selectedGoal === goal
                          ? "bg-primary-50 dark:bg-primary-900/30 border-2 border-primary-500 text-primary-700 dark:text-primary-300"
                          : "bg-gray-50 dark:bg-slate-700 border-2 border-transparent hover:border-gray-200 dark:hover:border-slate-600 text-gray-800 dark:text-gray-200"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          selectedGoal === goal
                            ? "border-primary-500 bg-primary-500"
                            : "border-gray-300 dark:border-gray-600"
                        }`}>
                          {selectedGoal === goal && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span>{goal}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t("graphMap.crossGraph.goalDialog.customGoal")}
                </label>
                <div className="flex items-end gap-2">
                  <textarea
                    value={customGoal}
                    onChange={(e) => {
                      setCustomGoal(e.target.value);
                      if (e.target.value.trim()) setSelectedGoal("");
                    }}
                    placeholder={t("graphMap.crossGraph.goalDialog.placeholder")}
                    rows={2}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  {hasRecognitionSupport && (
                    <button
                      onClick={() => handleMicClick("customGoal")}
                      disabled={isTranscribing}
                      aria-label={
                        isTranscribing
                          ? t("graphMap.crossGraph.goalDialog.voiceTranscribing")
                          : isListening
                            ? t("graphMap.crossGraph.goalDialog.voiceStop")
                            : t("graphMap.crossGraph.goalDialog.voiceStart")
                      }
                      title={
                        isListening
                          ? t("graphMap.crossGraph.goalDialog.voiceStop")
                          : t("graphMap.crossGraph.goalDialog.voiceStart")
                      }
                      className={`shrink-0 p-2 rounded-lg transition-all ${
                        isListening
                          ? "bg-red-500 text-white hover:bg-red-600 animate-pulse"
                          : isTranscribing
                            ? "bg-indigo-500 text-white"
                            : "bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600"
                      }`}
                    >
                      {isTranscribing ? (
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      ) : isListening ? (
                        <MicOff className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <Mic className="w-4 h-4" aria-hidden="true" />
                      )}
                    </button>
                  )}
                </div>
                {sttError && (
                  <p className="text-xs text-red-500 mt-1" role="alert">{sttError}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={handleNextFromStep1}
                  disabled={!canProceedFromStep1}
                  className="flex items-center gap-1.5 ml-auto px-4 py-2 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {t("graphMap.crossGraph.goalDialog.next")}
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2：对话细化（可选） ── */}
          {step === 2 && (
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-1.5 mb-3 shrink-0">
                <Sparkles className="w-4 h-4 text-primary-500" aria-hidden="true" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {t("graphMap.crossGraph.goalDialog.step2Title")}
                </span>
                {targetGoal() && (
                  <span className="text-xs text-gray-400 dark:text-gray-500 truncate ml-1">
                    {t("graphMap.crossGraph.goalDialog.currentGoal", { goal: targetGoal() })}
                  </span>
                )}
              </div>

              <div ref={listRef} className="flex-1 overflow-y-auto space-y-3 min-h-0 pb-3">
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                        msg.role === "user"
                          ? "bg-primary-500 text-white rounded-br-sm"
                          : "bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-100 rounded-bl-sm"
                      }`}
                    >
                      {msg.content}
                      {msg.isStreaming && (
                        <span className="inline-block w-2 h-4 ml-0.5 bg-current opacity-60 animate-pulse align-middle" />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="shrink-0 space-y-2">
                <div className="flex items-end gap-2">
                  <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                    placeholder={t("graphMap.crossGraph.goalDialog.step2Placeholder")}
                    rows={2}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  {hasRecognitionSupport && (
                    <button
                      onClick={() => handleMicClick("chatInput")}
                      disabled={isTranscribing}
                      aria-label={
                        isTranscribing
                          ? t("graphMap.crossGraph.goalDialog.voiceTranscribing")
                          : isListening
                            ? t("graphMap.crossGraph.goalDialog.voiceStop")
                            : t("graphMap.crossGraph.goalDialog.voiceStart")
                      }
                      title={
                        isListening
                          ? t("graphMap.crossGraph.goalDialog.voiceStop")
                          : t("graphMap.crossGraph.goalDialog.voiceStart")
                      }
                      className={`shrink-0 p-2 rounded-lg transition-all ${
                        isListening
                          ? "bg-red-500 text-white hover:bg-red-600 animate-pulse"
                          : isTranscribing
                            ? "bg-indigo-500 text-white"
                            : "bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600"
                      }`}
                    >
                      {isTranscribing ? (
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      ) : isListening ? (
                        <MicOff className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <Mic className="w-4 h-4" aria-hidden="true" />
                      )}
                    </button>
                  )}
                  {isStreaming ? (
                    <button
                      onClick={handleStop}
                      className="shrink-0 px-3 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    >
                      {t("graphMap.crossGraph.goalDialog.stop")}
                    </button>
                  ) : (
                    <button
                      onClick={() => void handleSend()}
                      disabled={!inputValue.trim()}
                      className="shrink-0 px-3 py-2 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 transition-colors"
                      aria-label={t("graphMap.crossGraph.goalDialog.send")}
                    >
                      <Send className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
                {sttError && (
                  <p className="text-xs text-red-500" role="alert">{sttError}</p>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setStep(1)}
                    className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                    {t("graphMap.crossGraph.goalDialog.previous")}
                  </button>
                  <button
                    onClick={() => void handleGenerateVariants()}
                    disabled={isGeneratingVariants || isStreaming}
                    className="flex items-center gap-1.5 ml-auto px-4 py-2 text-sm bg-gradient-to-r from-primary-500 to-violet-500 text-white rounded-lg hover:from-primary-600 hover:to-violet-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {isGeneratingVariants ? (
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Sparkles className="w-4 h-4" aria-hidden="true" />
                    )}
                    {t("graphMap.crossGraph.goalDialog.generateVariants")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3：选择学习路径 ── */}
          {step === 3 && (
            <div className="space-y-3">
              <div className="flex items-center gap-1.5">
                <Route className="w-4 h-4 text-primary-500" aria-hidden="true" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {t("graphMap.crossGraph.goalDialog.step3Title")}
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t("graphMap.crossGraph.goalDialog.variantHint")}
              </p>

              {(isGeneratingVariants || isLoadingVariantsFromTask) && (
                <div className="flex items-center gap-2 py-4 text-sm text-gray-500 dark:text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin text-primary-500" aria-hidden="true" />
                  {t("graphMap.crossGraph.goalDialog.generatingVariants")}
                </div>
              )}

              {variants && variants.length > 0 && (
                <div className="space-y-2">
                  {variants.map((variant) => {
                    const isSelected = selectedVariantId === variant.id;
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => setSelectedVariantId(variant.id)}
                        className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                          isSelected
                            ? "border-primary-500 bg-primary-50 dark:bg-primary-900/30"
                            : "border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 hover:border-gray-300 dark:hover:border-gray-600"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              EMPHASIS_COLORS[variant.emphasis] ??
                              "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300"
                            }`}
                          >
                            {t(
                              EMPHASIS_LABEL_KEYS[variant.emphasis] ??
                                "graphMap.crossGraph.goalDialog.emphasis.systematic",
                            )}
                          </span>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {variant.name}
                          </span>
                          {isSelected && (
                            <Check className="w-4 h-4 text-primary-500 ml-auto shrink-0" aria-hidden="true" />
                          )}
                        </div>
                        {variant.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 line-clamp-2">
                            {variant.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500 mb-1.5">
                          <span className="flex items-center gap-1">
                            <Route className="w-3 h-3" aria-hidden="true" />
                            {t("graphMap.crossGraph.goalDialog.nodeCount", {
                              count: variant.stages.length,
                            })}
                          </span>
                          {variant.estimatedWeeks !== undefined && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" aria-hidden="true" />
                              {t("graphMap.crossGraph.goalDialog.estimatedWeeks", {
                                count: variant.estimatedWeeks,
                              })}
                            </span>
                          )}
                        </div>
                        <div className="space-y-0.5">
                          {variant.stages.slice(0, 5).map((stage) => (
                            <div
                              key={stage.graphId}
                              className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300"
                            >
                              <span className="w-4 h-4 rounded-full bg-gray-200 dark:bg-slate-600 text-[10px] text-gray-600 dark:text-gray-300 flex items-center justify-center shrink-0">
                                {stage.order + 1}
                              </span>
                              <span className="truncate">{stage.graphTitle}</span>
                              {stage.reason && (
                                <span className="text-gray-400 dark:text-gray-500 truncate">
                                  · {stage.reason}
                                </span>
                              )}
                            </div>
                          ))}
                          {variant.stages.length > 5 && (
                            <div className="text-xs text-gray-400 dark:text-gray-500 pl-5">
                              +{variant.stages.length - 5}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setStep(2)}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                  {t("graphMap.crossGraph.goalDialog.previous")}
                </button>
                <button
                  onClick={() => void handleGenerateVariants()}
                  disabled={isGeneratingVariants}
                  className="px-3 py-2 text-sm bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-4 h-4 ${isGeneratingVariants ? "animate-spin" : ""}`} aria-hidden="true" />
                  {t("graphMap.crossGraph.goalDialog.regenerate")}
                </button>
                <button
                  onClick={() => setStep(4)}
                  disabled={!selectedVariantId}
                  className="flex items-center gap-1.5 ml-auto px-4 py-2 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {t("graphMap.crossGraph.goalDialog.next")}
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 4：保存启用 ── */}
          {step === 4 && (() => {
            const selected = variants?.find((v) => v.id === selectedVariantId);
            if (!selected) return null;
            return (
              <div className="space-y-4">
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-primary-500" aria-hidden="true" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {t("graphMap.crossGraph.goalDialog.step4Title")}
                  </span>
                </div>

                <div className="p-3 rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/20">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      EMPHASIS_COLORS[selected.emphasis] ?? ""
                    }`}>
                      {t(
                        EMPHASIS_LABEL_KEYS[selected.emphasis] ??
                          "graphMap.crossGraph.goalDialog.emphasis.systematic",
                      )}
                    </span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {selected.name}
                    </span>
                  </div>
                  {selected.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {selected.description}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {t("graphMap.crossGraph.goalDialog.nodeCount", {
                      count: selected.stages.length,
                    })}
                  </p>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                    {t("graphMap.crossGraph.goalDialog.dailyMinutes")}
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={10}
                      max={120}
                      step={10}
                      value={dailyMinutes}
                      onChange={(e) => setDailyMinutes(parseInt(e.target.value, 10))}
                      className="flex-1"
                      aria-label={t("graphMap.crossGraph.goalDialog.dailyMinutes")}
                    />
                    <span className="text-sm font-medium text-primary-600 dark:text-primary-400 w-16 text-right">
                      {t("common.aria.minutesValue", { minutes: dailyMinutes })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setStep(3)}
                    className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                    {t("graphMap.crossGraph.goalDialog.previous")}
                  </button>
                  <button
                    onClick={() => void handleSave()}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 ml-auto px-4 py-2 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Check className="w-4 h-4" aria-hidden="true" />
                    )}
                    {t("graphMap.crossGraph.goalDialog.save")}
                  </button>
                </div>
              </div>
            );
          })()}
        </div>

        {onQuickGenerate && (
          <div className="shrink-0 border-t border-gray-200 dark:border-gray-700 px-4 py-2">
            <button
              onClick={onQuickGenerate}
              className="w-full px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors flex items-center justify-center gap-1"
            >
              <Zap className="w-3.5 h-3.5" aria-hidden="true" />
              {t("graphMap.crossGraph.goalDialog.quickGenerate")}
            </button>
          </div>
        )}
      </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GoalDrivenPathDialog;
