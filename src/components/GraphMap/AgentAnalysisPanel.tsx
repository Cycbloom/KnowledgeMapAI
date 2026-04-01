import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Bot, Loader2, AlertCircle } from "lucide-react";
import {
  agentApi,
  type AgentSession,
  type SkillDefinition,
} from "../../services/api/agent";
import { SkillSelector } from "./SkillSelector";
import { SessionLog } from "./SessionLog";
import { AnalysisResultView } from "./AnalysisResultView";
import { MergeSuggestionsSection } from "./MergeSuggestionsSection";

interface AgentAnalysisPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedGraphIds?: string[];
  onGraphsMerged?: () => void;
}

export const AgentAnalysisPanel: React.FC<AgentAnalysisPanelProps> = ({
  isOpen,
  onClose,
  selectedGraphIds,
  onGraphsMerged,
}) => {
  const [skills, setSkills] = useState<SkillDefinition[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<SkillDefinition | null>(
    null,
  );
  const [session, setSession] = useState<AgentSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    if (isOpen) {
      loadSkills();
    }
  }, [isOpen]);

  const loadSkills = async () => {
    try {
      const { skills: loadedSkills } = await agentApi.getSkills();
      setSkills(loadedSkills);
    } catch (err) {
      setError("Failed to load skills");
    }
  };

  const handleSelectSkill = async (skill: SkillDefinition) => {
    setSelectedSkill(skill);
    setIsLoading(true);
    setError(null);

    try {
      const { session: newSession } = await agentApi.createSession({
        skill_id: skill.id,
        graph_ids: selectedGraphIds,
      });
      setSession(newSession);

      const result = await agentApi.executeSession(newSession.id);
      setSession(result.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedSkill(null);
    setSession(null);
    setError(null);
    setDismissedSuggestions(new Set());
  };

  const handleMergeGraphs = async (graphIds: string[]) => {
    try {
      await agentApi.mergeGraphs(graphIds);
      onGraphsMerged?.();
    } catch (err) {
      throw err;
    }
  };

  const handleLinkGraphs = async (graphIds: string[]) => {
    try {
      await agentApi.linkGraphs(graphIds);
      onGraphsMerged?.();
    } catch (err) {
      throw err;
    }
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
            <Bot className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Agent 分析
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
          {!selectedSkill ? (
            <SkillSelector
              skills={skills}
              selectedGraphCount={selectedGraphIds?.length || 0}
              onSelect={handleSelectSkill}
            />
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {selectedSkill.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedSkill.description}
                  </p>
                </div>
                <button
                  onClick={handleReset}
                  className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  选择其他
                </button>
              </div>

              {isLoading && !session?.result && (
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>正在分析...</span>
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
