import type {
  NotificationType,
  ThemePreset,
  UserSettingsAILanguage,
  UserSettingsAppearance,
  UserSettingsContentWidthMode,
  UserSettingsDatabase,
  UserSettingsFocus,
  UserSettingsGraphEditor,
  UserSettingsLearning,
  UserSettingsMixedNoise,
  UserSettingsNoise,
  UserSettingsNoisePreset,
  UserSettingsNotifications,
  UserSettingsPaginationMode,
  UserSettingsProviderConfig,
  UserSettingsReadingMode,
  UserSettingsShortcutKey,
  UserSettingsShortcuts,
  UserSettingsThemeMode,
  UserSettingsUiFontFamily,
  UserSettingsWhiteNoiseType,
} from "@shared/types";
import type { StudyStrategyValues } from "@/components/Settings/settingsConstants";

import { api } from "@/services/api";
import { authApi } from "@/services/api/auth";
import { apiClient } from "@/services/api/createApiClient";
import { mobileAIService } from "@/services/ai";
import { useFocusStore } from "@/store/useFocusStore";
import { useGraphEditorPreferencesStore } from "@/store/useGraphEditorPreferencesStore";
import { useLearningSettingsStore } from "@/store/useLearningSettingsStore";
import { useNoiseStore } from "@/store/useNoiseStore";
import { useNotificationsStore } from "@/store/useNotificationsStore";
import { useShortcutStore } from "@/store/useShortcutStore";
import { useThemeStore } from "@/store/useThemeStore";
import { useStore } from "@/store/useStore";

/**
 * Unified settings facade.
 *
 * Provides a single entry point for reading and writing every settings domain
 * in the application. Client-side domains delegate to the corresponding
 * Zustand stores (persisted via `createPersistedStore` to localStorage);
 * server-side domains delegate to the existing API modules. No new storage is
 * introduced — this is a thin orchestration layer only.
 *
 * Domain → storage map:
 *  - appearance     → useThemeStore (localStorage key "theme")
 *  - focus          → useFocusStore (localStorage key "focus")
 *  - learning       → useLearningSettingsStore (localStorage key "learning-settings")
 *  - graphEditor    → useGraphEditorPreferencesStore (localStorage key "graph-editor")
 *  - notifications  → useNotificationsStore (localStorage key "notifications")
 *  - shortcuts      → useShortcutStore (localStorage key "shortcut")
 *  - noise          → useNoiseStore (localStorage key "noise")
 *  - prompts        → api.prompts (server: prompt_templates table)
 *  - aiActions      → api.aiActions (server: ai_actions table)
 *  - aiProviders    → apiClient "/ai/config/providers" (server)
 *  - aiMobile       → mobileAIService (localStorage key "mobile_ai_config")
 *  - studyStrategy  → authApi.updateProfile (server: users.settings JSONB)
 *  - studyAlgorithm → api.study FSRS endpoints (server: /study/fsrs-parameters)
 *  - voice          → api.tts / api.stt (server: /ai/tts/*, /ai/stt/*)
 *  - database       → apiClient "/ai/config/database" (server)
 *  - plugins        → api.plugins (server: /plugins/*)
 */
