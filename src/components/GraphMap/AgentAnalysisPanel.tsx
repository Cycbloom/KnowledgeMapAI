import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Bot, Loader2, AlertCircle, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  agentApi,
  type AgentSession,
  type SkillDefinition,
  type PendingAction,
  type AgentSSEEvent,
  type ToolCallStartData,
  type ToolCallResultData,
  type AgentMessageData,
  type AwaitingConfirmationData,
  type SessionCompletedData,
  type SessionFailedData,
} from "../../services/api/agent";
import { ActionConfirmationPanel } from "./ActionConfirmationPanel";
import { SkillSelector } from "./SkillSelector";
import { SessionLog } from "./SessionLog";
import { AnalysisResultView } from "./AnalysisResultView";
import { MergeSuggestionsSection } from "./MergeSuggestionsSection";
import { AnalysisConfirmPanel, type AnalysisMode } from "./AnalysisConfirmPanel";
import { estimateTokenConsumption, type TokenEstimation } from "./utils/tokenEstimation";

type AnalysisStep = 'select' | 'confirm' | 'execute';

interface ConfirmState {
  mode: AnalysisMode;
  skill?: SkillDefinition;
  customPrompt: string;
}

interface SSEEventDisplay {
  id: string;
  type: AgentSSEEvent['type'];
  label: string;
  detail?: string;
  status: 'running' | 'completed' | 'failed';
}

interface AgentAnalysisPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedGraphIds?: string[];
  graphTitles?: string[];
  onGraphsMerged?: () => void;
  analysisMode?: AnalysisMode;
}

