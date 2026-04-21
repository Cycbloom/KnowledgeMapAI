export { achievementService } from "./achievementService";
export {
  aiActionService,
  aiService,
  embeddingService,
  promptService,
  ragService,
  searchService,
} from "./ai/index";
export { focusService } from "./scheduler/focusService";
export { studyProgressService } from "./study/studyProgressService";
export { studyService } from "./study/studyService";
export { taskService } from "./taskService";
export { reviewService } from "./study/reviewService";
export { periodicTaskService } from "./scheduler/periodicTaskService";
export { taskAnalyticsService } from "./scheduler/taskAnalyticsService";
export { taskRecommendationService } from "./scheduler/taskRecommendationService";

export { aiService as ai } from "./ai/index";
export {
  taskProcessors,
  registerProcessor,
  getProcessor,
} from "./taskProcessors/index";
export type {
  TaskProcessor,
  UpdateTaskStatusFunction,
} from "./taskProcessors/index";

export * from "./core/index";
export * from "./graph/index";
export * from "./study/index";
export {
  cacheService,
  CacheKeys,
  backupService,
  createBackup,
  deleteBackupFile,
  readBackupFile,
  cleanupOldSnapshots,
  runAutoBackup,
  syncExistingBackups,
  templateService,
  TEMPLATE_CATEGORIES,
  pdfService,
  dashboardService,
} from "./common/index";
export type {
  BackupSnapshot,
  TaskTemplate,
  CreateTemplateData,
  UpdateTemplateData,
  TemplateFilters,
  ApplyTemplateData,
  BlindSpot,
  DistributionItem,
  DashboardStats,
} from "./common/index";
