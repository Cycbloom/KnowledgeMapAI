import React from "react";
import { useTranslation } from "react-i18next";
import { Network, Clock, GitBranch, Globe, LayoutGrid, Map as MapIcon } from "lucide-react";
import { GraphViewMode } from "../../../types";
import { useTheme } from "../../../hooks";

interface ViewModeSelectorProps {
  currentMode: GraphViewMode;
  onModeChange: (mode: GraphViewMode) => void;
}

const ViewModeSelector = React.memo(({
  currentMode,
  onModeChange,
}: ViewModeSelectorProps) => {
  const { isDark } = useTheme();
  const { t } = useTranslation();

  const viewModes: Array<{
    mode: GraphViewMode;
    labelKey: string;
    icon: React.ComponentType<any>;
    descriptionKey: string;
  }> = [
    {
      mode: "mindmap",
      labelKey: "graphEditor.toolbar.mindmap",
      icon: Network,
      descriptionKey: "graphEditor.toolbar.mindmapDesc",
    },
    {
      mode: "timeline",
      labelKey: "graphEditor.toolbar.timeline",
      icon: Clock,
      descriptionKey: "graphEditor.toolbar.timelineDesc",
    },
    {
      mode: "tree",
      labelKey: "graphEditor.toolbar.treeView",
      icon: GitBranch,
      descriptionKey: "graphEditor.toolbar.treeViewDesc",
    },
    {
      mode: "planet",
      labelKey: "graphEditor.toolbar.knowledgePlanet",
      icon: Globe,
      descriptionKey: "graphEditor.toolbar.planetDesc",
    },
    {
      mode: "semantic",
      labelKey: "graphEditor.toolbar.semantic",
      icon: MapIcon,
      descriptionKey: "graphEditor.toolbar.semanticDesc",
    },
    {
      mode: "quadrant",
      labelKey: "graphEditor.toolbar.quadrant",
      icon: LayoutGrid,
      descriptionKey: "graphEditor.toolbar.quadrantDesc",
    },
  ];

  return (
    <div className="flex items-center gap-2">
      {viewModes.map(({ mode, labelKey, icon: Icon, descriptionKey }) => (
        <button
          key={mode}
          onClick={() => onModeChange(mode)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            currentMode === mode
              ? isDark
                ? "bg-primary-600 text-white shadow-md"
                : "bg-primary-500 text-white shadow-md"
              : isDark
                ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
          title={t(descriptionKey)}
        >
          <Icon size={16} />
          <span className="hidden sm:inline">{t(labelKey)}</span>
        </button>
      ))}
    </div>
  );
});

export { ViewModeSelector };
