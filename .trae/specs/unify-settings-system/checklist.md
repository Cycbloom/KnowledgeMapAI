# Checklist

## Foundation
- [x] `shared/types/settings.ts` exists and defines a single root `UserSettings` type with sub-types for every settings domain (appearance, focus, learning, study, graphEditor, notifications, prompts, ai, voice, database, plugins, shortcuts, noise, gestures).
- [x] No competing local type definitions for the same domains exist outside `shared/types/settings.ts` (existing stores reference the sub-types instead of redefining).
- [x] `src/services/settings/settingsService.ts` exists and exposes read/write methods for every settings domain, delegating to existing stores/APIs without introducing a new storage layer.

## Storage unification
- [x] `useTheme` reads/writes via `createPersistedStore` (key `km-theme`); raw `localStorage.getItem('themeMode')` / `setItem('themePreset')` are gone from `useTheme` and `AppearanceSettings`.
- [x] `GraphEditorSettings` reads/writes via `createPersistedStore` (key `km-graph-editor`); raw `localStorage.getItem('graphEditorPreferences')` is gone.
- [x] `NotificationSettings` reads/writes via `createPersistedStore` (key `km-notifications`); raw `localStorage.getItem('mutedNotificationTypes')` is gone.
- [x] Legacy keys (`themeMode`, `themePreset`, `graphEditorPreferences`, `mutedNotificationTypes`, `gesture-settings`) are migrated by `migrateLegacyKeys` in `createPersistedStore.ts`.
- [x] `GestureSettingsPanel.tsx` is either wired into `Settings.tsx` as a `gestures` section (with `gesture-settings` migrated to `km-gestures`) OR deleted entirely. No orphaned component remains.
- [x] Grep for `localStorage.getItem` / `localStorage.setItem` in `src/components/Settings/**` and `src/hooks/common/useTheme*` returns zero matches outside `createPersistedStore.ts`.

## Store conformance
- [x] `useFocusStore`, `useLearningSettingsStore`, `useShortcutStore`, `useNoiseStore` state interfaces conform to the corresponding `UserSettings` sub-types.
- [x] `useLearningSettingsStore.readingMode` no longer has a `dark` value (now `default | eye-care`).
- [x] Legacy-value migration: users who had `readingMode === 'dark'` are migrated to `themeMode === 'dark'` + `readingMode === 'default'`.

## AI Prompt Management merge
- [x] `Settings.tsx` has a new `prompts` section hosting `PromptSettingsPanel` (scope=`user`) + `AIActionSettingsPanel` (scope=`user`).
- [x] `Settings.tsx` supports deep-link activation: navigating to `/settings#prompts` scrolls to / activates the prompts section.
- [x] i18n key `settings.sections.prompts` exists in both `zh-CN/settings.json` and `en-US/settings.json`.
- [x] `Profile.tsx` no longer has the "AI Prompt Management" card or the modal that rendered `PromptSettingsPanel`/`AIActionSettingsPanel`.
- [x] `Profile.tsx` still has the "System Settings" card that navigates to `/settings`.
- [x] Unused imports and state (`isPromptSettingsOpen`, `MessageSquare`, etc.) are removed from `Profile.tsx`.
- [x] Unused i18n keys `profile.promptManagement.*` are removed from both locale files (verified no other references).

## Duplicate prompt editor elimination
- [x] `LearningSettingsPanel.tsx` no longer has a "prompt" tab; it shows only the "reading" tab.
- [x] `LearningSettingsPanel.tsx` has a link/button that navigates to `/settings#prompts`.
- [x] `src/components/PromptConfig/PromptConfigPanel.tsx` is deleted (callers migrated to `PromptSettingsPanel` if any existed).
- [x] `src/components/PromptConfig/promptScenarios.tsx` is deleted if unused after `PromptConfigPanel.tsx` removal.
- [x] No broken imports remain (`npm run check` passes).

## FocusMode sync fix
- [x] `FocusMode.tsx` no longer hardcodes `25` for the focus duration; it reads `useFocusStore.getState().focusDuration`.
- [x] No other hardcoded duration values remain in `FocusMode.tsx`, `FocusModeTopBar.tsx`, or `FocusModeNoisePanel.tsx` — all read from `useFocusStore`.

## aiLanguage re-categorization
- [x] `AppearanceSettings.tsx` no longer renders the `aiLanguage` editor.
- [x] The `aiLanguage` editor is rendered in the AI section of `Settings.tsx` (storage in `useLearningSettingsStore` unchanged).
- [x] i18n labels for `aiLanguage` are moved/updated to the `settings.ai.*` namespace.

## Save All button
- [x] The "Save All" button and `handleSaveAllSettings` function are removed from `Settings.tsx`.
- [x] Every section in `Settings.tsx` auto-persists on change with inline success feedback.
- [x] `studyStrategyRef` pattern is removed if no longer needed.

## Verification
- [x] `npm run check` passes.
- [x] `npm run lint` passes.
- [ ] Manual smoke test: `/settings` renders all sections including `prompts`; Profile.tsx has no Prompt Management card; LearningMode settings has only reading tab + link; FocusMode starts with configured duration; dark theme works; `aiLanguage` is in AI section.
