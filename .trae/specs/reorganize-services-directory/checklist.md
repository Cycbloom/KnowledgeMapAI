# Checklist - 重组服务层目录结构

## 目录结构准备

- [x] ai/ 目录结构完整
- [x] graph/ 目录结构完整
- [x] study/ 目录结构完整
- [x] scheduler/ 目录结构完整
- [x] core/ 目录结构完整
- [x] common/ 目录结构完整

## AI 服务移动

- [x] aiService.ts 移动完成
- [x] aiActionService.ts 移动完成
- [x] promptService.ts 移动完成
- [x] embeddingService.ts 移动完成
- [x] ragService.ts 移动完成
- [x] searchService.ts 移动完成
- [x] ai/index.ts 导出更新完成

## 图谱服务移动

- [x] graphService.ts 移动完成
- [x] graphNodeService.ts 移动完成
- [x] graphRelationService.ts 移动完成
- [x] graphTemplateService.ts 移动完成
- [x] edgeService.ts 移动完成
- [x] knowledgePointService.ts 移动完成
- [x] relationshipTypeService.ts 移动完成
- [x] autoGraphService.ts 移动完成
- [x] graph/index.ts 导出更新完成

## 学习服务移动

- [x] studyService.ts 移动完成
- [x] studyProgressService.ts 移动完成
- [x] reviewService.ts 移动完成
- [x] learningPathService.ts 移动完成
- [x] study/index.ts 导出更新完成

## 调度服务移动

- [x] 重复文件处理完成
- [x] periodicTaskService.ts 移动完成
- [x] taskAnalyticsService.ts 移动完成
- [x] taskRecommendationService.ts 移动完成
- [x] scheduler/index.ts 导出更新完成

## 核心服务移动

- [x] authService.ts 移动完成
- [x] settingsService.ts 移动完成
- [x] healthService.ts 移动完成
- [x] sseService.ts 移动完成
- [x] core/index.ts 导出更新完成

## 通用服务移动

- [x] cacheService.ts 移动完成
- [x] queueService.ts 移动完成
- [x] backupService.ts 移动完成
- [x] backupSyncService.ts 移动完成
- [x] templateService.ts 移动完成
- [x] pdfService.ts 移动完成
- [x] dashboardService.ts 移动完成
- [x] common/index.ts 导出更新完成

## 导入路径更新

- [x] 路由文件导入路径更新完成
- [x] 任务处理器导入路径更新完成
- [x] 中间件导入路径更新完成
- [x] 服务间导入路径更新完成
- [x] 主入口导出更新完成

## 验证

- [x] 类型检查通过 (npm run check)
- [x] 代码检查通过 (npm run lint)
- [x] 旧文件清理完成
