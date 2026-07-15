/**
 * Service Dependency Direction (low → high):
 * common(0) ← core(1) ← ai(2) ← graph(3) ← study(4) ← scheduler(5)
 *
 * Services MUST only import from equal or lower layers.
 * Reverse dependencies (e.g., ai → graph) MUST use injection or event bus.
 */

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
export { studyService } from "./study/studyService";
export { asyncTaskService } from "./asyncTaskService";
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

import { graphTraversalService } from "./graph/graphTraversalService";
import { ragService } from "./ai/ragService";

// Inject graph traversal into RAG service to avoid ai → graph circular dependency
ragService.setGraphTraversal(
  (supabase, graphId, sourceKpIds, maxHops, relationshipTypes) =>
    graphTraversalService.getNeighbors(supabase, graphId, sourceKpIds, maxHops, relationshipTypes),
);
