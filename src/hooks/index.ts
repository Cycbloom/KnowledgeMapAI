// Re-exports from common barrel: only hooks actually called through the main barrel
export {
  ThemeProvider,
  useTheme,
  useFocusTrap,
  useEscapeKey,
  useFormDraft,
  useError,
  useIsMobile,
  useNetworkStatus,
  useAutoSave,
  useBeforeUnload,
  useCombinedView,
  useCollaborators,
  useTextToSpeech,
  useSpeechRecognition,
  useGlobalShortcuts,
  useTutorOperations,
  useQuoteShortcut,
  useTopicCheck,
  useCelebration,
} from "./common";

// Re-exports from scheduler barrel: only hooks actually called through the main barrel
export {
  useSchedulerQueues,
  useSchedulerSettings,
  useSchedulerStats,
  useHeatmap,
  useExecutions,
  useSchedulerTasks,
  useCreateUserTaskMutation,
  useUpdateUserTaskMutation,
  useDeleteUserTaskMutation,
  useMoveUserTaskMutation,
  useReorderUserTasksMutation,
  useStartUserTaskMutation,
  usePauseUserTaskMutation,
  useCompleteUserTaskMutation,
  useDemoteUserTaskMutation,
  HOTKEY_LIST,
  useTaskEvents,
} from "./scheduler";

// Type-only re-export: only GraphEditorState is consumed via the main barrel
export type { GraphEditorState } from "./graphEditor";

// Standalone hooks: only hooks actually called through the main barrel
export { useConsole } from "./console";
export { useAILanguage } from "./ai";
export { useNoteWordCount } from "./notes";
export { useBacklinks } from "./graphAI";
export { useTaskActions } from "./scheduler";
export { useMenuNavigation, usePrefetch, useRoutePrefetch } from "./common";
