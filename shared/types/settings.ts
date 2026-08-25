import type { AIProviderType } from "./ai";
import type { GraphViewMode } from "./graph-core";
import type { NotificationType } from "./common";
import type { ThemePreset } from "./styles";
import type { UiFontFamilyId } from "@shared/constants/fonts";

/**
 * Unified user settings type.
 *
 * This is the single root type enumerating every settings domain in the
 * application. Each sub-interface mirrors the *persisted* field shape of an
 * existing store/component (the source is noted per section). Transient /
 * runtime-only fields (e.g. `isInFocusMode`, `currentNodeId`) are intentionally
 * excluded — this type describes persisted settings only.
 *
 * Naming: sub-types carry a `UserSettings*` prefix so the unified type is
 * self-contained and does not collide with the ad-hoc types still living under
 * `src/` (those are conformed to these sub-types in Task 7).
 */

// ---------------------------------------------------------------------------
// Appearance — mirrors src/hooks/common/useTheme.ts ThemeContextType persisted
// fields (themeMode + themePreset).
// ---------------------------------------------------------------------------

export type UserSettingsThemeMode = "light" | "dark" | "system";

export type UserSettingsUiFontFamily = UiFontFamilyId;

export interface UserSettingsAppearance {
  themeMode: UserSettingsThemeMode;
  themePreset: ThemePreset;
  uiFontFamily: UserSettingsUiFontFamily;
}

// ---------------------------------------------------------------------------
// Focus — mirrors src/store/useFocusStore.ts FocusState persisted fields
// (via partialize). Excludes transient `isInFocusMode` / `currentNodeId`.
// ---------------------------------------------------------------------------

export interface UserSettingsFocus {
  focusDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  longBreakInterval: number;
  autoStartBreak: boolean;
  autoStartPomodoro: boolean;
  soundEnabled: boolean;
  notificationEnabled: boolean;
  highlightEnabled: boolean;
  highlightIntensity: number;
}

// ---------------------------------------------------------------------------
// Learning — mirrors src/store/useLearningSettingsStore.ts persisted fields.
// NOTE: `readingMode` drops the legacy "dark" value; dark mode is now owned by
// the global theme (UserSettingsAppearance.themeMode). Existing users with
// readingMode === "dark" are migrated in Task 7.
// ---------------------------------------------------------------------------

export type UserSettingsReadingMode = "default" | "eye-care" | "sepia";
export type UserSettingsPaginationMode = "scroll" | "pagination";
export type UserSettingsContentWidthMode = "full" | "comfortable" | "narrow";
export type UserSettingsFontFamily =
  | "sans"
  | "serif"
  | "mono"
  | "noto-sans-sc"
  | "noto-serif-sc"
  | "lxgw-wenkai"
  | "sarasa-gothic-sc"
  | "inter"
  | "jetbrains-mono";
export type UserSettingsLineHeight = "compact" | "normal" | "relaxed";
export type UserSettingsAILanguage = "auto" | "zh-CN" | "en-US";

export interface UserSettingsLearning {
  fontSize: number;
  fontFamily: UserSettingsFontFamily;
  lineHeight: UserSettingsLineHeight;
  readingMode: UserSettingsReadingMode;
  paginationMode: UserSettingsPaginationMode;
  contentWidthMode: UserSettingsContentWidthMode;
  aiLanguage: UserSettingsAILanguage;
  /** 学习资料显示语言：auto=跟随 AI/界面语言设置（保持原有自动切换行为）；zh=中文版；en=英文版（双语学习，可手动切换） */
  materialLanguage: "auto" | "zh" | "en";
}

// ---------------------------------------------------------------------------
// Quiz (学习中心答题模式) — mirrors src/store/useQuizSettingsStore.ts
// persisted fields. Drives the reading appearance of flash/focus modes.
// ---------------------------------------------------------------------------

