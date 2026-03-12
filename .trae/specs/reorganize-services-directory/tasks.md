# Tasks - 重组服务层目录结构

## 阶段一：准备工作

- [x] Task 1: 创建目标目录结构
  - [x] 确认 ai/, graph/, study/, scheduler/, core/, common/ 目录存在
  - [x] 为每个子目录创建/更新 index.ts 导出文件

## 阶段二：移动 AI 相关服务（6 个文件）

- [x] Task 2: 移动 AI 服务文件到 ai/ 目录
  - [x] 移动 aiService.ts → ai/
  - [x] 移动 aiActionService.ts → ai/
  - [x] 移动 promptService.ts → ai/
  - [x] 移动 embeddingService.ts → ai/
  - [x] 移动 ragService.ts → ai/
  - [x] 移动 searchService.ts → ai/
  - [x] 更新 ai/index.ts 导出

## 阶段三：移动图谱相关服务（8 个文件）

- [x] Task 3: 移动图谱服务文件到 graph/ 目录
  - [x] 移动 graphService.ts → graph/
  - [x] 移动 graphNodeService.ts → graph/
  - [x] 移动 graphRelationService.ts → graph/
  - [x] 移动 graphTemplateService.ts → graph/
  - [x] 移动 edgeService.ts → graph/
  - [x] 移动 knowledgePointService.ts → graph/
  - [x] 移动 relationshipTypeService.ts → graph/
  - [x] 移动 autoGraphService.ts → graph/
  - [x] 更新 graph/index.ts 导出

## 阶段四：移动学习相关服务（4 个文件）

- [x] Task 4: 移动学习服务文件到 study/ 目录
  - [x] 移动 studyService.ts → study/
  - [x] 移动 studyProgressService.ts → study/
  - [x] 移动 reviewService.ts → study/
  - [x] 移动 learningPathService.ts → study/
  - [x] 更新 study/index.ts 导出

## 阶段五：移动调度相关服务（4 个文件）

- [x] Task 5: 处理调度服务重复文件
  - [x] 分析 scheduler/ 目录下已有文件与根目录文件的差异
  - [x] 决定合并或重命名策略

- [x] Task 6: 移动调度服务文件到 scheduler/ 目录
  - [x] 移动 periodicTaskService.ts → scheduler/
  - [x] 移动 taskAnalyticsService.ts → scheduler/
  - [x] 移动 taskRecommendationService.ts → scheduler/
  - [x] 更新 scheduler/index.ts 导出

## 阶段六：移动核心服务（4 个文件）

- [x] Task 7: 移动核心服务文件到 core/ 目录
  - [x] 移动 authService.ts → core/
  - [x] 移动 settingsService.ts → core/
  - [x] 移动 healthService.ts → core/
  - [x] 移动 sseService.ts → core/
  - [x] 更新 core/index.ts 导出

## 阶段七：移动通用服务（7 个文件）

- [x] Task 8: 移动通用服务文件到 common/ 目录
  - [x] 移动 cacheService.ts → common/
  - [x] 移动 queueService.ts → common/
  - [x] 移动 backupService.ts → common/
  - [x] 移动 backupSyncService.ts → common/
  - [x] 移动 templateService.ts → common/
  - [x] 移动 pdfService.ts → common/
  - [x] 移动 dashboardService.ts → common/
  - [x] 更新 common/index.ts 导出

## 阶段八：更新导入路径

- [x] Task 9: 更新路由文件导入路径
  - [x] 更新 api/routes/ 下所有文件的导入路径

- [x] Task 10: 更新任务处理器导入路径
  - [x] 更新 api/jobs/ 下所有文件的导入路径

- [x] Task 11: 更新中间件导入路径
  - [x] 更新 api/middleware/ 下所有文件的导入路径

- [x] Task 12: 更新服务间导入路径
  - [x] 更新服务文件之间的相互导入路径

- [x] Task 13: 更新主入口导出
  - [x] 更新 api/services/index.ts 统一导出

## 阶段九：验证

- [x] Task 14: 运行类型检查
  - [x] 运行 `npm run check` 确保无类型错误

- [x] Task 15: 运行代码检查
  - [x] 运行 `npm run lint` 确保无代码规范问题

- [x] Task 16: 清理空文件
  - [x] 删除根目录下已移动的旧文件
  - [x] 清理空的 index.ts 文件

---

# Task Dependencies

- Task 2-8 依赖 Task 1
- Task 9-13 依赖 Task 2-8
- Task 14-16 依赖 Task 9-13
- Task 5 和 Task 6 有依赖关系（需先分析再移动）
