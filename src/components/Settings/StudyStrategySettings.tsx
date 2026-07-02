import React, { useState, useLayoutEffect, useEffect, useRef } from "react";
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

      const skipNextSaveRef = useRef(true);

      useLayoutEffect(() => {
        if (settings) {
          if (settings.request_retention)
            setRetention(Number(settings.request_retention));
          if (settings.maximum_interval)
            setMaxInterval(Number(settings.maximum_interval));
          if (settings.defaultStudyMode)
            setDefaultStudyMode(settings.defaultStudyMode as string);
          if (settings.masteryThresholds)
            setMasteryThresholds(settings.masteryThresholds as typeof DEFAULT_MASTERY_THRESHOLDS);
          if (settings.schedulerWeights)
            setSchedulerWeights(settings.schedulerWeights as typeof DEFAULT_SCHEDULER_WEIGHTS);
          if (settings.semantic_scheduling !== undefined)
            setSemanticScheduling(settings.semantic_scheduling as boolean);
          // Skip auto-save after loading values from the profile to avoid
          // immediately writing back the data we just received.
          skipNextSaveRef.current = true;
        }
      }, [settings]);

      useEffect(() => {
        if (skipNextSaveRef.current) {
          skipNextSaveRef.current = false;
          return;
        }
        const timer = setTimeout(() => {
          updateProfileMutation
            .mutateAsync({
              settings: {
                ...settings,
                request_retention: Number(retention),
                maximum_interval: Number(maxInterval),
                defaultStudyMode,
                masteryThresholds,
                schedulerWeights,
                semantic_scheduling: semanticScheduling,
                available_models: availableModels,
              },
            })
            .then(() => {
              message.success(t("settings.saveSuccess"));
            })
            .catch(() => {
              message.error(t("settings.saveFailed"));
            });
        }, 800);
        return () => clearTimeout(timer);
      }, [
        retention,
        maxInterval,
        defaultStudyMode,
        masteryThresholds,
        schedulerWeights,
        semanticScheduling,
        availableModels,
        settings,
        updateProfileMutation,
        t,
      ]);

      const handleStudyModeChange = (mode: string) => {
        setDefaultStudyMode(mode);
        const preset = STUDY_MODE_PRESETS[mode];
        if (preset) {
          setRetention(preset.requestRetention);
          setMaxInterval(preset.maximumInterval);
        }
      };

      const handleResetStudyStrategyDefaults = () => {
        setDefaultStudyMode(STUDY_STRATEGY_DEFAULTS.defaultStudyMode);
        setRetention(STUDY_STRATEGY_DEFAULTS.requestRetention);
        setMaxInterval(STUDY_STRATEGY_DEFAULTS.maximumInterval);
        setMasteryThresholds({ ...DEFAULT_MASTERY_THRESHOLDS });
        setSchedulerWeights({ ...DEFAULT_SCHEDULER_WEIGHTS });
      };

      return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 md:p-6 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                学习策略
              </h2>
            </div>
            <button
              onClick={handleResetStudyStrategyDefaults}
              className="px-3 py-1.5 text-xs rounded-md border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            >
              恢复默认设置
            </button>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <label className="font-semibold text-gray-700 dark:text-gray-300 text-sm">
                默认学习模式
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {STUDY_MODE_OPTIONS.map((mode) => (
                  <div
                    key={mode.value}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      defaultStudyMode === mode.value
                        ? "border-primary-300 bg-primary-50 dark:border-primary-700 dark:bg-primary-900/20"
                        : "border-gray-200 dark:border-slate-600 hover:border-primary-200 dark:hover:border-primary-800"
                    }`}
                    onClick={() => handleStudyModeChange(mode.value)}
                  >
                    <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{mode.label}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{mode.description}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="font-semibold text-gray-700 dark:text-gray-300 text-sm">
                间隔重复参数
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 transition-colors">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {t("settings.requestRetention")}
                    </span>
                    <input
                      type="number"
                      min="0.70"
                      max="0.99"
                      step="0.01"
                      value={retention}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val >= 0.7 && val <= 0.99)
                          setRetention(val);
                      }}
                      className="w-20 input-mobile text-right text-primary-600 dark:text-primary-400 font-bold bg-transparent border-b border-primary-200 dark:border-primary-800 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/50 transition-all"
                    />
                  </div>
                  <input
                    type="range"
                    min="0.70"
                    max="0.99"
                    step="0.01"
                    value={retention}
                    onChange={(e) => setRetention(Number(e.target.value))}
                    className="w-full h-3 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {t("settings.requestRetentionDesc")}
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 transition-colors">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {t("settings.maxReviewInterval")}
                    </span>
                    <input
                      type="number"
                      min="1"
                      max="36500"
                      value={maxInterval}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val >= 1 && val <= 36500)
                          setMaxInterval(val);
                      }}
                      className="w-24 input-mobile text-right text-primary-600 dark:text-primary-400 font-bold bg-transparent border-b border-primary-200 dark:border-primary-800 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/50 transition-all"
                    />
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="36500"
                    step="10"
                    value={maxInterval}
                    onChange={(e) => setMaxInterval(Number(e.target.value))}
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
                掌握度阈值
              </label>
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 transition-colors">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Learning / Review 分界值
                    </span>
                    <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                      {masteryThresholds.learningReview.toFixed(1)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="0.5"
                    step="0.05"
                    value={masteryThresholds.learningReview}
                    onChange={(e) =>
                      setMasteryThresholds((prev) => ({
                        ...prev,
                        learningReview: Number(e.target.value),
                      }))
                    }
                    className="w-full h-3 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    低于此值视为学习阶段，高于此值进入复习阶段
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 transition-colors">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Review / Practice 分界值
                    </span>
                    <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                      {masteryThresholds.reviewPractice.toFixed(1)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.3"
                    max="0.7"
                    step="0.05"
                    value={masteryThresholds.reviewPractice}
                    onChange={(e) =>
                      setMasteryThresholds((prev) => ({
                        ...prev,
                        reviewPractice: Number(e.target.value),
                      }))
                    }
                    className="w-full h-3 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    低于此值需要复习巩固，高于此值进入练习阶段
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 transition-colors">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Practice / Quiz 分界值
                    </span>
                    <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                      {masteryThresholds.practiceQuiz.toFixed(1)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="0.9"
                    step="0.05"
                    value={masteryThresholds.practiceQuiz}
                    onChange={(e) =>
                      setMasteryThresholds((prev) => ({
                        ...prev,
                        practiceQuiz: Number(e.target.value),
                      }))
                    }
                    className="w-full h-3 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    低于此值需要练习强化，高于此值可以进入测验
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="font-semibold text-gray-700 dark:text-gray-300 text-sm">
                调度权重
              </label>
              <div className="space-y-4">
                {[
                  { key: "timeSlot" as const, label: "时间段适配", desc: "根据当前时间段推荐适合的学习内容" },
                  { key: "mastery" as const, label: "掌握度优先", desc: "优先推荐掌握度较低的节点进行学习" },
                  { key: "dependency" as const, label: "依赖关系", desc: "优先学习前置依赖节点" },
                  { key: "typeMatch" as const, label: "类型匹配", desc: "匹配当前学习模式的内容类型" },
                  { key: "priority" as const, label: "优先级", desc: "按节点优先级排序" },
                  { key: "urgency" as const, label: "紧急程度", desc: "临近截止日期的节点优先" },
                  { key: "availability" as const, label: "可用性", desc: "考虑当前可用的学习资源" },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 transition-colors"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {item.label}
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {item.desc}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-primary-600 dark:text-primary-400 ml-4 shrink-0">
                        {schedulerWeights[item.key].toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="0.5"
                      step="0.05"
                      value={schedulerWeights[item.key]}
                      onChange={(e) =>
                        setSchedulerWeights((prev) => ({
                          ...prev,
                          [item.key]: Number(e.target.value),
                        }))
                      }
                      className="w-full h-3 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Brain className="w-4 h-4 text-primary-500" />
                {t("settings.semanticScheduling")}
              </h3>

              <label className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                <div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {t("settings.semanticScheduling")}
                  </span>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {t("settings.semanticSchedulingDesc")}
                  </p>
                </div>
                <div
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    semanticScheduling ? "bg-primary-600" : "bg-gray-200 dark:bg-gray-700"
                  }`}
                  onClick={() => setSemanticScheduling(!semanticScheduling)}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      semanticScheduling ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </div>
              </label>
            </div>
          </div>
        </div>
      );
    },
  );
