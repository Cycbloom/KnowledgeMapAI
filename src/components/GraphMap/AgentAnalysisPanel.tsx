import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Bot, Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  agentApi,
  type AgentSession,
  type SkillDefinition,
} from "../../services/api/agent";
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
  const [step, setStep] = useState<AnalysisStep>('select');
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    mode: 'quick',
    customPrompt: '',
  });

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

    try {
      const { session: newSession } = await agentApi.createSession({
        skill_id: skillToUse.id,
        graph_ids: effectiveGraphIds.length > 0 ? effectiveGraphIds : undefined,
        custom_prompt: confirmState.mode === 'custom' ? confirmState.customPrompt : undefined,
      });
      setSession(newSession);

      const result = await agentApi.executeSession(newSession.id);
      setSession(result.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setIsLoading(false);
    }
  }, [confirmState, skills, effectiveGraphIds]);

  const handleCancelConfirm = useCallback(() => {
    setStep('select');
    setConfirmState({ mode: 'quick', customPrompt: '' });
  }, []);

  const handleCustomPromptChange = useCallback((prompt: string) => {
    setConfirmState(prev => ({ ...prev, customPrompt: prompt }));
  }, []);

  const handleReset = useCallback(() => {
    setSelectedSkill(null);
    setSession(null);
    setError(null);
    setDismissedSuggestions(new Set());
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
            <Bot className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
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

              {isLoading && !session?.result && (
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('graphMap.agentAnalysis.analyzing')}</span>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              )}

              {session && <SessionLog session={session} />}

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
