# Tasks

## Phase 1 — Foundation (type + service)

- [x] Task 1: Create unified `UserSettings` type in `shared/types/settings.ts`
  - [ ] SubTask 1.1: Define root `UserSettings` interface with sub-types: `appearance`, `focus`, `learning`, `study`, `graphEditor`, `notifications`, `prompts`, `ai`, `voice`, `database`, `plugins`, `shortcuts`, `noise`, `gestures`.
  - [ ] SubTask 1.2: For each sub-type, mirror the existing field shapes from the current stores (`useFocusStore`, `useLearningSettingsStore`, `useShortcutStore`, `useNoiseStore`, `GraphEditorPreferences`, `GestureSettings`, `ThemeContextType`, etc.). Do NOT invent new fields.
  - [ ] SubTask 1.3: Export the type from `shared/types/index.ts` (or the existing barrel) so it can be imported from both `src/` and `api/`.
  - [ ] SubTask 1.4: Run `npm run check` to confirm no type errors.

- [x] Task 2: Create `settingsService` facade at `src/services/settings/settingsService.ts`
  - [x] SubTask 2.1: Implement read/write methods for each domain. For server-side domains (prompts, aiActions, aiProviders, fsrs, studyStrategy), delegate to existing APIs (`api.prompts`, `api.aiActions`, `/ai/config/providers`, `studyApi`). For client-side domains, delegate to the corresponding Zustand stores.
  - [x] SubTask 2.2: Do NOT introduce a new storage layer — the facade only orchestrates existing stores/APIs behind one entry point.
  - [x] SubTask 2.3: Add JSDoc comments explaining which underlying storage each method hits.
  - [x] SubTask 2.4: Run `npm run check` and `npm run lint`.

## Phase 2 — Migrate raw localStorage to createPersistedStore

- [x] Task 3: Migrate `useTheme` raw localStorage (`themeMode`, `themePreset`) to a `createPersistedStore`-based store
  - [ ] SubTask 3.1: Create `src/store/useThemeStore.ts` (or refactor `useTheme` internally) using `createPersistedStore` with key `km-theme`. State shape conforms to `UserSettings['appearance']`.
  - [ ] SubTask 3.2: Add legacy-key migration in `createPersistedStore.ts` `migrateLegacyKeys`: `themeMode` → `km-theme`, `themePreset` → `km-theme`.
  - [ ] SubTask 3.3: Update `useTheme` hook to read/write from the new store. Keep the public API (`theme`, `setTheme`, `themePreset`, `setThemePreset`) stable so callers don't change.
  - [ ] SubTask 3.4: Verify `AppearanceSettings.tsx` still works.

- [x] Task 4: Migrate `graphEditorPreferences` raw localStorage to `createPersistedStore`
  - [ ] SubTask 4.1: Create `src/store/useGraphEditorPreferencesStore.ts` with key `km-graph-editor`. State shape conforms to `UserSettings['graphEditor']`.
  - [ ] SubTask 4.2: Add legacy-key migration: `graphEditorPreferences` → `km-graph-editor`.
  - [ ] SubTask 4.3: Update `GraphEditorSettings.tsx` (and any consumers) to use the new store.
  - [ ] SubTask 4.4: Verify graph editor still applies saved preferences on load.

- [x] Task 5: Migrate `mutedNotificationTypes` raw localStorage to `createPersistedStore`
  - [ ] SubTask 5.1: Create `src/store/useNotificationsStore.ts` with key `km-notifications`. State shape conforms to `UserSettings['notifications']`.
  - [ ] SubTask 5.2: Add legacy-key migration: `mutedNotificationTypes` → `km-notifications`.
  - [ ] SubTask 5.3: Update `NotificationSettings.tsx` and any consumers.

- [x] Task 6: Decide fate of `GestureSettingsPanel.tsx`
  - [ ] SubTask 6.1: Grep for usages of `GestureSettingsPanel` and `gesture-settings` across the codebase.
  - [ ] SubTask 6.2: If gestures are still relevant → migrate `gesture-settings` raw localStorage to `createPersistedStore` (key `km-gestures`) AND wire `GestureSettingsPanel` into `Settings.tsx` as a new `gestures` section.
  - [ ] SubTask 6.3: If gestures are no longer used → delete `GestureSettingsPanel.tsx` and any related code. Document the deletion in the spec's REMOVED section.

## Phase 3 — Conform existing stores to UserSettings sub-types

