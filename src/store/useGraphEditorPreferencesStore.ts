import { createPersistedStore } from "./createPersistedStore";
import type { UserSettingsGraphEditor } from "@shared/types";

interface GraphEditorPreferencesState extends UserSettingsGraphEditor {
  updatePreferences: (partial: Partial<UserSettingsGraphEditor>) => void;
  reset: () => void;
}

const DEFAULT_PREFERENCES: UserSettingsGraphEditor = {
  defaultViewMode: "mindmap",
  defaultZoomLevel: "fit",
  autoLayoutOnSave: true,
  defaultNodeColor: "#6366f1",
  searchNodeNavigateTarget: "graph",
};

export { DEFAULT_PREFERENCES };

export const useGraphEditorPreferencesStore =
  createPersistedStore<GraphEditorPreferencesState>(
    "graph-editor",
    (set) => ({
      ...DEFAULT_PREFERENCES,

      updatePreferences: (partial) => {
        set((state) => ({ ...state, ...partial }));
      },

      reset: () => {
        set({ ...DEFAULT_PREFERENCES });
      },
    }),
    {
      partialize: (state) => ({
        defaultViewMode: state.defaultViewMode,
        defaultZoomLevel: state.defaultZoomLevel,
        autoLayoutOnSave: state.autoLayoutOnSave,
        defaultNodeColor: state.defaultNodeColor,
        searchNodeNavigateTarget: state.searchNodeNavigateTarget,
      }),
    },
  );
