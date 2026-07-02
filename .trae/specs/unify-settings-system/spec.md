# Unify Settings System Spec

## Why

The project currently has multiple competing "settings" systems spread across the personal center (`Profile.tsx`), the main `Settings.tsx` page, `LearningMode`, `FocusMode`, and several standalone components. The AI Prompt Management UI alone is triplicated (Profile modal, `LearningSettingsPanel` "prompt" tab, and `PromptConfigPanel.tsx`), all hitting the same backend. Storage is fragmented across ~10 different mechanisms (raw `localStorage`, `createPersistedStore`, Supabase `users.settings` JSONB, `prompt_templates`, `ai_actions`, backend APIs) with no unified type or service. This causes sync bugs (e.g., `FocusMode.tsx` hardcodes `25` minutes instead of reading `useFocusStore.focusDuration`), misleading UX (the "Save All" button only persists `StudyStrategy`), and maintenance burden from keeping duplicate UIs in sync.

The user wants ONE data source / ONE design for settings: the personal-center `Settings.tsx` page is the master and most comprehensive; every other location (LearningMode, FocusMode, etc.) only shows a relevant subset drawn from the same source. Additionally, the previously-separated "AI Prompt Management" card in `Profile.tsx` should be merged into the System Settings page (it was deliberately split out before; after multiple iterations that split is no longer needed).

## What Changes

### A. Merge AI Prompt Management into the main Settings page
- Add a new `prompts` section to `Settings.tsx` that hosts `PromptSettingsPanel` (scope=`user`) + `AIActionSettingsPanel` (scope=`user`), replacing the Profile.tsx modal.
- Remove the "AI Prompt Management" card and its modal from `Profile.tsx`. The remaining "System Settings" card in Profile.tsx continues to navigate to `/settings`.
- Support deep-linking to the new section (`/settings#prompts`) so other pages can link into it.

### B. Eliminate duplicate prompt-management UIs
- Remove the "prompt" tab from `LearningSettingsPanel.tsx`. Replace it with a link/button that opens `/settings#prompts` (or a modal that reuses the SAME `PromptSettingsPanel` component scoped to the current graph — must not be a separate code path).
- Delete `src/components/PromptConfig/PromptConfigPanel.tsx` after confirming it is unused or migrating its last callers to `PromptSettingsPanel`. (Verify callers before deletion.)

### C. Establish a single settings data source / contract
- Define ONE root `UserSettings` type in `shared/types/settings.ts` that sub-divides into `appearance`, `focus`, `learning`, `study`, `graphEditor`, `notifications`, `prompts`, `ai`, `voice`, `database`, `plugins`, `shortcuts`, `noise`, `gestures`.
- Create ONE `settingsService` facade (`src/services/settings/settingsService.ts`) that exposes read/write methods for every settings domain and abstracts the underlying storage (Supabase `users.settings` JSONB, `prompt_templates`, `ai_actions`, `/ai/config/providers`, FSRS params, and the unified client-side store).
- Migrate the remaining RAW `localStorage` keys (`themeMode`/`themePreset`, `graphEditorPreferences`, `gesture-settings`, `mutedNotificationTypes`) into the `createPersistedStore` pattern so all client settings use the SAME storage mechanism. Legacy key migration is handled by the existing `migrateLegacyKeys` helper in `createPersistedStore.ts`.
- Existing specialized Zustand stores (`useFocusStore`, `useLearningSettingsStore`, `useShortcutStore`, `useNoiseStore`) keep their reactive APIs but their state shapes MUST conform to the corresponding sub-types of `UserSettings`. They become the runtime views over the unified type — not separate designs.

### D. Make other pages render subsets of the master settings
- `LearningSettingsPanel` keeps ONLY the "reading" tab (fontSize, paginationMode, contentWidthMode, etc.). Prompt management is delegated to `/settings#prompts`. The reading-tab fields are a subset of `UserSettings.learning`.
- `FocusMode` runtime: read `focusDuration`, `shortBreakDuration`, `longBreakDuration`, `longBreakInterval`, `autoStartBreak`, `autoStartPomodoro` from `useFocusStore` instead of hardcoding values. Fix the `useTimerStore.getState().start(taskId, 25)` bug in `FocusMode.tsx`.
- Wire the orphaned `GestureSettingsPanel` into `Settings.tsx` as a new `gestures` section (or remove it if gestures are no longer used) — do not leave dead code in the Settings folder.

### E. Fix the misleading "Save All" button
- The "Save All" button in `Settings.tsx` must persist EVERYTHING that is not already auto-persisted, or be removed/relabelled if every section auto-persists. Preferred: each section auto-persists on change (current behavior for most sections), and the "Save All" button is removed in favor of per-section auto-save with inline success feedback. This removes the inconsistency where only `StudyStrategy` was saved.

### F. Reconcile theme/readingMode overlap
- `useLearningSettingsStore.readingMode` currently has a `dark` value that conceptually overlaps with the global theme. Either:
  - (Option 1 — preferred) Remove the `dark` option from `readingMode` so it only controls reading typography (`default | eye-care`), and let the global theme (`useTheme`) handle dark mode; OR
  - (Option 2) Keep `dark` but make selecting it delegate to `useTheme.setTheme('dark')` instead of storing a separate value.
