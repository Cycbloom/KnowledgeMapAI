import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target,
  BookOpen,
  Settings2,
  Sparkles,
  Loader2,
  ChevronRight,
  Check,
  Wand2,
  AlertTriangle,
  Plus,
  FolderPlus,
  Link2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import { message } from "../../utils/messageHelper";
import { useError } from "../../hooks";

interface ExistingGraph {
  id: string;
  title: string;
  similarity: number;
  nodeCount: number;
}

interface PrerequisiteQuestion {
  topic: string;
  description?: string;
  options: string[];
  existingGraph?: ExistingGraph;
}

interface QuestionsData {
  graphTitle: string;
  suggestedGoals: string[];
  prerequisiteQuestions: PrerequisiteQuestion[];
}

interface LearningPathWizardProps {
  graphId: string;
  onComplete: (data: {
    targetGoal: string;
    currentKnowledge: Record<string, string>;
    learningStyle: 'sequential' | 'exploratory' | 'focused';
    dailyTimeMinutes: number;
  }) => void;
  onCancel: () => void;
}

const KNOWLEDGE_LEVELS = [
  { value: '不了解', labelKey: 'learning.path.wizard.knowledgeLevelUnknown' },
  { value: '了解一点', labelKey: 'learning.path.wizard.knowledgeLevelLittle' },
  { value: '比较熟悉', labelKey: 'learning.path.wizard.knowledgeLevelFamiliar' },
  { value: '非常熟悉', labelKey: 'learning.path.wizard.knowledgeLevelVery' },
] as const;

const LEARNING_STYLES = [
  { value: 'sequential', labelKey: 'learning.path.wizard.styleSequential', descKey: 'learning.path.wizard.styleDescSequential' },
  { value: 'exploratory', labelKey: 'learning.path.wizard.styleExploratory', descKey: 'learning.path.wizard.styleDescExploratory' },
  { value: 'focused', labelKey: 'learning.path.wizard.styleFocused', descKey: 'learning.path.wizard.styleDescFocused' },
] as const;