- [x] Task 7: Conform `useFocusStore`, `useLearningSettingsStore`, `useShortcutStore`, `useNoiseStore` to corresponding `UserSettings` sub-types
  - [ ] SubTask 7.1: Update each store's state interface to extend (or equal) the corresponding sub-type from `shared/types/settings.ts`. Do not change runtime behavior — only type alignment.
  - [ ] SubTask 7.2: Remove the `dark` value from `useLearningSettingsStore.readingMode` (now `default | eye-care` only). Update `LearningSettingsPanel.tsx` UI accordingly.
  - [ ] SubTask 7.3: Add legacy-value migration in the learning store: if a persisted state has `readingMode === 'dark'`, migrate to `themeMode === 'dark'` (via `useThemeStore`) + `readingMode === 'default'`.
  - [ ] SubTask 7.4: Run `npm run check` and `npm run lint`.

## Phase 4 — Merge AI Prompt Management into Settings page

- [ ] Task 8: Add `prompts` section to `Settings.tsx`
  - [ ] SubTask 8.1: Add a new section entry `{ id: "prompts", label: t("settings.sections.prompts") }` to the `sections` array.
  - [ ] SubTask 8.2: Render `PromptSettingsPanel` (scope=`user`) + `AIActionSettingsPanel` (scope=`user`) inside the new section. Reuse the components as-is — do not duplicate.
  - [ ] SubTask 8.3: Add i18n keys `settings.sections.prompts` in `zh-CN/settings.json` and `en-US/settings.json`.
  - [ ] SubTask 8.4: Support deep-link activation: when the URL hash is `#prompts` on mount, scroll to and activate the prompts section (extend the existing `IntersectionObserver` / `handleAnchorClick` logic).

- [x] Task 9: Remove Prompt Management card + modal from `Profile.tsx`
  - [ ] SubTask 9.1: Delete the "AI Prompt Management" card (lines ~263–280) and the modal block (lines ~447–491) that renders `PromptSettingsPanel`/`AIActionSettingsPanel`.
  - [ ] SubTask 9.2: Remove now-unused imports (`PromptSettingsPanel`, `AIActionSettingsPanel`, `MessageSquare`, `isPromptSettingsOpen` state, etc.) — clean up lint.
  - [ ] SubTask 9.3: Remove the now-unused i18n keys `profile.promptManagement.*` from both locale files (verify no other references first).
  - [ ] SubTask 9.4: Keep the "System Settings" card (`profile.systemSettings.*`) — it still navigates to `/settings`.

## Phase 5 — Eliminate duplicate prompt editors

- [x] Task 10: Remove "prompt" tab from `LearningSettingsPanel.tsx`
  - [ ] SubTask 10.1: Delete the "prompt" tab and its rendering (lines ~540–842). Keep only the "reading" tab.
  - [ ] SubTask 10.2: Replace the prompt tab with a button/link that navigates to `/settings#prompts` (use `navigate('/settings#prompts')`).
  - [ ] SubTask 10.3: Add i18n key for the link label (e.g., `learningSettings.managePromptsLink`).
  - [ ] SubTask 10.4: Remove now-unused imports (`PromptSettingsPanel`-related, prompt template types if no longer referenced).

- [x] Task 11: Verify and delete `PromptConfigPanel.tsx`
  - [ ] SubTask 11.1: Grep for imports of `PromptConfigPanel` across the codebase.
  - [ ] SubTask 11.2: If callers exist → migrate them to use `PromptSettingsPanel` directly, then delete `PromptConfigPanel.tsx` and `promptScenarios.tsx` if also unused.
  - [ ] SubTask 11.3: If no callers → delete `PromptConfigPanel.tsx` and `promptScenarios.tsx` (verify unused first).
  - [ ] SubTask 11.4: Run `npm run check` and `npm run lint` to confirm no broken imports.

## Phase 6 — Fix FocusMode runtime sync bug

- [x] Task 12: Fix hardcoded focus duration in `FocusMode.tsx`
  - [ ] SubTask 12.1: Replace `useTimerStore.getState().start(taskId, 25)` with `useTimerStore.getState().start(taskId, useFocusStore.getState().focusDuration)`.
  - [ ] SubTask 12.2: Audit the rest of `FocusMode.tsx`, `FocusModeTopBar.tsx`, and `FocusModeNoisePanel.tsx` for any other hardcoded duration values; replace with the corresponding `useFocusStore` field.
  - [ ] SubTask 12.3: Verify the focus session starts with the user-configured duration.

