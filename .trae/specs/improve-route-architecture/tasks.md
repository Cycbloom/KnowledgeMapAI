# Tasks

## Phase A: 修复 as any 类型断言（11 处，6 个文件）

- [x] Task A1: 修复 taskRecommendationService.ts 的 2 处 as any — 在 UserTask 接口添加 nextSubtask 和 subtaskProgress 可选属性
- [x] Task A2: 修复 quizSetsService.ts 的 1 处 as any — 替换为 `as StudyCard`
- [x] Task A3: 修复 graphTaskService.ts 的 1 处 as any — UserTask.context 类型改为 `Record<string, unknown> | string`
- [x] Task A4: 修复 graphTaskEventHandler.ts 的 3 处 as any — handler 签名改为接受 AppEvent
- [x] Task A5: 修复 autoGraphService.ts 的 1 处 as any — AINodeData.level 类型改为 NodeLevel
- [x] Task A6: 修复 subtaskQuizIntegration.ts 的 2 处 as any — 定义 SubtaskWithTaskId 接口
- [x] Task A7: 修复 stateMachine.ts 的 1 处 as any — TransitionConfig.eventType 改为 AppEventType

## Phase B: 统一错误处理模式（40 个文件）

- [x] Task B1: 统一 scheduler/ 目录下 16 个文件的错误处理
- [x] Task B2: 统一 ai/ 目录下 7 个文件的错误处理
- [x] Task B3: 统一根目录 14 个文件的错误处理
- [x] Task B4: 统一 study/ 目录下 2 个文件的错误处理

## Phase C: 提取路由层非 DB 业务逻辑（12 个文件）

- [x] Task C1: 提取 autoGraph.ts 业务逻辑（~460 行）— withAutoGraphTracking 到 performanceMonitor；prompt 组装+AI 调用到 autoGraphService；硬编码 prompt 迁移到数据库
- [x] Task C2: 提取 ai/document.ts 业务逻辑（~198 行）— save 工作流到 autoGraphService；PDF 解析到 documentParsingService
- [x] Task C3: 提取 ai/cards.ts 业务逻辑（~108 行）— sync-generate-cards 工作流到 studyRouteService；FSRS 初始状态为常量
- [x] Task C4: 提取 ai/chat.ts 业务逻辑（~122 行）— 图谱上下文构建到 aiService；硬编码 tutor prompt 迁移到数据库
- [x] Task C5: 提取 ai/content.ts 业务逻辑（~75 行）— 术语标注逻辑到 annotationService
- [x] Task C6: 提取 learningPaths.ts 业务逻辑（~180 行）— 已由 learningPathService.generateAndSavePath() 覆盖
- [x] Task C7: 提取 conceptAggregation.ts 业务逻辑（~130 行）— batchMerge 添加缓存失效；删除有 bug 的 batchMergeConcepts
- [x] Task C8: 提取 knowledgePoints.ts 业务逻辑（~63 行）— 所有权检查为 requireKnowledgePointOwnership 中间件
- [x] Task C9: 提取 prompts.ts 业务逻辑（~30 行）— 硬编码 prompt 迁移到数据库；AI 调用到 promptService.optimizeWithAI()
- [x] Task C10: 提取 rag.ts 业务逻辑（~51 行）— 搜索分支到 ragService.search()
- [x] Task C11: 提取 study.ts 业务逻辑（~29 行）— 参数解析到 studyRouteService.parseCardQueryParams()；事件发布到 studyService.updateProgress()
- [x] Task C12: 提取 backup.ts 业务逻辑（~56 行）— 导入模式到 backupService.importBackup()；导出到 backupService.exportAndRecord()

## Phase D: 验证

- [x] Task D1: 运行 `npm run check` 和 `npm run lint` 确认无错误
- [x] Task D2: 确认路由文件中无 `as any`、无 `res.status(4xx/5xx).json()` 错误处理

# Task Dependencies
- [Phase A] 可独立执行
- [Phase B] 可独立执行
- [Phase C] 可独立执行
- [Phase A, B, C] 可并行
- [Task D] depends on [Phase A, B, C]
- Phase C 内部：C1-C7 按优先级顺序，C8-C12 可并行