export const settingsService = {
  /**
   * Appearance settings. Backed by `useThemeStore` (localStorage key "theme").
   */
  appearance: {
    get: (): UserSettingsAppearance => {
      const { themeMode, themePreset, uiFontFamily } = useThemeStore.getState();
      return { themeMode, themePreset, uiFontFamily };
    },
    setThemeMode: (mode: UserSettingsThemeMode) =>
      useThemeStore.getState().setThemeMode(mode),
    setThemePreset: (preset: ThemePreset) =>
      useThemeStore.getState().setThemePreset(preset),
    setUiFontFamily: (font: UserSettingsUiFontFamily) =>
      useThemeStore.getState().setUiFontFamily(font),
  },

  /**
   * Focus / Pomodoro settings. Backed by `useFocusStore` (localStorage key
   * "focus"). The `update` method covers the eight core duration/flag fields;
   * highlight fields have dedicated setters.
   */
  focus: {
    get: (): UserSettingsFocus => {
      const s = useFocusStore.getState();
      return {
        focusDuration: s.focusDuration,
        shortBreakDuration: s.shortBreakDuration,
        longBreakDuration: s.longBreakDuration,
        longBreakInterval: s.longBreakInterval,
        autoStartBreak: s.autoStartBreak,
        autoStartPomodoro: s.autoStartPomodoro,
        soundEnabled: s.soundEnabled,
        notificationEnabled: s.notificationEnabled,
        highlightEnabled: s.highlightEnabled,
        highlightIntensity: s.highlightIntensity,
      };
    },
    update: (
      partial: Partial<
        Pick<
          UserSettingsFocus,
          | "focusDuration"
          | "shortBreakDuration"
          | "longBreakDuration"
          | "longBreakInterval"
          | "autoStartBreak"
          | "autoStartPomodoro"
          | "soundEnabled"
          | "notificationEnabled"
        >
      >,
    ) => useFocusStore.getState().updateSettings(partial),
    setHighlightEnabled: (enabled: boolean) =>
      useFocusStore.getState().setHighlightEnabled(enabled),
    setHighlightIntensity: (intensity: number) =>
      useFocusStore.getState().setHighlightIntensity(intensity),
  },

  /**
   * Learning / reading settings. Backed by `useLearningSettingsStore`
   * (localStorage key "learning-settings").
   */
  learning: {
    get: (): UserSettingsLearning => {
      const s = useLearningSettingsStore.getState();
      return {
        fontSize: s.fontSize,
        fontFamily: s.fontFamily,
        lineHeight: s.lineHeight,
        readingMode: s.readingMode,
        paginationMode: s.paginationMode,
        contentWidthMode: s.contentWidthMode,
        aiLanguage: s.aiLanguage,
        materialLanguage: s.materialLanguage,
      };
    },
    setFontSize: (size: number) =>
      useLearningSettingsStore.getState().setFontSize(size),
    setReadingMode: (mode: UserSettingsReadingMode) =>
      useLearningSettingsStore.getState().setReadingMode(mode),
    setPaginationMode: (mode: UserSettingsPaginationMode) =>
      useLearningSettingsStore.getState().setPaginationMode(mode),
    setContentWidthMode: (mode: UserSettingsContentWidthMode) =>
      useLearningSettingsStore.getState().setContentWidthMode(mode),
    setAILanguage: (language: UserSettingsAILanguage) =>
      useLearningSettingsStore.getState().setAILanguage(language),
    reset: () => useLearningSettingsStore.getState().resetSettings(),
  },

  /**
   * Graph editor preferences. Backed by `useGraphEditorPreferencesStore`
   * (localStorage key "graph-editor").
   */
  graphEditor: {
    get: (): UserSettingsGraphEditor => {
      const {
        defaultViewMode,
        defaultZoomLevel,
        autoLayoutOnSave,
        defaultNodeColor,
        searchNodeNavigateTarget,
      } = useGraphEditorPreferencesStore.getState();
      return {
        defaultViewMode,
        defaultZoomLevel,
        autoLayoutOnSave,
        defaultNodeColor,
        searchNodeNavigateTarget,
      };
    },
    update: (partial: Partial<UserSettingsGraphEditor>) =>
      useGraphEditorPreferencesStore.getState().updatePreferences(partial),
    reset: () => useGraphEditorPreferencesStore.getState().reset(),
  },

  /**
   * Notification preferences. Backed by `useNotificationsStore`
   * (localStorage key "notifications").
   */
  notifications: {
    get: (): UserSettingsNotifications => {
      const { mutedNotificationTypes } = useNotificationsStore.getState();
      return { mutedNotificationTypes };
    },
    setMutedTypes: (types: NotificationType[]) =>
      useNotificationsStore.getState().setMutedNotificationTypes(types),
    toggleMutedType: (type: NotificationType) =>
      useNotificationsStore.getState().toggleMutedType(type),
    clearMuted: () => useNotificationsStore.getState().clearMuted(),
  },

  /**
   * Keyboard shortcuts. Backed by `useShortcutStore` (localStorage key
   * "shortcut").
   */
  shortcuts: {
    get: (): UserSettingsShortcuts => {
      const { bindings, enabled } = useShortcutStore.getState();
      return { bindings, enabled };
    },
    setBinding: (id: string, keys: UserSettingsShortcutKey) =>
      useShortcutStore.getState().setBinding(id, keys),
    resetBinding: (id: string) =>
      useShortcutStore.getState().resetBinding(id),
    resetAllBindings: () => useShortcutStore.getState().resetAllBindings(),
    toggleShortcut: (id: string, enabled: boolean) =>
      useShortcutStore.getState().toggleShortcut(id, enabled),
    setEnabled: (enabled: boolean) =>
      useShortcutStore.getState().setEnabled(enabled),
  },

  /**
   * White-noise / ambient sound settings. Backed by `useNoiseStore`
   * (localStorage key "noise").
   */
  noise: {
    get: (): UserSettingsNoise => {
      const {
        selectedNoise,
        noiseVolume,
        mixedNoises,
        customPresets,
        activePresetId,
      } = useNoiseStore.getState();
      return {
        selectedNoise,
        noiseVolume,
        mixedNoises,
        customPresets,
        activePresetId,
      };
    },
    setNoise: (noise: UserSettingsWhiteNoiseType) =>
      useNoiseStore.getState().setNoise(noise),
    setNoiseVolume: (volume: number) =>
      useNoiseStore.getState().setNoiseVolume(volume),
    addMixedNoise: (noise: UserSettingsMixedNoise) =>
      useNoiseStore.getState().addMixedNoise(noise),
    removeMixedNoise: (type: UserSettingsWhiteNoiseType) =>
      useNoiseStore.getState().removeMixedNoise(type),
    updateMixedNoiseVolume: (
      type: UserSettingsWhiteNoiseType,
      volume: number,
    ) => useNoiseStore.getState().updateMixedNoiseVolume(type, volume),
    clearMixedNoises: () => useNoiseStore.getState().clearMixedNoises(),
    saveCustomPreset: (name: string) =>
      useNoiseStore.getState().saveCustomPreset(name),
    deleteCustomPreset: (id: string) =>
      useNoiseStore.getState().deleteCustomPreset(id),
    loadPreset: (preset: UserSettingsNoisePreset) =>
      useNoiseStore.getState().loadPreset(preset),
    setActivePresetId: (id: string | null) =>
      useNoiseStore.getState().setActivePresetId(id),
  },

  /**
   * Prompt templates. Backed by `api.prompts` (server: prompt_templates table
   * via "/prompts" endpoints).
   */
  prompts: {
    list: api.prompts.list,
    save: api.prompts.save,
    reset: api.prompts.reset,
    optimize: api.prompts.optimize,
  },

  /**
   * AI actions. Backed by `api.aiActions` (server: ai_actions table via
   * "/ai-actions" endpoints).
   */
  aiActions: {
    list: api.aiActions.list,
    create: api.aiActions.create,
    update: api.aiActions.update,
    delete: api.aiActions.delete,
    execute: api.aiActions.execute,
  },

  /**
   * AI provider configs (API keys / base URLs / models). Backed by the
   * "/ai/config/providers" server endpoint via `apiClient`.
   */
  aiProviders: {
    list: () =>
      apiClient.get("/ai/config/providers") as Promise<{
        providers: Record<string, UserSettingsProviderConfig>;
      }>,
    update: (
      providers: Record<string, { apiKey?: string; baseURL?: string; model?: string }>,
    ) => apiClient.put("/ai/config/providers", { providers }),
    test: (data: {
      provider: string;
      apiKey: string;
      baseURL: string;
      model: string;
    }) =>
      apiClient.post("/ai/config/providers/test", data) as Promise<{
        success: boolean;
        message: string;
      }>,
  },

  /**
   * Mobile AI config (Capacitor). Backed by `mobileAIService` (localStorage
   * key "mobile_ai_config").
   */
  aiMobile: {
    getConfig: mobileAIService.getConfig,
    setConfig: mobileAIService.setConfig,
    clearConfig: mobileAIService.clearConfig,
    isConfigured: mobileAIService.isConfigured,
  },

  /**
   * Study strategy (FSRS retention/interval, study mode, mastery thresholds,
   * scheduler weights). Backed by `authApi.updateProfile` — persisted in the
   * `users.settings` JSONB column. Reads come from the current user store
   * snapshot.
   */
  studyStrategy: {
    get: () => useStore.getState().user?.profile?.settings,
    save: (values: StudyStrategyValues) => {
      const existing = useStore.getState().user?.profile?.settings;
      return authApi.updateProfile({
        settings: { ...existing, ...values },
      });
    },
  },

  /**
   * Study algorithm (FSRS parameters). Backed by `api.study` FSRS endpoints
   * (server: "/study/fsrs-parameters").
   */
  studyAlgorithm: {
    getParameters: api.study.getFsrsParameters,
    setParameters: api.study.setFsrsParameters,
    resetParameters: api.study.resetFsrsParameters,
    optimizeParameters: api.study.optimizeFsrsParameters,
  },

  /**
   * Voice services (TTS / STT). Backed by `api.tts` and `api.stt` (server:
   * "/ai/tts/*", "/ai/stt/*").
   */
  voice: {
    tts: {
      health: api.tts.health,
      voices: api.tts.voices,
      synthesize: api.tts.synthesize,
    },
    stt: {
      health: api.stt.health,
      transcribe: api.stt.transcribe,
    },
  },

  /**
   * Database (Supabase) config. Backed by the "/ai/config/database" and
   * "/database/*" server endpoints via `apiClient`.
   */
  database: {
    get: () =>
      apiClient.get("/ai/config/database") as Promise<UserSettingsDatabase>,
    update: (data: {
      url: string;
      anonKey: string;
      serviceRoleKey?: string;
      databaseUrl?: string;
    }) => apiClient.put("/ai/config/database", data),
    getSchemaStatus: () =>
      apiClient.get("/database/status") as Promise<{
        status: string;
        executedCount: number;
        totalMigrations: number;
        missingVersions: string[];
      }>,
    migrate: () => apiClient.post("/database/migrate"),
    reinitialize: () =>
      apiClient.post("/database/reinitialize", { confirm: true }),
  },

  /**
   * Plugin marketplace. Backed by `api.plugins` (server: "/plugins/*").
   */
  plugins: {
    listRegistry: api.plugins.listRegistry,
    getRegistryPlugin: api.plugins.getRegistryPlugin,
    install: api.plugins.install,
    uninstall: api.plugins.uninstall,
    update: api.plugins.update,
    activate: api.plugins.activate,
    deactivate: api.plugins.deactivate,
    listInstalled: api.plugins.listInstalled,
    checkUpdates: api.plugins.checkUpdates,
    rate: api.plugins.rate,
  },

};