## Phase 7 — Re-categorize aiLanguage and fix "Save All"

- [ ] Task 13: Move `aiLanguage` editor out of `AppearanceSettings`
  - [ ] SubTask 13.1: Remove the `aiLanguage` UI block from `AppearanceSettings.tsx`.
  - [ ] SubTask 13.2: Add the `aiLanguage` UI to the `aiProvider` section (or a new `aiGeneral` sub-block at the top of the AI section) in `Settings.tsx`. Storage stays in `useLearningSettingsStore` — only the UI location changes.
  - [ ] SubTask 13.3: Update i18n keys if needed (move labels from `settings.appearance.*` to `settings.ai.*`).

- [ ] Task 14: Remove the misleading "Save All" button from `Settings.tsx`
  - [ ] SubTask 14.1: Confirm every section auto-persists on change (most already do). For `StudyStrategySettings` — verify it auto-persists or convert it to auto-persist.
  - [ ] SubTask 14.2: Remove the "Save All" button and the `handleSaveAllSettings` function. Remove the `studyStrategyRef` pattern if no longer needed.
  - [ ] SubTask 14.3: Add inline success feedback (e.g., a checkmark or `message.success`) to each section's auto-save if not already present.
  - [ ] SubTask 14.4: Run `npm run check` and `npm run lint`.

## Phase 8 — Verification

- [x] Task 15: Full type-check, lint, and manual smoke test (3 minor cleanup items found — addressed in Task 16)

## Phase 9 — Cleanup (from verification)

- [x] Task 16: Fix 3 minor verification failures
  - [ ] SubTask 16.1: Remove orphaned `profile.promptManagement.*` i18n keys from `src/i18n/locales/zh-CN/profile.json` and `src/i18n/locales/en-US/profile.json` (confirmed zero code references).
  - [ ] SubTask 16.2: Move `aiLanguage` i18n labels from root `settings.*` namespace to `settings.ai.*` sub-namespace in both `src/i18n/locales/zh-CN/settings.json` and `src/i18n/locales/en-US/settings.json`. Update the references in `src/pages/Settings.tsx` to use the new `settings.ai.*` keys.
  - [ ] SubTask 16.3: Add `gesture-settings` to a legacy-key cleanup in `src/store/createPersistedStore.ts` `migrateLegacyKeys` — since `GestureSettingsPanel` was deleted (not migrated to a new store), the orphaned `gesture-settings` localStorage key should be removed during migration. Add it to a simple deletion list (not a migration target).
  - [ ] SubTask 16.4: Run `npm run check` and `npm run lint` to confirm clean.
  - [ ] SubTask 15.1: `npm run check` passes.
  - [ ] SubTask 15.2: `npm run lint` passes.
  - [ ] SubTask 15.3: Manual smoke test: open `/settings`, confirm all sections including new `prompts` section render; confirm Profile.tsx no longer has Prompt Management card; confirm LearningMode settings panel has only reading tab + link to `/settings#prompts`; confirm FocusMode starts with configured duration; confirm theme dark mode works; confirm `aiLanguage` is in the AI section.
  - [ ] SubTask 15.4: Grep the codebase for `localStorage.getItem` / `localStorage.setItem` in `src/components/Settings/**` and `src/hooks/common/useTheme*` — confirm zero matches outside `createPersistedStore.ts`.

# Task Dependencies

- Task 1 (UserSettings type) → Task 2 (settingsService), Task 7 (conform stores).
- Task 2 (settingsService) → no hard dependents; can be wired incrementally.
- Tasks 3, 4, 5, 6 (raw localStorage migrations) are independent of each other and can run in parallel; all depend on Task 1 for the sub-types.
- Task 7 (conform stores) depends on Tasks 3–6 (so the migrated stores align with the new types).
- Task 8 (prompts section) → Task 9 (remove Profile modal), Task 10 (remove LearningMode prompt tab) — both depend on the new section existing.
- Task 11 (delete PromptConfigPanel) is independent and can run in parallel with Tasks 8–10.
- Task 12 (FocusMode fix) is independent.
- Task 13 (aiLanguage move) is independent.
- Task 14 (remove Save All) depends on confirming every section auto-persists (may touch Task 7's store work).
- Task 15 (verification) depends on everything.
