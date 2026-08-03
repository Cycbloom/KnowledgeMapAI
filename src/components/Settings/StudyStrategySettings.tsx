import React, { useState, useLayoutEffect, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Brain } from "lucide-react";
import {
  STUDY_MODE_OPTIONS,
  STUDY_MODE_PRESETS,
  DEFAULT_MASTERY_THRESHOLDS,
  DEFAULT_SCHEDULER_WEIGHTS,
  STUDY_STRATEGY_DEFAULTS,
} from "./settingsConstants";
import { AvailableModels } from "../../types";
import { useUpdateProfileMutation } from "../../hooks/mutations";
import { useAutoSave } from "../../hooks";
import { message } from "../../utils/messageHelper";

interface StudyStrategySettingsProps {
  settings: Record<string, unknown> | undefined;
  availableModels: AvailableModels;
}

export const StudyStrategySettings = React.memo(
  function StudyStrategySettings({ settings, availableModels }: StudyStrategySettingsProps) {
      const { t } = useTranslation();
      const updateProfileMutation = useUpdateProfileMutation();

      const [retention, setRetention] = useState(0.9);
      const [maxInterval, setMaxInterval] = useState(36500);
      const [defaultStudyMode, setDefaultStudyMode] = useState("mixed");
      const [masteryThresholds, setMasteryThresholds] = useState(DEFAULT_MASTERY_THRESHOLDS);
      const [schedulerWeights, setSchedulerWeights] = useState(DEFAULT_SCHEDULER_WEIGHTS);
      const [semanticScheduling, setSemanticScheduling] = useState(true);

      // Refs hold the latest unstable values (mutation object, translation fn,
      // and the settings prop) so the onSave callback below can read them
      // without capturing stale closures. Without this, the mutation object
      // changes identity on every render, which previously re-triggered the
      // save effect and caused an infinite save → refetch → save loop.
      const settingsRef = useRef(settings);
      const mutationRef = useRef(updateProfileMutation);
      const tRef = useRef(t);
      useEffect(() => {
        settingsRef.current = settings;
        mutationRef.current = updateProfileMutation;
        tRef.current = t;
      });

      // Tracks whether the user has actually changed a value. Auto-save only
      // fires when this is true, so mounting / loading from props / parent
      // re-renders (e.g. availableModels identity change) never trigger a save.
      const [isDirty, setIsDirty] = useState(false);

      useLayoutEffect(() => {
        if (settings) {
          if (settings.request_retention)
            {setRetention(Number(settings.request_retention));}
          if (settings.maximum_interval)
            {setMaxInterval(Number(settings.maximum_interval));}
          if (settings.defaultStudyMode)
            {setDefaultStudyMode(settings.defaultStudyMode as string);}
          if (settings.masteryThresholds)
            {setMasteryThresholds(settings.masteryThresholds as typeof DEFAULT_MASTERY_THRESHOLDS);}
          if (settings.schedulerWeights)
            {setSchedulerWeights(settings.schedulerWeights as typeof DEFAULT_SCHEDULER_WEIGHTS);}
          if (settings.semantic_scheduling !== undefined)
            {setSemanticScheduling(settings.semantic_scheduling as boolean);}
          // Loading values from the profile does not mark the form dirty;
          // auto-save should only fire on explicit user interaction.
          setIsDirty(false);
        }
      }, [settings]);

      // Combined value object for useAutoSave. Memoized so it only changes
      // identity when one of the editable values actually changes, matching
      // the original effect's dependency array.
      const settingsValue = useMemo(
        () => ({
          retention,
          maxInterval,
          defaultStudyMode,
          masteryThresholds,
          schedulerWeights,
          semanticScheduling,
          availableModels,
        }),
        [
          retention,
          maxInterval,
          defaultStudyMode,
          masteryThresholds,
          schedulerWeights,
          semanticScheduling,
          availableModels,
        ],
      );

      // Auto-save: 800ms debounce via useAutoSave. The enabled flag is tied
      // to isDirty so saves only fire after explicit user interaction.
      // onSave resolves on both success and error (error is caught and shown
      // via toast), preserving the original behavior where no error status
      // is tracked in the UI.
      useAutoSave({
        value: settingsValue,
        onSave: async () => {
          try {
            await mutationRef.current.mutateAsync({
              settings: {
                ...settingsRef.current,
                request_retention: Number(retention),
                maximum_interval: Number(maxInterval),
                defaultStudyMode,
                masteryThresholds,
                schedulerWeights,
                semantic_scheduling: semanticScheduling,
                available_models: availableModels,
              },
            });
            setIsDirty(false);
            message.success(tRef.current("settings.saveSuccess"));
          } catch {
            message.error(tRef.current("settings.saveFailed"));
          }
        },
        delay: 800,
        enabled: isDirty,
      });

      const handleStudyModeChange = (mode: string) => {
        setIsDirty(true);
        setDefaultStudyMode(mode);
        const preset = STUDY_MODE_PRESETS[mode];
        if (preset) {
          setRetention(preset.requestRetention);
          setMaxInterval(preset.maximumInterval);
        }
      };

      const handleResetStudyStrategyDefaults = () => {
        setIsDirty(true);
        setDefaultStudyMode(STUDY_STRATEGY_DEFAULTS.defaultStudyMode);
        setRetention(STUDY_STRATEGY_DEFAULTS.requestRetention);
        setMaxInterval(STUDY_STRATEGY_DEFAULTS.maximumInterval);
        setMasteryThresholds({ ...DEFAULT_MASTERY_THRESHOLDS });
        setSchedulerWeights({ ...DEFAULT_SCHEDULER_WEIGHTS });
      };

      return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-500 p-4 md:p-6 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {t("settings.studyStrategy.title")}
              </h2>
            </div>
            <button
              onClick={handleResetStudyStrategyDefaults}
              className="px-3 py-1.5 text-xs rounded-md border border-gray-200 dark:border-slate-500 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            >
              {t("settings.studyStrategy.resetDefaults")}
            </button>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <label className="font-semibold text-gray-700 dark:text-gray-300 text-sm">
                {t("settings.studyStrategy.defaultStudyMode")}
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {STUDY_MODE_OPTIONS.map((mode) => (
                  <div
                    key={mode.value}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      defaultStudyMode === mode.value
                        ? "border-primary-300 bg-primary-50 dark:border-primary-700 dark:bg-primary-900/20"
                        : "border-gray-200 dark:border-slate-500 hover:border-primary-200 dark:hover:border-primary-800"
                    }`}
                    onClick={() => handleStudyModeChange(mode.value)}
                  >
                    <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{t(mode.labelKey as never)}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t(mode.descriptionKey as never)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="font-semibold text-gray-700 dark:text-gray-300 text-sm">
                {t("settings.studyStrategy.spacedRepetitionParams")}
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-500 transition-colors">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {t("settings.requestRetention")}
                    </span>
                    <input
                      type="number"
                      autoComplete="off"
                      min="0.70"
                      max="0.99"
                      step="0.01"
                      value={retention}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val >= 0.7 && val <= 0.99) {
                          setIsDirty(true);
                          setRetention(val);
                        }
                      }}
                      className="w-20 input-mobile text-right text-primary-600 dark:text-primary-400 font-bold bg-transparent border-b border-primary-200 dark:border-primary-800 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/50 transition-all"
                    />
                  </div>
                  <input
                    type="range"
                    autoComplete="off"
                    min="0.70"
                    max="0.99"
                    step="0.01"
                    value={retention}
                    onChange={(e) => {
                      setIsDirty(true);
                      setRetention(Number(e.target.value));
                    }}
                    aria-label={t("settings.requestRetention")}
                    aria-valuetext={`${(retention * 100).toFixed(0)}%`}
                    className="w-full h-3 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {t("settings.requestRetentionDesc")}
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-500 transition-colors">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {t("settings.maxReviewInterval")}
                    </span>
                    <input
                      type="number"
                      autoComplete="off"
                      min="1"
                      max="36500"
                      value={maxInterval}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val >= 1 && val <= 36500) {
                          setIsDirty(true);
                          setMaxInterval(val);
                        }
                      }}
                      className="w-24 input-mobile text-right text-primary-600 dark:text-primary-400 font-bold bg-transparent border-b border-primary-200 dark:border-primary-800 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/50 transition-all"
                    />
                  </div>
                  <input
                    type="range"
                    autoComplete="off"
                    min="1"
                    max="36500"
                    step="10"
                    value={maxInterval}
                    onChange={(e) => {
                      setIsDirty(true);
                      setMaxInterval(Number(e.target.value));
                    }}
                    aria-label={t("settings.maxReviewInterval")}
                    aria-valuetext={`${maxInterval}`}
                    className="w-full h-3 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {t("settings.maxIntervalDesc")}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="font-semibold text-gray-700 dark:text-gray-300 text-sm">
                {t("settings.studyStrategy.masteryThresholds")}
              </label>
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-500 transition-colors">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {t('settings.studyStrategy.learningReviewDivider')}
                    </span>
                    <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                      {masteryThresholds.learningReview.toFixed(1)}
                    </span>
                  </div>
                  <input
                    type="range"
                    autoComplete="off"
                    min="0.1"
                    max="0.5"
                    step="0.05"
                    value={masteryThresholds.learningReview}
                    onChange={(e) => {
                      setIsDirty(true);
                      setMasteryThresholds((prev) => ({
                        ...prev,
                        learningReview: Number(e.target.value),
                      }));
                    }}
                    aria-label={t('settings.studyStrategy.learningReviewDivider')}
                    aria-valuetext={`${masteryThresholds.learningReview.toFixed(2)}`}
                    className="w-full h-3 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {t('settings.studyStrategy.learningReviewDesc')}
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-500 transition-colors">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {t('settings.studyStrategy.reviewPracticeDivider')}
                    </span>
                    <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                      {masteryThresholds.reviewPractice.toFixed(1)}
                    </span>
                  </div>
                  <input
                    type="range"
                    autoComplete="off"
                    min="0.3"
                    max="0.7"
                    step="0.05"
                    value={masteryThresholds.reviewPractice}
                    onChange={(e) => {
                      setIsDirty(true);
                      setMasteryThresholds((prev) => ({
                        ...prev,
                        reviewPractice: Number(e.target.value),
                      }));
                    }}
                    aria-label={t('settings.studyStrategy.reviewPracticeDivider')}
                    aria-valuetext={`${masteryThresholds.reviewPractice.toFixed(2)}`}
                    className="w-full h-3 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {t('settings.studyStrategy.reviewPracticeDesc')}
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-500 transition-colors">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {t('settings.studyStrategy.practiceQuizDivider')}
                    </span>
                    <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                      {masteryThresholds.practiceQuiz.toFixed(1)}
                    </span>
                  </div>
                  <input
                    type="range"
                    autoComplete="off"
                    min="0.5"
                    max="0.9"
                    step="0.05"
                    value={masteryThresholds.practiceQuiz}
                    onChange={(e) => {
                      setIsDirty(true);
                      setMasteryThresholds((prev) => ({
                        ...prev,
                        practiceQuiz: Number(e.target.value),
                      }));
                    }}
                    aria-label={t('settings.studyStrategy.practiceQuizDivider')}
                    aria-valuetext={`${masteryThresholds.practiceQuiz.toFixed(2)}`}
                    className="w-full h-3 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {t('settings.studyStrategy.practiceQuizDesc')}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="font-semibold text-gray-700 dark:text-gray-300 text-sm">
                {t("settings.studyStrategy.schedulerWeights")}
              </label>
              <div className="space-y-4">
                {[
                  { key: "timeSlot" as const },
                  { key: "mastery" as const },
                  { key: "dependency" as const },
                  { key: "typeMatch" as const },
                  { key: "priority" as const },
                  { key: "urgency" as const },
                  { key: "availability" as const },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-500 transition-colors"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {t(`settings.studyStrategy.schedulerWeightItems.${item.key}.label`)}
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {t(`settings.studyStrategy.schedulerWeightItems.${item.key}.description`)}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-primary-600 dark:text-primary-400 ml-4 shrink-0">
                        {schedulerWeights[item.key].toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      autoComplete="off"
                      min="0"
                      max="0.5"
                      step="0.05"
                      value={schedulerWeights[item.key]}
                      onChange={(e) => {
                        setIsDirty(true);
                        setSchedulerWeights((prev) => ({
                          ...prev,
                          [item.key]: Number(e.target.value),
                        }));
                      }}
                      aria-label={t(`settings.studyStrategy.schedulerWeightItems.${item.key}.label`)}
                      aria-valuetext={`${schedulerWeights[item.key].toFixed(2)}`}
                      className="w-full h-3 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-slate-500">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Brain className="w-4 h-4 text-primary-500" />
                {t("settings.semanticScheduling")}
              </h3>

              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                <div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {t("settings.semanticScheduling")}
                  </span>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {t("settings.semanticSchedulingDesc")}
                  </p>
                </div>
                <div
                  role="switch"
                  aria-checked={semanticScheduling}
                  aria-label={t("settings.semanticScheduling")}
                  tabIndex={0}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    semanticScheduling ? "bg-primary-600" : "bg-gray-200 dark:bg-gray-700"
                  }`}
                  onClick={() => {
                    setIsDirty(true);
                    setSemanticScheduling(!semanticScheduling);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setIsDirty(true);
                      setSemanticScheduling(!semanticScheduling);
                    }
                  }}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      semanticScheduling ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    },
  );
