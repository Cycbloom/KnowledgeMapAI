import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Network,
  Clock,
  GitBranch,
  Globe,
  LayoutGrid,
  Map as MapIcon,
  ZoomIn,
  Wand2,
  Palette,
  Check,
  RotateCcw,
} from "lucide-react";
import type { GraphViewMode } from "@shared/types";

export interface GraphEditorPreferences {
  defaultViewMode: GraphViewMode;
  defaultZoomLevel: number | "fit";
  autoLayoutOnSave: boolean;
  defaultNodeColor: string;
}

const DEFAULT_PREFERENCES: GraphEditorPreferences = {
  defaultViewMode: "mindmap",
  defaultZoomLevel: "fit",
  autoLayoutOnSave: true,
  defaultNodeColor: "#6366f1",
};

const STORAGE_KEY = "graphEditorPreferences";

const loadPreferences = (): GraphEditorPreferences => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error("Failed to load graph editor preferences:", error);
  }
  return DEFAULT_PREFERENCES;
};

const savePreferences = (preferences: GraphEditorPreferences): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch (error) {
    console.error("Failed to save graph editor preferences:", error);
  }
};

const VIEW_MODES: Array<{
  mode: GraphViewMode;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { mode: "mindmap", labelKey: "settings.graphEditor.viewModes.mindmap", icon: Network },
  { mode: "timeline", labelKey: "settings.graphEditor.viewModes.timeline", icon: Clock },
  { mode: "tree", labelKey: "settings.graphEditor.viewModes.tree", icon: GitBranch },
  { mode: "planet", labelKey: "settings.graphEditor.viewModes.planet", icon: Globe },
  { mode: "quadrant", labelKey: "settings.graphEditor.viewModes.quadrant", icon: LayoutGrid },
  { mode: "semantic", labelKey: "settings.graphEditor.viewModes.semantic", icon: MapIcon },
];

const ZOOM_LEVELS: Array<{ value: number | "fit"; labelKey: string }> = [
  { value: "fit", labelKey: "settings.graphEditor.zoomFit" },
  { value: 0.5, labelKey: "settings.graphEditor.zoom50" },
  { value: 0.75, labelKey: "settings.graphEditor.zoom75" },
  { value: 1, labelKey: "settings.graphEditor.zoom100" },
  { value: 1.25, labelKey: "settings.graphEditor.zoom125" },
  { value: 1.5, labelKey: "settings.graphEditor.zoom150" },
];

const NODE_COLORS: Array<{ value: string; labelKey: string }> = [
  { value: "#6366f1", labelKey: "settings.graphEditor.colorIndigo" },
  { value: "#3b82f6", labelKey: "settings.graphEditor.colorBlue" },
  { value: "#10b981", labelKey: "settings.graphEditor.colorGreen" },
  { value: "#f59e0b", labelKey: "settings.graphEditor.colorAmber" },
  { value: "#ef4444", labelKey: "settings.graphEditor.colorRed" },
  { value: "#8b5cf6", labelKey: "settings.graphEditor.colorPurple" },
  { value: "#ec4899", labelKey: "settings.graphEditor.colorPink" },
  { value: "#64748b", labelKey: "settings.graphEditor.colorSlate" },
];

export const GraphEditorSettings = React.memo(function GraphEditorSettings() {
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState<GraphEditorPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    setPreferences(loadPreferences());
  }, []);

  const updatePreference = <K extends keyof GraphEditorPreferences>(
    key: K,
    value: GraphEditorPreferences[K],
  ): void => {
    const updated = { ...preferences, [key]: value };
    setPreferences(updated);
    savePreferences(updated);
  };

  const handleReset = (): void => {
    setPreferences(DEFAULT_PREFERENCES);
    savePreferences(DEFAULT_PREFERENCES);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 md:p-6 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Network className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {t("settings.graphEditor.title")}
          </h2>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          {t("settings.graphEditor.reset")}
        </button>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
        {t("settings.graphEditor.description")}
      </p>

      <div className="space-y-6">
        {/* Default view mode */}
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
            {t("settings.graphEditor.defaultViewMode")}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {VIEW_MODES.map(({ mode, labelKey, icon: Icon }) => (
              <button
                key={mode}
                onClick={() => updatePreference("defaultViewMode", mode)}
                className={`flex items-center gap-2 justify-center p-3 rounded-lg border transition-all min-h-[56px] ${
                  preferences.defaultViewMode === mode
                    ? "bg-primary-50 border-primary-200 text-primary-700 ring-1 ring-primary-200 dark:bg-primary-900/30 dark:border-primary-800 dark:text-primary-300"
                    : "bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-slate-900/50 dark:border-slate-700 dark:text-gray-400 dark:hover:bg-slate-700"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium text-sm">{t(labelKey)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Default zoom level */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
            <ZoomIn className="w-4 h-4 text-gray-400" />
            {t("settings.graphEditor.defaultZoomLevel")}
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {ZOOM_LEVELS.map(({ value, labelKey }) => (
              <button
                key={String(value)}
                onClick={() => updatePreference("defaultZoomLevel", value)}
                className={`flex items-center justify-center p-2.5 rounded-lg border text-sm font-medium transition-all ${
                  preferences.defaultZoomLevel === value
                    ? "bg-primary-50 border-primary-200 text-primary-700 ring-1 ring-primary-200 dark:bg-primary-900/30 dark:border-primary-800 dark:text-primary-300"
                    : "bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100 dark:bg-slate-900/50 dark:border-slate-700 dark:text-gray-400 dark:hover:bg-slate-700"
                }`}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* Auto-layout on save */}
        <div className="pt-4 border-t border-gray-100 dark:border-slate-700">
          <label className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
            <div>
              <span className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <Wand2 className="w-4 h-4 text-gray-400" />
                {t("settings.graphEditor.autoLayoutOnSave")}
              </span>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {t("settings.graphEditor.autoLayoutOnSaveDesc")}
              </p>
            </div>
            <div
              role="switch"
              aria-checked={preferences.autoLayoutOnSave}
              tabIndex={0}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                preferences.autoLayoutOnSave ? "bg-primary-600" : "bg-gray-200 dark:bg-gray-700"
              }`}
              onClick={() => updatePreference("autoLayoutOnSave", !preferences.autoLayoutOnSave)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  updatePreference("autoLayoutOnSave", !preferences.autoLayoutOnSave);
                }
              }}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  preferences.autoLayoutOnSave ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </div>
          </label>
        </div>

        {/* Default node color */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
            <Palette className="w-4 h-4 text-gray-400" />
            {t("settings.graphEditor.defaultNodeColor")}
          </label>
          <div className="flex flex-wrap gap-2">
            {NODE_COLORS.map(({ value, labelKey }) => (
              <button
                key={value}
                onClick={() => updatePreference("defaultNodeColor", value)}
                title={t(labelKey)}
                aria-label={t(labelKey)}
                className={`flex items-center justify-center w-10 h-10 rounded-lg border-2 transition-all ${
                  preferences.defaultNodeColor === value
                    ? "ring-2 ring-offset-2 ring-primary-500 dark:ring-offset-slate-800 border-transparent"
                    : "border-gray-200 dark:border-slate-600 hover:scale-105"
                }`}
                style={{ backgroundColor: value }}
              >
                {preferences.defaultNodeColor === value && (
                  <Check className="w-4 h-4 text-white" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});