export interface UserSettingsQuiz {
  fontSize: number;
  lineHeight: UserSettingsLineHeight;
  contentWidthMode: UserSettingsContentWidthMode;
  /** 每题倒计时（秒）；0 表示关闭倒计时 */
  timerSeconds: number;
  /** 选择题每次随机排列选项，避免位置记忆 */
  optionShuffle: boolean;
  /** 答错/评价不佳（quality<3）的卡自动插到队尾稍后再练 */
  wrongRequeue: boolean;
  /** 测验模式进入时随机打乱整卷题目顺序 */
  examShuffleQuestions: boolean;
}

// ---------------------------------------------------------------------------
// Study — mirrors src/components/Settings/settingsConstants.ts
// StudyStrategyValues (server-side FSRS / scheduler strategy config).
// Field names preserve the existing snake_case where the source uses it.
// ---------------------------------------------------------------------------

export interface UserSettingsMasteryThresholds {
  learningReview: number;
  reviewPractice: number;
  practiceQuiz: number;
}

export interface UserSettingsSchedulerWeights {
  timeSlot: number;
  mastery: number;
  dependency: number;
  typeMatch: number;
  priority: number;
  urgency: number;
  availability: number;
}

export interface UserSettingsStudy {
  request_retention: number;
  maximum_interval: number;
  defaultStudyMode: string;
  masteryThresholds: UserSettingsMasteryThresholds;
  schedulerWeights: UserSettingsSchedulerWeights;
  semantic_scheduling: boolean;
  available_models: Record<string, string[]>;
}

// ---------------------------------------------------------------------------
// GraphEditor — mirrors src/components/Settings/GraphEditorSettings.tsx
// GraphEditorPreferences.
// ---------------------------------------------------------------------------

export type UserSettingsSearchNodeNavigateTarget = "graph" | "learning";

export interface UserSettingsGraphEditor {
  defaultViewMode: GraphViewMode;
  defaultZoomLevel: number | "fit";
  autoLayoutOnSave: boolean;
  defaultNodeColor: string;
  searchNodeNavigateTarget: UserSettingsSearchNodeNavigateTarget;
}

// ---------------------------------------------------------------------------
// Notifications — mirrors src/components/Settings/NotificationSettings.tsx
// mutedNotificationTypes localStorage shape.
// ---------------------------------------------------------------------------

export interface UserSettingsNotifications {
  mutedNotificationTypes: NotificationType[];
}

// ---------------------------------------------------------------------------
// Prompts — placeholder for graph-scoped prompt templates. Server-side; the
// concrete shape is defined by the prompt_templates table / promptService.
// Captured here only as scope/scenario metadata.
// ---------------------------------------------------------------------------

export type UserSettingsPromptScope = "user" | "graph";

export interface UserSettingsPrompts {
  scope: UserSettingsPromptScope;
  scenario?: string;
}

// ---------------------------------------------------------------------------
// AI — mirrors src/components/Settings/settingsConstants.ts provider config
// shapes (ProviderConfig, MainAiConfig, EmbeddingAiConfig, MobileAIConfig).
// `aiLanguage` is intentionally NOT duplicated here: it is stored in the
// learning store, so it lives under UserSettingsLearning (the AI-section UI
// re-categorization is handled in Task 13 and does not move the data).
// ---------------------------------------------------------------------------

export type UserSettingsProviderSource = "user" | "env" | "none";

export interface UserSettingsProviderConfig {
  configured: boolean;
  apiKey: string;
  baseURL: string;
  model: string;
  source: UserSettingsProviderSource;
}

export interface UserSettingsMainAiConfig {
  provider: string;
  model: string;
  baseURL?: string;
  apiKey?: string;
}

export interface UserSettingsEmbeddingAiConfig {
  provider: string;
  model: string;
  baseURL: string;
  apiKey: string;
  enabled: boolean;
  loaded: boolean;
  isDefault: boolean;
}

export interface UserSettingsMobileAIConfig {
  provider: AIProviderType;
  model: string;
  apiKey: string;
}

