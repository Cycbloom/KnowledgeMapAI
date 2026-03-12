export { achievementService } from "./achievementService.js";
export {
  aiActionService,
  aiService,
  embeddingService,
  promptService,
  ragService,
  searchService,
} from "./ai/index.js";
export { focusService } from "./focusService.js";
export { studyProgressService } from "./study/studyProgressService.js";
export { studyService } from "./study/studyService.js";
export { taskService } from "./taskService.js";
export { reviewService } from "./study/reviewService.js";
export { periodicTaskService } from "./scheduler/periodicTaskService.js";
export { taskAnalyticsService } from "./scheduler/taskAnalyticsService.js";
export { taskRecommendationService } from "./scheduler/taskRecommendationService.js";

export { aiService as ai } from "./ai/index.js";
export {
  taskProcessors,
  registerProcessor,
  getProcessor,
} from "./taskProcessors/index.js";
export type {
  TaskProcessor,
  UpdateTaskStatusFunction,
} from "./taskProcessors/index.js";

export * from "./core/index.js";
export * from "./graph/index.js";
export * from "./study/index.js";
export {
  cacheService,
  CacheKeys,
  taskQueue,
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
} from "./common/index.js";
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
} from "./common/index.js";