export const LearningPathWizard: React.FC<LearningPathWizardProps> = ({
  graphId,
  onComplete,
  onCancel
}) => {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreatingGraphs, setIsCreatingGraphs] = useState(false);
  const [questionsData, setQuestionsData] = useState<QuestionsData | null>(null);

  const [selectedGoal, setSelectedGoal] = useState<string>('');
  const [customGoal, setCustomGoal] = useState('');
  const [knowledgeAnswers, setKnowledgeAnswers] = useState<Record<string, string>>({});
  const [learningStyle, setLearningStyle] = useState<'sequential' | 'exploratory' | 'focused'>('sequential');
  const [dailyTime, setDailyTime] = useState(30);
  const [selectedPrerequisites, setSelectedPrerequisites] = useState<Set<string>>(new Set());
  const [createdGraphs, setCreatedGraphs] = useState<Array<{
    topic: string;
    graphId: string;
    isNew: boolean;
    similarity?: number;
    matchedTitle?: string;
  }>>([]);

  const { handleError } = useError();

  useEffect(() => {
    fetchQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphId]);

  const fetchQuestions = async () => {
    setIsLoading(true);
    try {
      const result = await api.learningPath.getQuestions({ graph_id: graphId }) as QuestionsData;
      setQuestionsData(result);
      if (result.suggestedGoals.length > 0) {
        setSelectedGoal(result.suggestedGoals[0]);
      }
      const initialAnswers: Record<string, string> = {};
      result.prerequisiteQuestions.forEach((q: PrerequisiteQuestion) => {
        initialAnswers[q.topic] = q.options[0];
      });
      setKnowledgeAnswers(initialAnswers);
    } catch (error) {
      handleError(error, { context: 'Questions', fallbackMessage: t('learning.path.wizard.fetchQuestionsFailed') });
    } finally {
      setIsLoading(false);
    }
  };

  const unknownPrerequisites = Object.entries(knowledgeAnswers)
    .filter(([_, level]) => level === '不了解')
    .map(([topic]) => topic);

  const handleNext = () => {
    if (step < 4) {
      if (step === 2 && unknownPrerequisites.length === 0) {
        setStep(4);
      } else {
        setStep(step + 1);
      }
    }
  };

  const handleBack = () => {
    if (step > 1) {
      if (step === 4 && unknownPrerequisites.length === 0) {
        setStep(2);
      } else {
        setStep(step - 1);
      }
    }
  };

  const togglePrerequisite = (topic: string) => {
    const newSelected = new Set(selectedPrerequisites);
    if (newSelected.has(topic)) {
      newSelected.delete(topic);
    } else {
      newSelected.add(topic);
    }
    setSelectedPrerequisites(newSelected);
  };

  const handleCreatePrerequisiteGraphs = async () => {
    if (selectedPrerequisites.size === 0) {
      message.warning(t('learning.path.wizard.selectPrerequisites'));
      return;
    }

    setIsCreatingGraphs(true);
    try {
      const topics = Array.from(selectedPrerequisites).map(topic => ({
        topic,
        mastery_level: '不了解'
      }));

      const result = await api.graphs.createPrerequisiteGraphs(graphId, {
        topics,
        depth: 2,
        style: 'academic'
      });

      const typedResult = result as unknown as {
        graph_ids: string[];
        created: Array<{
          topic: string;
          graphId: string;
          isNew: boolean;
          similarity?: number;
          matchedTitle?: string;
        }>;
      };

      setCreatedGraphs(typedResult.created);

      const newCount = typedResult.created.filter((g) => g.isNew).length;
      const linkedCount = typedResult.created.filter((g) => !g.isNew).length;

      let resultMessage = '';
      if (newCount > 0 && linkedCount > 0) {
        resultMessage = t('learning.path.wizard.createdAndLinked', { newCount, linkedCount });
      } else if (newCount > 0) {
        resultMessage = t('learning.path.wizard.createdOnly', { newCount });
      } else if (linkedCount > 0) {
        resultMessage = t('learning.path.wizard.linkedOnly', { linkedCount });
      }

      message.success(resultMessage);

      setSelectedPrerequisites(new Set());
    } catch (error) {
      console.error('Create prerequisite graphs error:', error);
      handleError(error, { context: 'CreateGraphs', fallbackMessage: t('learning.path.wizard.createPrerequisiteFailed') });
    } finally {
      setIsCreatingGraphs(false);
    }
  };

  const handleComplete = async () => {
    const finalGoal = selectedGoal === 'custom' ? customGoal : selectedGoal;

    if (!finalGoal.trim()) {
      message.warning(t('learning.path.wizard.selectOrInputGoal'));
      return;
    }

    setIsGenerating(true);
    message.info(t('learning.path.wizard.planningInProgress'));
    try {
      onComplete({
        targetGoal: finalGoal,
        currentKnowledge: knowledgeAnswers,
        learningStyle,
        dailyTimeMinutes: dailyTime
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return selectedGoal === 'custom' ? customGoal.trim().length > 0 : !!selectedGoal;
      case 2:
        return true;
      case 3:
        return true;
      case 4:
        return true;
      default:
        return false;
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500 mb-4" />
        <p className="text-sm text-gray-500">{t('learning.path.wizard.loadingMessage')}</p>
      </div>
    );
  }

  const stepIndicator = unknownPrerequisites.length > 0 ? [1, 2, 3, 4] : [1, 2, 3];

  return (
    <div className="learning-path-wizard">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-primary-500" />
          {t('learning.path.wizard.title')}
        </h3>
        <div className="flex items-center gap-2">
          {stepIndicator.map((s) => (
            <div
              key={s}
              className={`w-8 h-1 rounded-full transition-colors ${
                s <= step ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <Target className="w-4 h-4 text-primary-500" />
              <span>{t('learning.path.wizard.step1')}</span>
            </div>

            <p className="text-sm text-gray-500">
              {t('learning.path.wizard.suggestedGoalsHint', { title: questionsData?.graphTitle ?? '' })}
            </p>

            <div className="space-y-2">
              {questionsData?.suggestedGoals.map((goal, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedGoal(goal)}
                  className={`w-full p-3 rounded-lg text-left text-sm transition-all ${
                    selectedGoal === goal
                      ? 'bg-primary-50 dark:bg-primary-900/30 border-2 border-primary-500 text-primary-700 dark:text-primary-300'
                      : 'bg-gray-50 dark:bg-slate-700 border-2 border-transparent hover:border-gray-200 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      selectedGoal === goal
                        ? 'border-primary-500 bg-primary-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {selectedGoal === goal && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span>{goal}</span>
                  </div>
                </button>
              ))}
              
              <button
                onClick={() => setSelectedGoal('custom')}
                className={`w-full p-3 rounded-lg text-left text-sm transition-all ${
                  selectedGoal === 'custom'
                    ? 'bg-primary-50 dark:bg-primary-900/30 border-2 border-primary-500'
                    : 'bg-gray-50 dark:bg-slate-700 border-2 border-transparent hover:border-gray-200 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    selectedGoal === 'custom'
                      ? 'border-primary-500 bg-primary-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}>
                    {selectedGoal === 'custom' && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-gray-600 dark:text-gray-300">{t('learning.path.wizard.customGoal')}</span>
                </div>
                {selectedGoal === 'custom' && (
                  <input
                    type="text"
                    value={customGoal}
                    onChange={(e) => setCustomGoal(e.target.value)}
                    placeholder={t('learning.path.wizard.customGoalPlaceholder')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-slate-800 dark:text-white mt-2"
                    autoFocus
                  />
                )}
              </button>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <BookOpen className="w-4 h-4 text-primary-500" />
              <span>{t('learning.path.wizard.step2')}</span>
            </div>

            <p className="text-sm text-gray-500">
              {t('learning.path.wizard.assessKnowledgeHint')}
            </p>

            <div className="space-y-4">
              {questionsData?.prerequisiteQuestions.map((question, index) => {
                const isUnknown = knowledgeAnswers[question.topic] === '不了解';
                const hasExistingGraph = question.existingGraph;
                return (
                  <div key={index} className={`space-y-2 p-2 rounded-lg ${isUnknown ? 'bg-red-50 dark:bg-red-900/20' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-white">{question.topic}</span>
                        {question.description && (
                          <span className="text-xs text-gray-500">({question.description})</span>
                        )}
                        {hasExistingGraph && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                            <Link2 className="w-3 h-3" />
                            {t('learning.path.wizard.existingGraph')}
                          </span>
                        )}
                      </div>
                      {isUnknown && !hasExistingGraph && (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                    {hasExistingGraph && (
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-800 rounded px-2 py-1">
                        <span>{t('learning.path.wizard.matchedTo', { title: hasExistingGraph.title })}</span>
                        <span className="text-gray-300 dark:text-gray-600">|</span>
                        <span>{t('learning.path.wizard.similarity', { percent: Math.round(hasExistingGraph.similarity * 100) })}</span>
                        <span className="text-gray-300 dark:text-gray-600">|</span>
                        <span>{t('learning.path.wizard.nodeCount', { count: hasExistingGraph.nodeCount })}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {KNOWLEDGE_LEVELS.map((level) => (
                        <button
                          key={level.value}
                          onClick={() => setKnowledgeAnswers(prev => ({ ...prev, [question.topic]: level.value }))}
                          className={`px-3 py-1.5 text-xs rounded-full transition-all ${
                            knowledgeAnswers[question.topic] === level.value
                              ? level.value === '不了解'
                                ? 'bg-red-500 text-white'
                                : 'bg-primary-500 text-white'
                              : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                          }`}
                        >
                          {t(level.labelKey, { defaultValue: '' })}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {step === 3 && unknownPrerequisites.length > 0 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <FolderPlus className="w-4 h-4 text-primary-500" />
              <span>{t('learning.path.wizard.step3')}</span>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {t('learning.path.wizard.createGraphsHint')}
              </p>
            </div>

            <div className="space-y-2">
              {unknownPrerequisites.map((topic) => {
                const questionData = questionsData?.prerequisiteQuestions.find(q => q.topic === topic);
                const existingGraph = questionData?.existingGraph;
                return (
                  <button
                    key={topic}
                    onClick={() => togglePrerequisite(topic)}
                    className={`w-full p-3 rounded-lg text-left text-sm transition-all flex items-center gap-3 ${
                      selectedPrerequisites.has(topic)
                        ? 'bg-primary-50 dark:bg-primary-900/30 border-2 border-primary-500'
                        : 'bg-gray-50 dark:bg-slate-700 border-2 border-transparent hover:border-gray-200 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded flex items-center justify-center ${
                      selectedPrerequisites.has(topic)
                        ? 'bg-primary-500 text-white'
                        : 'border-2 border-gray-300 dark:border-gray-600'
                    }`}>
                      {selectedPrerequisites.has(topic) && <Check className="w-3 h-3" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span>{topic}</span>
                        {existingGraph && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                            <Link2 className="w-3 h-3" />
                            {t('learning.path.wizard.existingGraph')}
                          </span>
                        )}
                      </div>
                      {existingGraph && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {t('learning.path.wizard.matchedToWithCount', {
                            title: existingGraph.title,
                            percent: Math.round(existingGraph.similarity * 100),
                            count: existingGraph.nodeCount
                          })}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      {existingGraph ? t('learning.path.wizard.actionLink') : t('learning.path.wizard.actionCreate')}
                    </span>
                  </button>
                );
              })}
            </div>

            {createdGraphs.length > 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                <p className="text-sm text-green-800 dark:text-green-200 font-medium mb-2">
                  {t('learning.path.wizard.processingResult')}
                </p>
                <ul className="space-y-2">
                  {createdGraphs.map((g) => (
                    <li key={g.graphId} className="text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
                      {g.isNew ? (
                        <Plus className="w-3 h-3" />
                      ) : (
                        <Link2 className="w-3 h-3" />
                      )}
                      <span>{g.topic}</span>
                      {g.isNew ? (
                        <span className="text-xs text-green-600 dark:text-green-400">{t('learning.path.wizard.newLabel')}</span>
                      ) : (
                        <span className="text-xs text-green-600 dark:text-green-400">
                          {t('learning.path.wizard.linkedWithSimilarity', {
                            title: g.matchedTitle ?? '',
                            percent: Math.round((g.similarity || 0) * 100)
                          })}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={handleCreatePrerequisiteGraphs}
              disabled={isCreatingGraphs || selectedPrerequisites.size === 0}
              className="w-full py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isCreatingGraphs ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('learning.path.wizard.processing')}
                </>
              ) : (
                <>
                  <FolderPlus className="w-4 h-4" />
                  {t('learning.path.wizard.createOrLinkButton')}
                </>
              )}
            </button>
          </motion.div>
        )}

        {step === 4 && (
          <motion.div
            key="step4"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <Settings2 className="w-4 h-4 text-primary-500" />
              <span>
                {t('learning.path.wizard.step4Prefix', {
                  step: unknownPrerequisites.length > 0
                    ? t('learning.path.wizard.step4Label')
                    : t('learning.path.wizard.step3Label')
                })}
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('learning.path.wizard.dailyTimeLabel')}
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={10}
                    max={120}
                    step={10}
                    value={dailyTime}
                    onChange={(e) => setDailyTime(parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-sm font-medium text-primary-600 dark:text-primary-400 w-16 text-right">
                    {t('learning.path.wizard.minutes', { count: dailyTime })}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('learning.learningPath.learningStyle')}
                </label>
                <div className="space-y-2">
                  {LEARNING_STYLES.map((style) => (
                    <button
                      key={style.value}
                      onClick={() => setLearningStyle(style.value)}
                      className={`w-full p-3 rounded-lg text-left transition-all ${
                        learningStyle === style.value
                          ? 'bg-primary-50 dark:bg-primary-900/30 border-2 border-primary-500'
                          : 'bg-gray-50 dark:bg-slate-700 border-2 border-transparent hover:border-gray-200 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="font-medium text-sm text-gray-900 dark:text-white">{t(style.labelKey, { defaultValue: '' })}</div>
                      <div className="text-xs text-gray-500">{t(style.descKey, { defaultValue: '' })}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between mt-6 pt-4 border-t dark:border-slate-500">
        <button
          onClick={step === 1 ? onCancel : handleBack}
          className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
        >
          {step === 1 ? t('common.cancel') : t('learning.path.wizard.buttonPrevious')}
        </button>

        {step < 4 ? (
          <button
            onClick={handleNext}
            disabled={!canProceed()}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('learning.path.wizard.buttonNext')}
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleComplete}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-500 text-white rounded-lg hover:from-primary-600 hover:to-primary-600 disabled:opacity-50"
          >
            {isGenerating ? (
              <span
                role="status"
                aria-live="polite"
                className="flex items-center gap-2"
              >
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('learning.path.wizard.buttonGenerating')}
              </span>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {t('learning.path.wizard.buttonGenerate')}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default LearningPathWizard;