export interface UserSettingsAI {
  providers: Record<string, UserSettingsProviderConfig>;
  main: UserSettingsMainAiConfig;
  embedding: UserSettingsEmbeddingAiConfig;
  mobile: UserSettingsMobileAIConfig;
}

// ---------------------------------------------------------------------------
// Voice — placeholder for TTS/STT configuration (future / server-side).
// ---------------------------------------------------------------------------

export interface UserSettingsVoice {
  config: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Database — mirrors src/components/Settings/settingsConstants.ts DatabaseConfig.
// ---------------------------------------------------------------------------

export type UserSettingsDatabaseMode = "cloud" | "local";

export interface UserSettingsDatabase {
  configured: boolean;
  url: string;
  mode: UserSettingsDatabaseMode;
  connected: boolean;
}

// ---------------------------------------------------------------------------
// Plugins — placeholder (future).
// ---------------------------------------------------------------------------

export interface UserSettingsPlugins {
  config: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Shortcuts — mirrors src/store/useShortcutStore.ts persisted fields (via
// partialize: bindings + enabled). ShortcutKey/ShortcutBinding mirror
// src/config/shortcuts.ts (re-defined here so shared/types does not depend on
// the src layer).
// ---------------------------------------------------------------------------

export interface UserSettingsShortcutKey {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
}

export interface UserSettingsShortcutBinding {
  id: string;
  keys: UserSettingsShortcutKey;
  enabled: boolean;
}

export interface UserSettingsShortcuts {
  bindings: Record<string, UserSettingsShortcutBinding>;
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Noise — mirrors src/store/useNoiseStore.ts persisted fields (via partialize).
// Excludes runtime playback state.
// ---------------------------------------------------------------------------

export type UserSettingsWhiteNoiseType =
  | "rain"
  | "thunder"
  | "ocean"
  | "stream"
  | "wind"
  | "forest"
  | "fire"
  | "cafe"
  | "library"
  | "night"
  | "train"
  | "airplane"
  | "singing_bowl"
  | "wind_chime"
  | "breathing"
  | "white_noise"
  | "pink_noise"
  | "brown_noise"
  | "none";

export interface UserSettingsMixedNoise {
  type: UserSettingsWhiteNoiseType;
  volume: number;
}

export interface UserSettingsNoisePreset {
  id: string;
  name: string;
  noises: UserSettingsMixedNoise[];
  isBuiltIn?: boolean;
}

export interface UserSettingsNoise {
  selectedNoise: UserSettingsWhiteNoiseType;
  noiseVolume: number;
  mixedNoises: UserSettingsMixedNoise[];
  customPresets: UserSettingsNoisePreset[];
  activePresetId: string | null;
}

// ---------------------------------------------------------------------------
// Gestures — mirrors src/components/Settings/GestureSettingsPanel.tsx
// GestureSettings.
// ---------------------------------------------------------------------------

export type UserSettingsRotationSnapAngle = 15 | 30 | 45 | 90;

export interface UserSettingsGestures {
  sensitivity: number;
  pinchZoomEnabled: boolean;
  pinchRotateEnabled: boolean;
  flingInertiaEnabled: boolean;
  edgeSwipeBackEnabled: boolean;
  rotationSnapAngle: UserSettingsRotationSnapAngle;
}

// ---------------------------------------------------------------------------
// Root type
// ---------------------------------------------------------------------------

export interface UserSettings {
  appearance: UserSettingsAppearance;
  focus: UserSettingsFocus;
  learning: UserSettingsLearning;
  study: UserSettingsStudy;
  graphEditor: UserSettingsGraphEditor;
  notifications: UserSettingsNotifications;
  prompts: UserSettingsPrompts;
  ai: UserSettingsAI;
  voice: UserSettingsVoice;
  database: UserSettingsDatabase;
  plugins: UserSettingsPlugins;
  shortcuts: UserSettingsShortcuts;
  noise: UserSettingsNoise;
  gestures: UserSettingsGestures;
}