export const AgentAnalysisPanel: React.FC<AgentAnalysisPanelProps> = ({
  isOpen,
  onClose,
  selectedGraphIds = [],
  graphTitles = [],
  onGraphsMerged,
  analysisMode: initialAnalysisMode,
}) => {
  const { t } = useTranslation();
  const [skills, setSkills] = useState<SkillDefinition[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<SkillDefinition | null>(null);
  const [session, setSession] = useState<AgentSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(
    new Set(),
  );
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [step, setStep] = useState<AnalysisStep>('select');
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    mode: 'quick',
    customPrompt: '',
  });
  const [sseEvents, setSseEvents] = useState<SSEEventDisplay[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const sseEventIdRef = useRef(0);

  const effectiveGraphIds = useMemo(() => selectedGraphIds, [selectedGraphIds]);
  const effectiveGraphTitles = useMemo(() => {
    if (graphTitles.length > 0) return graphTitles;
    return effectiveGraphIds.map((_, index) => t('graphMap.agentAnalysis.graphNumber', { number: index + 1 }));
  }, [graphTitles, effectiveGraphIds, t]);

  const estimatedTokens: TokenEstimation = useMemo(() => {
    const graphCount = effectiveGraphIds.length || 1;
    return estimateTokenConsumption(confirmState.mode, graphCount);
  }, [confirmState.mode, effectiveGraphIds.length]);

  useEffect(() => {
    if (isOpen) {
      loadSkills();
      setStep('select');
      setConfirmState({ mode: 'quick', customPrompt: '' });
      setSelectedSkill(null);
      setSession(null);
      setError(null);
      setSseEvents([]);
      sseEventIdRef.current = 0;
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && initialAnalysisMode && skills.length > 0) {
      if (initialAnalysisMode === 'custom') {
        setConfirmState({ mode: 'custom', customPrompt: '' });
        setStep('confirm');
      } else {
        const defaultSkill = skills.find(s => 
          (initialAnalysisMode === 'quick' && s.id === 'quick_analysis') ||
          (initialAnalysisMode === 'deep' && s.id === 'deep_analysis')
        );
        if (defaultSkill) {
          handleSelectSkillForConfirm(defaultSkill, initialAnalysisMode);
        } else {
          setConfirmState(prev => ({ ...prev, mode: initialAnalysisMode }));
          setStep('confirm');
        }
      }
    }
  }, [skills, isOpen, initialAnalysisMode]);

  const loadSkills = async () => {
    try {
      const { skills: loadedSkills } = await agentApi.getSkills();
      setSkills(loadedSkills);
    } catch (err) {
      setError("Failed to load skills");
    }
  };

  const handleSelectSkillForConfirm = useCallback((skill: SkillDefinition, mode: AnalysisMode = 'quick') => {
    setConfirmState({
      mode,
      skill,
      customPrompt: '',
    });
    setStep('confirm');
  }, []);

  const handleSelectSkill = useCallback((skill: SkillDefinition) => {
    handleSelectSkillForConfirm(skill, 'quick');
  }, [handleSelectSkillForConfirm]);

  const handleSSEEvent = useCallback((event: AgentSSEEvent) => {
    const eventId = String(++sseEventIdRef.current);

    switch (event.type) {
      case "tool_call_start": {
        const data = event.data as ToolCallStartData;
        setSseEvents(prev => [...prev, {
          id: eventId,
          type: event.type,
          label: `正在调用 ${data.toolName}...`,
          detail: Object.keys(data.args).length > 0 ? JSON.stringify(data.args) : undefined,
          status: 'running',
        }]);
        break;
      }
      case "tool_call_result": {
        const data = event.data as ToolCallResultData;
        setSseEvents(prev => {
          // Mark the matching tool_call_start as completed
          const lastStartIdx = [...prev].reverse().findIndex(
            e => e.type === 'tool_call_start' && e.label.includes(data.toolName) && e.status === 'running'
          );
          if (lastStartIdx >= 0) {
            const actualIdx = prev.length - 1 - lastStartIdx;
            const updated = [...prev];
            updated[actualIdx] = { ...updated[actualIdx], status: 'completed' };
            return [...updated, {
              id: eventId,
              type: event.type,
              label: `${data.toolName} 完成`,
              detail: data.result !== undefined ? String(data.result).slice(0, 200) : undefined,
              status: 'completed',
            }];
          }
          return [...prev, {
            id: eventId,
            type: event.type,
            label: `${data.toolName} 完成`,
            detail: data.result !== undefined ? String(data.result).slice(0, 200) : undefined,
            status: 'completed',
          }];
        });
        break;
      }
      case "agent_message": {
        const data = event.data as AgentMessageData;
        setSseEvents(prev => [...prev, {
          id: eventId,
          type: event.type,
          label: data.content,
          status: 'completed',
        }]);
        break;
      }
      case "awaiting_confirmation": {
        const data = event.data as AwaitingConfirmationData;
        setPendingActions(data.pendingActions);
        setSseEvents(prev => [...prev, {
          id: eventId,
          type: event.type,
          label: '等待确认操作',
          status: 'running',
        }]);
        break;
      }
      case "session_completed": {
        const data = event.data as SessionCompletedData;
        setSession(data.session);
        setSseEvents(prev => [...prev, {
          id: eventId,
          type: event.type,
          label: '分析完成',
          status: 'completed',
        }]);
        break;
      }
      case "session_failed": {
        const data = event.data as SessionFailedData;
        setError(data.error);
        setSseEvents(prev => [...prev, {
          id: eventId,
          type: event.type,
          label: `分析失败: ${data.error}`,
          status: 'failed',
        }]);
        break;
      }
    }
  }, []);

  const handleConfirmAnalysis = useCallback(async () => {
    if (!confirmState.skill && confirmState.mode !== 'custom') return;

    const skillToUse = confirmState.skill || skills[0];
    if (!skillToUse) {
      setError("No skill available");
      return;
    }

    setSelectedSkill(skillToUse);
    setStep('execute');
    setIsLoading(true);
    setError(null);
    setSseEvents([]);
    sseEventIdRef.current = 0;

    try {
      const { session: newSession } = await agentApi.createSession({
        skill_id: skillToUse.id,
        graph_ids: effectiveGraphIds.length > 0 ? effectiveGraphIds : undefined,
        custom_prompt: confirmState.mode === 'custom' ? confirmState.customPrompt : undefined,
      });
      setSession(newSession);

      const controller = await agentApi.executeSessionStream(
        newSession.id,
        confirmState.mode === 'custom' ? confirmState.customPrompt : undefined,
        handleSSEEvent,
        (err) => {
          setError(err.message);
          setIsLoading(false);
        },
        () => {
          setIsLoading(false);
        },
      );
      abortControllerRef.current = controller;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
      setIsLoading(false);
    }
  }, [confirmState, skills, effectiveGraphIds, handleSSEEvent]);

  const handleCancelConfirm = useCallback(() => {
    setStep('select');
    setConfirmState({ mode: 'quick', customPrompt: '' });
  }, []);

  const handleCustomPromptChange = useCallback((prompt: string) => {
    setConfirmState(prev => ({ ...prev, customPrompt: prompt }));
  }, []);

  const handleReset = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setSelectedSkill(null);
    setSession(null);
    setError(null);
    setDismissedSuggestions(new Set());
    setPendingActions([]);
    setSseEvents([]);
    sseEventIdRef.current = 0;
    setStep('select');
    setConfirmState({ mode: 'quick', customPrompt: '' });
  }, []);

  const handleMergeGraphs = async (graphIds: string[]) => {
    await agentApi.mergeGraphs(graphIds);
    onGraphsMerged?.();
  };

  const handleLinkGraphs = async (graphIds: string[]) => {
    await agentApi.linkGraphs(graphIds);
    onGraphsMerged?.();
  };

  const handleDismissSuggestion = async (graphIds: string[]) => {
    const key = graphIds.join("-");
    setDismissedSuggestions((prev) => new Set(prev).add(key));
  };

  const handleActionConfirmed = useCallback((actionId: string, _result: unknown) => {
    setPendingActions(prev => prev.filter(a => a.id !== actionId));
  }, []);

  const handleActionRejected = useCallback((actionId: string) => {
    setPendingActions(prev => prev.filter(a => a.id !== actionId));
  }, []);

  const handleAllActionsResolved = useCallback(async () => {
    setPendingActions([]);
    if (session?.id) {
      try {
        // After confirming/rejecting actions, resume the session via SSE
        setIsLoading(true);
        const controller = await agentApi.resumeSessionStream(
          session.id,
          handleSSEEvent,
          (err) => {
            setError(err.message);
            setIsLoading(false);
          },
          () => {
            setIsLoading(false);
          },
        );
        abortControllerRef.current = controller;
      } catch {
        // Fallback: fetch session state if resume fails
        try {
          const { session: updatedSession } = await agentApi.getSession(session.id);
          setSession(updatedSession);
        } catch {
          // Ignore fetch errors
        }
        setIsLoading(false);
      }
    }
  }, [session?.id, handleSSEEvent]);

  const activeMergeSuggestions =
    session?.structuredResult?.merge_suggestions?.filter(
      (suggestion) => !dismissedSuggestions.has(suggestion.graph_ids.join("-")),
    ) || [];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 300 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 300 }}
        className="fixed right-0 top-0 h-full w-[480px] bg-white dark:bg-slate-900 shadow-2xl border-l border-gray-200 dark:border-slate-700 z-50 flex flex-col"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            {step === 'execute' && selectedSkill && (
              <button
                onClick={handleReset}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <Bot className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {step === 'execute' && selectedSkill ? selectedSkill.name : t('graphMap.agentAnalysis.title')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {step === 'select' && (
            <SkillSelector
              skills={skills}
              selectedGraphCount={effectiveGraphIds.length}
              onSelect={handleSelectSkill}
            />
          )}

          {step === 'confirm' && (
            <AnalysisConfirmPanel
              mode={confirmState.mode}
              skill={confirmState.skill}
              customPrompt={confirmState.customPrompt}
              selectedGraphIds={effectiveGraphIds}
              graphTitles={effectiveGraphTitles}
              estimatedTokens={estimatedTokens}
              onConfirm={handleConfirmAnalysis}
              onCancel={handleCancelConfirm}
              onCustomPromptChange={handleCustomPromptChange}
              isLoading={isLoading}
            />
          )}

          {step === 'execute' && selectedSkill && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedSkill.description}
                  </p>
                </div>
              </div>

              {isLoading && sseEvents.length === 0 && (
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('graphMap.agentAnalysis.analyzing')}</span>
                </div>
              )}

              {sseEvents.length > 0 && (
                <div className="space-y-1.5 pl-2 border-l-2 border-primary-200 dark:border-primary-800">
                  {sseEvents.map((evt) => (
                    <div
                      key={evt.id}
                      className={`flex items-start gap-2 p-2 rounded text-xs ${
                        evt.type === 'agent_message'
                          ? 'bg-primary-50 dark:bg-primary-900/20'
                          : evt.type === 'session_failed'
                            ? 'bg-red-50 dark:bg-red-900/20'
                            : 'bg-gray-50 dark:bg-slate-800'
                      }`}
                    >
                      {evt.status === 'running' && (
                        <Loader2 className="w-3 h-3 animate-spin text-primary-500 mt-0.5 shrink-0" />
                      )}
                      {evt.status === 'completed' && (
                        <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                      )}
                      {evt.status === 'failed' && (
                        <AlertCircle className="w-3 h-3 text-red-500 mt-0.5 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-gray-700 dark:text-gray-300">{evt.label}</div>
                        {evt.detail && (
                          <div className="text-gray-400 dark:text-gray-500 line-clamp-2 mt-0.5">{evt.detail}</div>
                        )}
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex items-center gap-2 p-2 text-xs text-gray-400 dark:text-gray-500">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>{t('graphMap.agentAnalysis.analyzing')}</span>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              )}

              {session && <SessionLog session={session} />}

              {session?.status === "awaiting_confirmation" && pendingActions.length > 0 && (
                <ActionConfirmationPanel
                  sessionId={session.id}
                  pendingActions={pendingActions}
                  onActionConfirmed={handleActionConfirmed}
                  onActionRejected={handleActionRejected}
                  onAllActionsResolved={handleAllActionsResolved}
                />
              )}

              {session?.result && (
                <AnalysisResultView
                  result={session.result}
                  structuredResult={session.structuredResult}
                />
              )}

              {activeMergeSuggestions.length > 0 && (
                <MergeSuggestionsSection
                  suggestions={activeMergeSuggestions}
                  onMerge={handleMergeGraphs}
                  onLink={handleLinkGraphs}
                  onDismiss={handleDismissSuggestion}
                />
              )}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