- Decision: Option 1 — fewer moving parts, single source of truth for dark mode.

### G. Re-categorize mislabeled settings
- `aiLanguage` currently lives under "Appearance" but is really an AI setting. Move it out of `AppearanceSettings` into the `aiProvider` (or a new `aiGeneral`) section in `Settings.tsx`. The storage location (`useLearningSettingsStore`) stays the same — only the UI categorization changes.

## Impact

- **Affected specs**: none (no prior settings-unification spec exists).
- **Affected code (key files)**:
  - `src/pages/Settings.tsx` — add `prompts`, `gestures` sections; re-categorize `aiLanguage`; remove/relabel "Save All".
  - `src/pages/Profile.tsx` — remove Prompt Management card + modal.
  - `src/components/Learning/LearningSettingsPanel.tsx` — remove "prompt" tab; replace with link to `/settings#prompts`; drop `dark` from `readingMode`.
  - `src/components/PromptConfig/PromptConfigPanel.tsx` — delete (after verifying no callers).
  - `src/components/Scheduler/FocusMode.tsx` — read durations from `useFocusStore` instead of hardcoded `25`.
  - `src/components/Settings/AppearanceSettings.tsx` — remove `aiLanguage` editor (moved to AI section).
  - `src/components/Settings/GestureSettingsPanel.tsx` — wire into Settings.tsx or delete.
  - `src/store/useLearningSettingsStore.ts` — drop `dark` from `readingMode` type; conform to `UserSettings['learning']`.
  - `src/store/useFocusStore.ts` — conform state shape to `UserSettings['focus']`.
  - `src/store/useShortcutStore.ts`, `src/store/useNoiseStore.ts` — conform state shapes.
  - `src/hooks/common/useTheme.ts` — migrate raw `localStorage` (`themeMode`/`themePreset`) to `createPersistedStore`.
  - `src/components/Settings/GraphEditorSettings.tsx` — migrate `graphEditorPreferences` raw localStorage to `createPersistedStore`.
  - `src/components/Settings/NotificationSettings.tsx` — migrate `mutedNotificationTypes` raw localStorage to `createPersistedStore`.
  - **NEW** `shared/types/settings.ts` — unified `UserSettings` type.
  - **NEW** `src/services/settings/settingsService.ts` — unified facade.
- **Affected storage**: legacy raw `localStorage` keys are migrated to the `km-` namespace via `createPersistedStore`; old keys are migrated by `migrateLegacyKeys`. Supabase tables (`prompt_templates`, `ai_actions`, `users.settings`) are unchanged in schema — only access is unified through the service.
- **Migration / breaking considerations**: removing the `dark` value from `readingMode` requires migrating existing users who had `readingMode === 'dark'` to `themeMode === 'dark'` + `readingMode === 'default'` during the legacy-key migration step. No schema migration needed.

## ADDED Requirements

### Requirement: Unified Settings Type
The system SHALL define a single root `UserSettings` type in `shared/types/settings.ts` that enumerates every settings domain (appearance, focus, learning, study, graphEditor, notifications, prompts, ai, voice, database, plugins, shortcuts, noise, gestures). Every settings store and service in the codebase SHALL reference sub-types of this root type instead of defining ad-hoc local types.

#### Scenario: Single type source of truth
- **WHEN** a developer needs the shape of any settings domain
- **THEN** they import the corresponding sub-type from `shared/types/settings.ts` and there is no competing local type definition for the same domain.

### Requirement: Settings Service Facade
The system SHALL provide a `settingsService` facade (`src/services/settings/settingsService.ts`) that exposes read/write methods for every settings domain and abstracts the underlying storage (Supabase `users.settings`, `prompt_templates`, `ai_actions`, `/ai/config/providers`, FSRS params, and the unified client store).

#### Scenario: Single access point
- **WHEN** any page (other than the master Settings page) needs to read or write a setting
- **THEN** it does so via the `settingsService` or the conforming Zustand store, never via direct `localStorage` access or ad-hoc API calls.

### Requirement: Master Settings Page
The `Settings.tsx` page SHALL be the single most-comprehensive settings surface. It SHALL include sections for every settings domain, including a new `prompts` section hosting `PromptSettingsPanel` (scope=`user`) and `AIActionSettingsPanel` (scope=`user`).

#### Scenario: AI Prompt Management lives in System Settings
- **WHEN** the user opens the personal center
- **THEN** there is no separate "AI Prompt Management" card; the only entry point to prompt management is the `prompts` section of `/settings`.

#### Scenario: Deep-linking into a settings section
- **WHEN** a page (e.g., LearningMode) needs to send the user to prompt management
- **THEN** it navigates to `/settings#prompts` and the Settings page scrolls to / activates the `prompts` section.

### Requirement: Subset Settings Views
Other pages (LearningMode, FocusMode, etc.) SHALL render ONLY a subset of the master settings, drawn from the same data source. They SHALL NOT introduce a separate settings design or storage.

