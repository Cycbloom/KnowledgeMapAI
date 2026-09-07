import React, { useState, useLayoutEffect, useEffect, useRef, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Zap, Play, RotateCcw } from "lucide-react";
import {
  PRE_GENERATION_DEFAULTS,
  PREGEN_CARD_TYPE_OPTIONS,
  PREGEN_CARD_DIFFICULTY_OPTIONS,
  PREGEN_CARD_COVERAGE_OPTIONS,
  PREGEN_LANGUAGE_OPTIONS,
  type PreGenerationForm,
} from "./settingsConstants";
import { useUpdateProfileMutation } from "../../hooks/mutations";
import { useAutoSave } from "../../hooks";
import { message } from "../../utils/messageHelper";
import { api } from "../../services/api";

interface PreGenerationSettingsProps {
  settings: Record<string, unknown> | undefined;
}

/**
 * AI 预生成设置分区。
 * - 配置存储于 users.settings.pre_generation（服务端 JSONB），自动保存；
 * - 「立即预生成」按钮调用 POST /ai/pre-generation/run，立即扫描排课入队任务。
 */
export const PreGenerationSettings = React.memo(
  function PreGenerationSettings({ settings }: PreGenerationSettingsProps) {
    const { t } = useTranslation();
    const updateProfileMutation = useUpdateProfileMutation();

    const [form, setForm] = useState<PreGenerationForm>({
      ...PRE_GENERATION_DEFAULTS,
    });
    const [isDirty, setIsDirty] = useState(false);
    const [isRunning, setIsRunning] = useState(false);

    // Refs hold the latest unstable values so onSave never captures stale closures.
    const settingsRef = useRef(settings);
    const mutationRef = useRef(updateProfileMutation);
    const tRef = useRef(t);
    useEffect(() => {
      settingsRef.current = settings;
      mutationRef.current = updateProfileMutation;
      tRef.current = t;
    });

    useLayoutEffect(() => {
      const raw = settings?.pre_generation;
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        setForm({
          ...PRE_GENERATION_DEFAULTS,
          ...(raw as Partial<PreGenerationForm>),
        });
        setIsDirty(false);
      }
    }, [settings]);

    const set = (patch: Partial<PreGenerationForm>) => {
      setIsDirty(true);
      setForm((prev) => ({ ...prev, ...patch }));
    };

    const toggleInArray = (key: "card_types" | "languages", value: string) => {
      setIsDirty(true);
      setForm((prev) => {
        const current = prev[key];
        const next = current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value];
        if (key === "card_types") return { ...prev, card_types: next };
        return { ...prev, languages: next };
      });
    };

    const handleResetDefaults = () => {
      setIsDirty(true);
      setForm({ ...PRE_GENERATION_DEFAULTS });
    };

    const handleRunNow = async () => {
      setIsRunning(true);
      try {
        const result = await api.ai.runPreGeneration();
        if (!result.enabled) {
          message.info(tRef.current("settings.preGeneration.runDisabled"));
        } else if (result.tasksEnqueued > 0) {
          message.success(
            tRef.current("settings.preGeneration.runSuccess", {
              count: result.tasksEnqueued,
            }),
          );
        } else {
          message.info(tRef.current("settings.preGeneration.runNoOp"));
        }
      } catch {
        message.error(tRef.current("settings.preGeneration.runFailed"));
      } finally {
        setIsRunning(false);
      }
    };

    const settingsValue = useMemo(() => form, [form]);

    useAutoSave({
      value: settingsValue,
      onSave: async () => {
        try {
          await mutationRef.current.mutateAsync({
            settings: {
              ...settingsRef.current,
              pre_generation: { ...form },
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

    const renderToggle = (
      labelKey: string,
      descKey: string,
      checked: boolean,
      onChange: (v: boolean) => void,
    ) => {
      const label = t(labelKey as never);
      const desc = t(descKey as never);
      return (
        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
          <div>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {label}
            </span>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {desc}
            </p>
          </div>
          <div
            role="switch"
            aria-checked={checked}
            aria-label={label}
            tabIndex={0}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
              checked ? "bg-primary-600" : "bg-gray-200 dark:bg-gray-700"
            }`}
            onClick={() => onChange(!checked)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onChange(!checked);
              }
            }}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                checked ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </div>
        </div>
      );
    };

    const renderNumber = (
      labelKey: string,
      descKey: string,
      value: number,
      onChange: (v: number) => void,
      min: number,
      max: number,
    ) => {
      const label = t(labelKey as never);
      const desc = t(descKey as never);
      return (
        <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-500 transition-colors">
          <div className="flex justify-between items-center mb-2">
            <div>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {label}
              </span>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {desc}
              </p>
            </div>
            <input
              type="number"
              autoComplete="off"
              min={min}
              max={max}
              value={value}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  onChange(Math.min(max, Math.max(min, val)));
                }
              }}
              aria-label={label}
              className="w-20 input-mobile text-right text-primary-600 dark:text-primary-400 font-bold bg-transparent border-b border-primary-200 dark:border-primary-800 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/50 transition-all"
            />
          </div>
        </div>
      );
    };

    const renderSelect = (
      labelKey: string,
      descKey: string,
      value: string,
      options: ReadonlyArray<{ value: string; labelKey: string }>,
      onChange: (v: string) => void,
    ) => {
      const label = t(labelKey as never);
      const desc = t(descKey as never);
      return (
        <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-500 transition-colors">
          <span className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
            {label}
          </span>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
            {desc}
          </p>
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label={label}
            className="w-full h-10 px-3 text-sm rounded-lg border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey as never)}
              </option>
            ))}
          </select>
        </div>
      );
    };

    const renderCheckGroup = (
      labelKey: string,
      descKey: string,
      options: ReadonlyArray<{ value: string; labelKey: string }>,
      selected: string[],
      onToggle: (v: string) => void,
    ): ReactNode => {
      const label = t(labelKey as never);
      const desc = t(descKey as never);
      return (
        <div className="p-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-500 transition-colors">
          <span className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
            {label}
          </span>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
            {desc}
          </p>
          <div className="flex flex-wrap gap-2">
            {options.map((opt) => {
              const checked = selected.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onToggle(opt.value)}
                  className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                    checked
                      ? "border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-700 dark:bg-primary-900/20 dark:text-primary-300"
                      : "border-gray-200 dark:border-slate-500 text-gray-600 dark:text-gray-400 hover:border-primary-200"
                  }`}
                >
                  {t(opt.labelKey as never)}
                </button>
              );
            })}
          </div>
        </div>
      );
    };

    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-500 p-4 md:p-6 transition-colors">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {t("settings.preGeneration.title")}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRunNow}
              disabled={isRunning}
              className="flex items-center gap-1.5 px-3 min-h-[44px] text-xs rounded-md border border-primary-300 text-primary-700 dark:border-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              {isRunning
                ? t("settings.preGeneration.runNowRunning")
                : t("settings.preGeneration.runNow")}
            </button>
            <button
              onClick={handleResetDefaults}
              className="flex items-center gap-1.5 px-3 min-h-[44px] text-xs rounded-md border border-gray-200 dark:border-slate-500 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t("settings.preGeneration.resetDefaults")}
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          {t("settings.preGeneration.subtitle")}
        </p>

        <div className="space-y-6">
          <div className="space-y-3">
            {renderToggle(
              "settings.preGeneration.enabled",
              "settings.preGeneration.enabledDesc",
              form.enabled,
              (v) => set({ enabled: v }),
            )}

            {!form.enabled && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {t("settings.preGeneration.disabledHint")}
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {renderNumber(
                "settings.preGeneration.leadDays",
                "settings.preGeneration.leadDaysDesc",
                form.lead_days,
                (v) => set({ lead_days: v }),
                1,
                14,
              )}
              {renderNumber(
                "settings.preGeneration.maxPerRun",
                "settings.preGeneration.maxPerRunDesc",
                form.max_knowledge_points_per_run,
                (v) => set({ max_knowledge_points_per_run: v }),
                1,
                50,
              )}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {t("settings.preGeneration.contentScope")}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {renderToggle(
                "settings.preGeneration.learningMaterial",
                "settings.preGeneration.learningMaterialDesc",
                form.learning_material,
                (v) => set({ learning_material: v }),
              )}
              {renderToggle(
                "settings.preGeneration.generateCards",
                "settings.preGeneration.generateCardsDesc",
                form.generate_cards,
                (v) => set({ generate_cards: v }),
              )}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {t("settings.preGeneration.cardsConfig")}
            </h3>
            <div className="space-y-4">
              {renderNumber(
                "settings.preGeneration.cardsPerKnowledgePoint",
                "settings.preGeneration.cardsPerKnowledgePointDesc",
                form.cards_per_knowledge_point,
                (v) => set({ cards_per_knowledge_point: v }),
                1,
                50,
              )}
              {renderCheckGroup(
                "settings.preGeneration.cardTypesLabel",
                "settings.preGeneration.cardTypesDesc",
                PREGEN_CARD_TYPE_OPTIONS,
                form.card_types,
                (v) => toggleInArray("card_types", v),
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {renderSelect(
                  "settings.preGeneration.cardDifficulty",
                  "settings.preGeneration.cardDifficultyDesc",
                  form.card_difficulty,
                  PREGEN_CARD_DIFFICULTY_OPTIONS,
                  (v) =>
                    set({ card_difficulty: v as PreGenerationForm["card_difficulty"] }),
                )}
                {renderSelect(
                  "settings.preGeneration.cardCoverage",
                  "settings.preGeneration.cardCoverageDesc",
                  form.card_coverage,
                  PREGEN_CARD_COVERAGE_OPTIONS,
                  (v) =>
                    set({ card_coverage: v as PreGenerationForm["card_coverage"] }),
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {t("settings.preGeneration.languagesLabel")}
            </h3>
            {renderCheckGroup(
              "settings.preGeneration.languagesLabel",
              "settings.preGeneration.languagesDesc",
              PREGEN_LANGUAGE_OPTIONS,
              form.languages,
              (v) => toggleInArray("languages", v),
            )}
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-slate-500 pt-3">
            {t("settings.preGeneration.hint")}
          </p>
        </div>
      </div>
    );
  },
);