#### Scenario: LearningMode shows reading subset only
- **WHEN** the user opens the LearningMode settings panel
- **THEN** it shows only the reading-related fields (fontSize, paginationMode, contentWidthMode, readingMode without `dark`) and a link to `/settings#prompts` for prompt management; it does NOT contain a duplicate prompt editor.

#### Scenario: FocusMode runtime uses stored durations
- **WHEN** the user starts a focus session from FocusMode
- **THEN** the session duration is read from `useFocusStore.focusDuration` (and break durations from the corresponding store fields), never from a hardcoded value.

### Requirement: Unified Client Storage
All client-side settings SHALL be persisted via `createPersistedStore` (Zustand + persist middleware, `km-` namespace). Raw `localStorage.getItem/setItem` for settings (`themeMode`, `themePreset`, `graphEditorPreferences`, `gesture-settings`, `mutedNotificationTypes`) SHALL be migrated to this pattern. Legacy keys SHALL be migrated by the existing `migrateLegacyKeys` helper.

#### Scenario: No raw localStorage for settings
- **WHEN** a developer greps the codebase for `localStorage.getItem`/`localStorage.setItem` in settings-related files
- **THEN** there are zero matches outside the `createPersistedStore` implementation itself.

### Requirement: Auto-persist Settings Sections
Each section in `Settings.tsx` SHALL persist its changes automatically (on change or on blur), with inline success feedback. The misleading "Save All" button that only persisted `StudyStrategy` SHALL be removed (or replaced with a per-section save affordance if auto-save is not feasible for a given section).

#### Scenario: No global Save All button
- **WHEN** the user edits any setting in `/settings`
- **THEN** the change is persisted automatically and there is no single "Save All" button that claims to save everything but only saves one section.

## MODIFIED Requirements

### Requirement: Theme is the single source of truth for dark mode
`useTheme` (via the unified client store) is the ONLY source of dark-mode state. `useLearningSettingsStore.readingMode` no longer carries a `dark` value; it only controls reading typography (`default | eye-care`). Users who previously had `readingMode === 'dark'` are migrated to `themeMode === 'dark'` + `readingMode === 'default'`.

### Requirement: AI Language categorization
`aiLanguage` is edited in the AI section of `Settings.tsx` (not under "Appearance"). Its storage location in `useLearningSettingsStore` is unchanged; only the UI categorization moves.

## REMOVED Requirements

### Requirement: Separate AI Prompt Management card in Profile.tsx
**Reason**: The user explicitly reversed the earlier decision to split prompt management out of system settings. After multiple iterations, the split is no longer needed and causes triplicated UI.
**Migration**: The Prompt Management card and modal in `Profile.tsx` are removed. Users reach prompt management via `/settings#prompts`. The Profile.tsx "System Settings" card (navigating to `/settings`) remains.

### Requirement: Duplicate prompt editor in LearningSettingsPanel
**Reason**: The "prompt" tab in `LearningSettingsPanel.tsx` duplicates `PromptSettingsPanel` and causes sync/maintenance burden.
**Migration**: The "prompt" tab is removed. The panel keeps only the "reading" tab and a link to `/settings#prompts`. If a graph-scoped prompt editor is needed inline in LearningMode, it MUST reuse the `PromptSettingsPanel` component directly (not a duplicate).

### Requirement: Standalone PromptConfigPanel component
**Reason**: `src/components/PromptConfig/PromptConfigPanel.tsx` is a third near-identical copy of the prompt editor.
**Migration**: Verify no callers; if unused, delete the file. If callers exist, migrate them to `PromptSettingsPanel` and then delete.

### Requirement: Hardcoded focus duration in FocusMode runtime
**Reason**: `FocusMode.tsx` hardcodes `25` minutes instead of reading `useFocusStore.focusDuration`, causing the runtime to ignore the user's setting.
**Migration**: Replace the hardcoded value with `useFocusStore.getState().focusDuration` (and similarly for break durations where applicable).

### Requirement: GestureSettingsPanel component
**Reason**: `src/components/Settings/GestureSettingsPanel.tsx` is orphaned dead code. It is not exported from `src/components/Settings/index.ts` and not rendered in `Settings.tsx`. Its raw `localStorage` key `gesture-settings` is read/written only inside the panel itself — no gesture/touch handling code consumes it. The actual gesture handling hook `src/hooks/common/useGestures.ts` takes a `GestureConfig` parameter with different field names (`rotationSnap` vs `rotationSnapAngle`, `pinchSensitivity` vs `sensitivity`, `flingDeceleration`/`flingThreshold` vs `flingInertiaEnabled`) and does not read from `gesture-settings`; furthermore `useGestures` is exported but never called anywhere in `src/`. There is therefore no live path from the panel to any runtime behavior.
**Migration**: Delete `src/components/Settings/GestureSettingsPanel.tsx`. No `gesture-settings` → `km-gestures` migration is needed because no code reads the legacy key. The `UserSettingsGestures` sub-type in `shared/types/settings.ts` is kept for forward compatibility.
