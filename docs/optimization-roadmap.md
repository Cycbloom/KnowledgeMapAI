# KnowledgeMap 架构优化路线图

> 生成时间：2026-06-30
> 基于对 `api/`、`src/`、`shared/`、`electron/`、`supabase/` 五个目录的系统性架构分析
> 目标：按多轮迭代推进，每轮聚焦独立主题，确保可验证、可回滚

---

## 一、当前架构现状概览

### 1.1 项目规模

| 模块 | 文件数 | 主要技术栈 |
|------|--------|-----------|
| `api/` | 200+ | Express + Supabase + Kernel/Plugin |
| `src/` | 300+ | React 18 + Zustand + TanStack Query + Three.js |
| `shared/` | 20+ | TypeScript 类型 + 工具函数 + 内核基类 |
| `electron/` | 20+ | Electron + better-sqlite3 |
| `supabase/migrations/` | 38 | PostgreSQL Schema |

### 1.2 五维度评估

| 维度 | 后端 | 前端 | shared/electron |
|------|------|------|----------------|
| 模块化程度 | ★★★☆☆ | ★★★☆☆ | ★★★★☆ |
| 组件复用性 | ★★★★☆ | ★★★☆☆ | ★★★☆☆ |
| 性能瓶颈 | ★★★☆☆ | ★★★☆☆ | ★★★★☆ |
| 扩展性 | ★★★★☆ | ★★★★☆ | ★★★☆☆ |
| 可维护性 | ★★☆☆☆ | ★★☆☆☆ | ★★★☆☆ |

### 1.3 核心问题清单

**严重（阻塞维护）**：
- 42 个"上帝服务"超 500 行（最大 `graphService.ts` 1932 行）
- 17 个页面超 500 行（最大 `Settings.tsx` 3140 行）
- 测试覆盖率极低：25 测试文件覆盖 200+ 服务
- i18n 迁移完成度低：11000+ 处硬编码中文

**中等（影响扩展）**：
- 无 Repository 抽象，业务逻辑与 SQL 混合
- `React.memo` 仅 21 处，列表项渲染浪费
- `any` 残留 117 处违反项目规则
- 工具函数重复（`formatDuration` 在 25 处定义）

**轻微（渐进改善）**：
- 死代码（`useSimilarityAnnotation`、`storyCreationApi.ts`）
- 命名违规（`template.ts` vs `templates.ts`）
- `electron` 未纳入 Project References

---

## 二、优化路线图（按轮次组织）

### Round 12：代码清理与重复消除（低风险高收益）

**目标**：消除明显的代码重复和死代码，为后续重构铺路。

| 编号 | 任务 | 涉及文件 | 收益 | 验证方式 |
|------|------|----------|------|----------|
| 12.1 | 删除死代码 | `src/hooks/useSimilarityAnnotation.ts`、`src/services/api/storyCreationApi.ts` | 减少代码噪声 | `grep` 确认无引用，`npm run check` 通过 |
| 12.2 | 合并 template/templates API 文件 | `src/services/api/template.ts` + `templates.ts` | 命名规范统一 | 全局搜索引用更新，符合 api-naming-conventions |
| 12.3 | 提取 formatDuration 等格式化函数 | 新建 `src/utils/formatters.ts`，删除 25 处重复定义 | 单一数据源 | `grep "formatDuration"` 仅在 formatters.ts 定义 |
| 12.4 | 提取 auth.ts 公共 JWT 验证逻辑 | `api/middleware/auth.ts` 第71-222行 | 减少约 50 行重复代码 | 现有 auth 测试全部通过 |
| 12.5 | 迁移 markdownParser 到 shared | `src/utils/markdownParser.ts` + `api/utils/markParser.ts` → `shared/utils/markdownParser.ts` | 消除前后端重复 | `npm run check && npm run check:electron` 通过 |
| 12.6 | syncEngine 复用 shared/utils/retry | `electron/sync/syncEngine.ts` 第393-415行 `retryWithBackoff` → `withRetry` | 消除重复实现 | electron 构建通过 |
| 12.7 | 合并 useFocusStore/useTimerStore | `src/store/useFocusStore.ts` + `useTimerStore.ts`，消除 focusSettings 双源真理 | 简化状态管理 | 手动验证番茄钟功能正常 |

**预期收益**：减少约 800 行重复代码，消除 7 处技术债务，无功能变更。

---

### Round 13：后端巨型服务拆分（核心债务）

**目标**：拆分 Top 5 "上帝服务"，将单一职责原则引入服务层。

| 编号 | 任务 | 当前规模 | 拆分方案 | 验证方式 |
|------|------|----------|----------|----------|
| 13.1 | 拆分 graphService.ts | 1932 行 | 拆为 `GraphCrudService` / `GraphNodeQueryService` / `GraphStatusService` / `GraphCombinedViewService` / `GraphCacheService` | 现有调用方零修改（保持门面） |
| 13.2 | 拆分 learningPathService.ts | 1858 行 | 拆为 `LearningPathCrudService` / `LearningPathGenerationService` / `LearningPathProgressService` | 行为等价测试 |
| 13.3 | 拆分 autoGraphService.ts | 1747 行 | 拆为 `AutoGraphOrchestrator` / `AutoGraphEmbeddingService` / `AutoGraphConstructionService` | 现有 autoGraphService 测试通过 |
| 13.4 | 拆分 conceptAggregationService.ts | 1731 行 | 拆为 `ConceptClusterService` / `ConceptMergeService` / `ConceptAnalysisService` | 类型检查通过 |
| 13.5 | 拆分 graphVersionService.ts | 1698 行 | 拆为 `VersionCrudService` / `VersionDiffService` / `VersionRestoreService` | 行为等价 |

**拆分原则**：
- 保持门面模式：原 `graphService.ts` 保留为门面，委托给子服务
- 通过构造函数或工厂注入依赖，便于测试
- 子服务间通过事件总线解耦，避免直接 import
- 每个子服务单一职责，不超过 500 行

**预期收益**：5 个核心服务从平均 1793 行降至平均 360 行，可测试性大幅提升。

---

### Round 14：后端路由层完善拆分

**目标**：完成路由层模块化，统一目录拆分模式。

| 编号 | 任务 | 当前规模 | 拆分方案 |
|------|------|----------|----------|
| 14.1 | 拆分 knowledgePoints.ts | 574 行 | 新建 `routes/knowledgePoints/` 目录，拆为 crud/expansion/relations/annotations |
| 14.2 | 拆分 study.ts | 487 行 | 拆入现有 `routes/study/` 目录，增加 sessions/review/stats |
| 14.3 | 拆分 literature.ts | 484 行 | 新建 `routes/literature/` 目录，拆为 sources/extraction/application |
| 14.4 | 拆分 agent.ts | 386 行 | 新建 `routes/agent/` 目录，拆为 sessions/tools/executions |
| 14.5 | 拆分 conceptAggregation.ts | 324 行 | 新建 `routes/conceptAggregation/` 目录，拆为 cluster/merge/analysis |
| 14.6 | 二次拆分 graphs/expansion.ts | 536 行 | 拆为 aiExpansion/manualExpansion/batchExpansion |
| 14.7 | 二次拆分 graphs/crud.ts | 442 行 | 拆为 create/update/delete/list |
| 14.8 | 拆分 ai/document.ts | 407 行 | 拆为 upload/parse/extract/annotate |

**预期收益**：路由文件平均行数从 450+ 降至 200 以下，新增功能定位明确。

---

### Round 15：shared/electron 架构优化

**目标**：拆分膨胀文件，统一构建配置。

| 编号 | 任务 | 当前规模 | 拆分方案 |
|------|------|----------|----------|
| 15.1 | 拆分 shared/types/graph.ts | 1422 行 | 拆为 `graph/core.ts`（图谱基础）+ `graph/template.ts`（模板）+ `graph/literature.ts`（文献）+ `graph/story.ts`（故事）+ `graph/backbone.ts`（骨干）+ `graph/collaboration.ts`（协作）+ `graph/crossGraph.ts`（跨图分析）+ `graph/index.ts`（barrel） |
| 15.2 | 拆分 electron/db/schema.ts | 1894 行 | 按业务域拆为 `schema/users.ts` + `schema/graphs.ts` + `schema/nodes.ts` + `schema/scheduler.ts` + `schema/study.ts` + `schema/ai.ts` + `schema/sync.ts` + `schema/index.ts`（聚合） |
| 15.3 | electron 纳入 Project References | `tsconfig.electron.json` | 启用 `composite: true`，加入根 `tsconfig.json` references，统一 build graph |
| 15.4 | 清理 api/tsconfig.json 遗留配置 | `api/tsconfig.json` | 确认是否可移除，避免与 `tsconfig.api.json` 冲突 |
| 15.5 | 实现 electron db migrations 增量机制 | `electron/db/migrations/` | 从 `001_initial.ts` 扩展为版本化迁移，支持 schema 升级 |

**预期收益**：
- `graph.ts` 从 1422 行降至平均 200 行/文件
- `schema.ts` 从 1894 行降至平均 270 行/文件
- 构建配置统一，增量编译覆盖 electron

---

### Round 16：前端巨型页面拆分

**目标**：复制 GraphEditor 的 page-with-hooks 模式到其他巨型页面。

| 编号 | 任务 | 当前规模 | 拆分方案 |
|------|------|----------|----------|
| 16.1 | 拆分 Settings.tsx | 3140 行 | 新建 `pages/Settings/` 目录，按 tab 拆分：`tabs/ProfileTab.tsx` + `tabs/AppearanceTab.tsx` + `tabs/AiConfigTab.tsx` + `tabs/ShortcutTab.tsx` + `tabs/DatabaseTab.tsx` + `tabs/AboutTab.tsx`，主页面仅做 tab 路由 |
| 16.2 | 拆分 LearningMode.tsx | 2118 行 | 拆为 `LearningMode/` + `hooks/useLearningSession.ts` + `hooks/useQuizFlow.ts` + `components/QuestionPanel.tsx` + `components/ProgressIndicator.tsx` |
| 16.3 | 拆分 GraphMap.tsx | 2111 行 | 已有二级懒加载，进一步拆为 `GraphMap/canvas/` + `GraphMap/sidebar/` + `GraphMap/modals/` + `hooks/useGraphMapState.ts` |
| 16.4 | 拆分 Study.tsx | 2090 行 | 拆为 `Study/` + `components/StudyPanel.tsx` + `components/ReviewQueue.tsx` + `hooks/useStudySession.ts` |
| 16.5 | 拆分 Dashboard.tsx | 1972 行 | 拆为 `Dashboard/` + `widgets/` 子目录（每个统计卡片独立组件）+ `hooks/useDashboardData.ts` |
| 16.6 | 拆分 Login.tsx | 1604 行 | 拆为 `Auth/` + `Login.tsx` + `Register.tsx` + `components/AuthForm.tsx` + `components/SocialAuth.tsx` |
| 16.7 | 拆分 GraphEditor.tsx | 1483 行 | 已有 hooks 拆分，进一步抽离 `components/GraphEditorPanels/` |
| 16.8 | 拆分 LearningPathDetail.tsx | 1362 行 | 拆为 `LearningPathDetail/` + `tabs/OverviewTab.tsx` + `tabs/NodesTab.tsx` + `tabs/ProgressTab.tsx` |

**拆分原则**：
- 主页面文件不超过 300 行，仅负责编排
- 业务逻辑抽入 `hooks/` 子目录
- UI 片段抽入 `components/` 子目录
- 保持 `index.ts` barrel 导出，调用方零修改

**预期收益**：8 个页面从平均 1800 行降至平均 250 行，可维护性显著提升。

---

### Round 17：前端巨型组件拆分

**目标**：拆分 Top 10 巨型组件，提升复用性。

| 编号 | 任务 | 当前规模 | 拆分方案 |
|------|------|----------|----------|
| 17.1 | 拆分 GraphToolbar.tsx | 1715 行 | 拆为 `toolbar/sections/NodeSection.tsx` + `EdgeSection.tsx` + `ViewSection.tsx` + `AiSection.tsx` + `ExportSection.tsx`，主组件仅做布局 |
| 17.2 | 拆分 GraphOutline.tsx | 1607 行 | 拆为 `outline/OutlineTree.tsx` + `OutlineSearch.tsx` + `OutlineContextMenu.tsx` + `OutlineDragLayer.tsx` |
| 17.3 | 拆分 AutoGraphGenerator.tsx | 1593 行 | 拆为 `AutoGraph/steps/ConfigStep.tsx` + `ProcessStep.tsx` + `ResultStep.tsx` + `hooks/useAutoGraph.ts` |
| 17.4 | 拆分 TaskForm.tsx | 1354 行 | 拆为 `Scheduler/form/BasicFields.tsx` + `ScheduleFields.tsx` + `DependencyFields.tsx` + `hooks/useTaskForm.ts` |
| 17.5 | 拆分 PerformanceTab.tsx | 1342 行 | 拆为 `Console/performance/OverviewCard.tsx` + `charts/` 子目录 + `hooks/usePerformanceData.ts` |
| 17.6 | 拆分 MindMapCanvas.tsx | 1159 行 | 已有 `MindMapCanvas/` 子目录，进一步抽离渲染逻辑 |
| 17.7 | 拆分 TemplateGenerator.tsx | 1063 行 | 拆为 `Templates/generator/steps/` 多步骤组件 |
| 17.8 | 拆分 MindMapNode.tsx | 1047 行 | 抽离 `MindMapNode/` 子组件 + `useNodeInteraction.ts` |
| 17.9 | 拆分 DomainGraphGenerator.tsx | 983 行 | 拆为 `DomainGraph/config/` + `preview/` + `hooks/` |
| 17.10 | 拆分 ListView.tsx | 921 行 | 拆为 `Scheduler/list/ListViewHeader.tsx` + `ListFilter.tsx` + `ListBody.tsx` |

**预期收益**：10 个组件从平均 1180 行降至平均 250 行，复用性提升。

---

### Round 18：前端性能优化与类型安全

**目标**：补齐渲染优化，消除 any 残留。

| 编号 | 任务 | 涉及范围 | 实施方向 |
|------|------|----------|----------|
| 18.1 | 补齐 React.memo | 高频列表项：`TaskCard` / `MindMapNode` / `QuadrantNode` / `VirtualizedNodeList` 项 / `QuizCard` / `QuestionList` 项 / `TaskForm` 字段组件 | 添加 `React.memo` + 自定义 `areEqual` 比较 |
| 18.2 | 消除组件层 any（117 处） | 优先：`MindMapCanvas.tsx`（11 处）/ `GraphMap.tsx`（6 处）/ `ActiveTaskPanel.tsx`（5 处）/ `Scheduler.tsx`（5 处）/ `TextToGraphModal.tsx`（4 处）/ `opmlParser.ts`（4 处）/ `AlternativeBranches.tsx`（4 处） | 替换为具体类型或 `unknown` + 类型守卫 |
| 18.3 | 修复 IRagApi/ISttApi/ITtsApi 的 Promise<unknown> | `src/services/api/contracts/IRagApi.ts` 第14/42/44行、`ISttApi.ts` 第5行、`ITtsApi.ts` 第4行 | 定义具体响应类型 |
| 18.4 | 统一虚拟化方案 | 合并 5 套：`VirtualList.tsx` + `VirtualizedNodeList.tsx` + `VirtualizedEdgeList.tsx` + `useVirtualization.ts` + `useVirtualScroll.ts` → 单一 `VirtualList` + `useVirtualization` | 删除冗余实现 |
| 18.5 | 统一键盘快捷键 | `useKeyboardShortcuts.tsx`（硬编码）→ 合并入 `useGlobalShortcuts.tsx` + `useShortcutStore`（数据驱动） | 删除遗留硬编码方案 |
| 18.6 | usePerformanceStore.fps 隔离 | `src/store/usePerformanceStore.ts` 第8行 `fps` 字段 | 改为 ref 或独立 store，避免高频写入触发重渲染 |
| 18.7 | 补充 ErrorBoundary | 巨型组件外层包裹 ErrorBoundary，避免单点崩溃导致整页白屏 | 在 `GraphEditor` / `GraphMap` / `Settings` / `Dashboard` 路由级添加 |

**预期收益**：
- 高频列表项渲染性能提升 30%+
- 类型安全达到项目规则要求
- 单点故障隔离，提升稳定性

---

### Round 19：i18n 迁移（专项攻坚）

**目标**：完成 i18n 硬编码文本迁移，使多语言支持可用。

**迁移策略**：按页面/组件的中文字符数排序，从最多开始批量迁移。

| 编号 | 任务 | 硬编码字符数 | 优先级 |
|------|------|--------------|--------|
| 19.1 | Settings.tsx | 599 | P0 |
| 19.2 | LearningPathDetail.tsx | 387 | P0 |
| 19.3 | CurrentTask.tsx | 232 | P0 |
| 19.4 | Dashboard.tsx | 169 | P0 |
| 19.5 | GraphEditor.tsx | 113 | P1 |
| 19.6 | QuizPreview.tsx | 113 | P1 |
| 19.7 | DomainGraphGenerator.tsx | 514 | P1 |
| 19.8 | AIExpansionPanel.tsx | 465 | P1 |
| 19.9 | LearningPathWizard.tsx | 356 | P1 |
| 19.10 | BackboneCompatibilityChecker.tsx | 251 | P2 |
| 19.11 | GraphToolbar.tsx | 251 | P2 |
| 19.12 | MindMapCanvas.tsx | 242 | P2 |
| 19.13 | 其余 80+ 组件文件 | 平均 < 100 | P3 批量处理 |

**实施规范**：
- 每个页面/组件迁移前先抽取所有中文文本到 `i18n/locales/zh-CN.json` 和 `en-US.json`
- 使用 `useTranslation` hook 替换硬编码
- key 命名规则：`{page}.{section}.{element}`，如 `settings.appearance.theme`
- 同步更新两个 locale 文件，确保 key 数量一致
- 迁移后用 `grep -rP "[\x{4e00}-\x{9fa5}]" src/components/{file}` 验证无残留

**预期收益**：11000+ 处硬编码中文清零，多语言支持实际可用。

---

### Round 20：后端测试覆盖补齐

**目标**：为核心服务建立测试基线，覆盖关键路径。

| 编号 | 任务 | 当前测试数 | 目标测试数 | 覆盖重点 |
|------|------|-----------|-----------|----------|
| 20.1 | graphService 测试 | 0 | 30+ | listGraphs/getGraph/createGraph/updateGraph/deleteGraph + 权限 + 缓存命中 |
| 20.2 | taskService 测试 | 0 | 25+ | 任务 CRUD + 队列执行 + 进度更新 + 统计 |
| 20.3 | learningPathService 测试 | 0 | 20+ | 路径生成 + 节点管理 + 进度计算 |
| 20.4 | AgentService 测试 | 0 | 20+ | Session 管理 + 工具调用 + SSE 流 |
| 20.5 | graphVersionService 测试 | 0 | 15+ | 版本创建 + diff + 恢复 |
| 20.6 | nodesService 测试 | 0 | 15+ | 节点 CRUD + 状态计算 + 批量操作 |
| 20.7 | quizSetsService 测试 | 0 | 15+ | 题集 CRUD + quiz 生成 |
| 20.8 | backupService 测试 | 0 | 10+ | 备份创建 + 恢复 + 增量 |

**测试原则**：
- 优先覆盖 Happy Path + 关键边界条件
- 使用 mock Supabase Client，不依赖真实数据库
- 测试文件放在 `api/__tests__/services/` 下，命名 `{serviceName}.test.ts`
- 每个公开方法至少 1 个测试用例
- 关键分支（错误/降级/缓存）单独覆盖

**预期收益**：核心服务测试覆盖率从 0% 提升至 60%+，重构有安全网。

---

### Round 21：Repository 抽象与数据访问统一

**目标**：引入 Repository 层，分离业务逻辑与数据访问。

| 编号 | 任务 | 涉及范围 | 实施方向 |
|------|------|----------|----------|
| 21.1 | 定义 Repository 接口 | 新建 `api/repositories/` 目录，定义 `IGraphRepository` / `INodeRepository` / `ITaskRepository` / `IStudyRepository` / `IUserRepository` | 接口仅声明 CRUD，不含业务逻辑 |
| 21.2 | 实现 SupabaseRepository 基类 | `api/repositories/base/SupabaseRepository.ts` | 封装 `req.supabase` + `getSupabaseAdmin` + `transactionExecutor` 三种访问方式 |
| 21.3 | 迁移 graph 域 Repository | `GraphRepository` / `NodeRepository` / `EdgeRepository` / `GraphVersionRepository` | 从 `graphService.ts` 抽离所有 `client.from(...)` 调用 |
| 21.4 | 迁移 scheduler 域 Repository | `TaskRepository` / `SubtaskRepository` / `ScheduleRepository` | 从 `taskService.ts` 抽离 |
| 21.5 | 迁移 study 域 Repository | `StudyCardRepository` / `ReviewRepository` / `LearningPathRepository` | 从 `studyService.ts` / `learningPathService.ts` 抽离 |
| 21.6 | 服务层改用 Repository | 修改 `graphService` / `taskService` / `learningPathService` 等服务，注入 Repository | 服务不再直接调用 supabase client |

**预期收益**：
- 业务逻辑与数据访问分离，服务可单元测试
- 数据访问模式统一（消除 RPC/query builder/原生 SQL 混用）
- 为未来切换 ORM 或数据库留出扩展点

---

### Round 22：扩展性与基础设施优化

**目标**：补齐扩展性短板，提升生产就绪度。

| 编号 | 任务 | 涉及文件 | 实施方向 |
|------|------|----------|----------|
| 22.1 | rateLimitStore 实现 Redis 后端 | `api/middleware/rateLimitStore.ts` 第97-100行 | 实现 `RedisRateLimitStore`，通过环境变量切换 |
| 22.2 | cacheService 实现 Redis 后端 | `api/services/common/cacheStore.ts` | 实现 `RedisCacheStore`，多实例部署支持 |
| 22.3 | alertManager 告警持久化 | `api/utils/alertManager.ts` 第231-259行 | `sendEmail` 实际发送 + `sendInApp` 入库 + alerts 数组持久化 |
| 22.4 | RLS 策略补齐扩展表 | `supabase/migrations/13_rls_policies.sql` | 验证 17-31 扩展表（plugin_marketplace/practice_quiz/sync_operations 等）的 RLS 覆盖 |
| 22.5 | 双 schema 索引同步机制 | `supabase/migrations/12_indexes.sql` + `electron/db/schema.ts` | 提取共享索引定义，避免手动同步 |
| 22.6 | 插件层声明服务依赖 | `api/services/plugins/` 下 6 个插件 | 在插件 manifest 中声明服务层隐式依赖，避免加载顺序问题 |
| 22.7 | graphService 大图谱分页 | `graphService.ts` 第1230-1379行 `getGraphNodes` | >500 节点时强制分页，避免单次查询过大 |
| 22.8 | batchGetGraphNodeStatus 限流 | `graphService.ts` 第1488-1505行 | 并行查询加并发限制（如 Promise.allSettled + chunk） |

**预期收益**：
- 多实例部署就绪
- 告警系统实际可用
- 数据安全策略完整
- 性能瓶颈消除

---

## 三、实施优先级总览

### P0（立即执行，Round 12-13）

**理由**：低风险高收益，为后续重构铺路。

- Round 12：代码清理与重复消除（7 项）
- Round 13：后端巨型服务拆分 Top 5（5 项）

### P1（近期执行，Round 14-16）

**理由**：核心可维护性提升，影响范围可控。

- Round 14：后端路由层完善拆分（8 项）
- Round 15：shared/electron 架构优化（5 项）
- Round 16：前端巨型页面拆分 Top 8（8 项）

### P2（中期执行，Round 17-19）

**理由**：大规模重构，需充分测试。

- Round 17：前端巨型组件拆分 Top 10（10 项）
- Round 18：前端性能优化与类型安全（7 项）
- Round 19：i18n 迁移攻坚（13 项）

### P3（长期执行，Round 20-22）

**理由**：质量保障与扩展性，可持续迭代。

- Round 20：后端测试覆盖补齐（8 项）
- Round 21：Repository 抽象与数据访问统一（6 项）
- Round 22：扩展性与基础设施优化（8 项）

---

## 四、轮次依赖关系

```
Round 12（清理） ─┬─→ Round 13（服务拆分）──→ Round 20（测试补齐）──→ Round 21（Repository）
                  │
                  └─→ Round 14（路由拆分）──→ Round 22（扩展性）

Round 15（shared/electron）─→ Round 22（扩展性）

Round 16（页面拆分）─┬─→ Round 17（组件拆分）──→ Round 18（性能优化）
                    │
                    └─→ Round 19（i18n 迁移）

Round 18（类型安全）─→ Round 19（i18n 迁移，需类型化 key）
```

**关键约束**：
- Round 13 必须在 Round 20 之前（拆分后才能写测试）
- Round 16 必须在 Round 17 之前（页面拆分后才能拆组件）
- Round 18 必须在 Round 19 之前（i18n key 需类型化）
- Round 21 必须在 Round 20 之后（有测试网才敢大改数据访问层）

---

## 五、每轮验证清单

每轮优化完成后，必须通过以下验证：

### 5.1 代码质量验证

```bash
npm run check              # 增量类型检查
npm run check:full         # 全量类型检查（重要轮次）
npm run check:electron     # Electron 类型检查
npm run lint               # ESLint 检查
npm run lint:full          # 全量 ESLint（重要轮次）
```

### 5.2 测试验证

```bash
npm run test               # 单元测试
npx playwright test        # E2E 测试（涉及 UI 的轮次）
```

### 5.3 规则合规验证

- 无新增 `any` 类型
- 无新增非空断言 `!`
- 前端无新增 `console.log/info`
- 后端无新增 `console.*`
- `api/` 不依赖 `src/`
- `src/` 不依赖 `api/`
- 两者仅依赖 `shared/`

### 5.4 行为等价验证

- 涉及重构的轮次，必须确保功能行为不变
- 通过 E2E 测试覆盖关键用户路径
- 手动验证核心功能（图谱编辑/任务调度/学习/登录）

---

## 六、关键风险与缓解

### 6.1 重构风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 服务拆分破坏调用方 | 高 | 保持门面模式，原服务作为委托层 |
| 页面拆分导致状态丢失 | 中 | 拆分前补充 E2E 测试，拆分后验证 |
| i18n 迁移遗漏 key | 低 | 自动化扫描中文残留，两个 locale 文件 diff |
| 测试 mock 与实际不符 | 中 | 优先集成测试，mock 仅用于外部依赖 |

### 6.2 回滚策略

- 每轮优化在独立分支进行
- 每 1-2 个任务提交一次 commit，便于 bisect
- 出现问题立即回滚到上一个稳定 commit
- 重构类轮次不混合功能开发

---

## 七、进度追踪

每轮优化完成后，更新本文件的进度状态：

| 轮次 | 主题 | 状态 | 完成时间 | 备注 |
|------|------|------|----------|------|
| Round 12 | 代码清理与重复消除 | ⬜ 待开始 | - | - |
| Round 13 | 后端巨型服务拆分 | ⬜ 待开始 | - | - |
| Round 14 | 后端路由层完善拆分 | ⬜ 待开始 | - | - |
| Round 15 | shared/electron 架构优化 | ⬜ 待开始 | - | - |
| Round 16 | 前端巨型页面拆分 | ⬜ 待开始 | - | - |
| Round 17 | 前端巨型组件拆分 | ⬜ 待开始 | - | - |
| Round 18 | 前端性能优化与类型安全 | ⬜ 待开始 | - | - |
| Round 19 | i18n 迁移攻坚 | ⬜ 待开始 | - | - |
| Round 20 | 后端测试覆盖补齐 | ⬜ 待开始 | - | - |
| Round 21 | Repository 抽象 | ⬜ 待开始 | - | - |
| Round 22 | 扩展性与基础设施 | ⬜ 待开始 | - | - |

状态标记：⬜ 待开始 / 🟡 进行中 / ✅ 已完成 / ⏸️ 暂缓

---

## 八、附录：关键文件索引

### 8.1 后端核心文件

| 文件 | 行数 | 角色 |
|------|------|------|
| `api/services/graph/graphService.ts` | 1932 | 图谱核心服务（待拆分） |
| `api/services/study/learningPathService.ts` | 1858 | 学习路径服务（待拆分） |
| `api/services/graph/autoGraphService.ts` | 1747 | 自动建图服务（待拆分） |
| `api/services/graph/conceptAggregationService.ts` | 1731 | 概念聚合服务（待拆分） |
| `api/services/graph/graphVersionService.ts` | 1698 | 图谱版本服务（待拆分） |
| `api/app.ts` | 187 | Express 工厂 |
| `api/services/kernel/Kernel.ts` | 230 | 插件内核 |
| `api/services/kernel/bootstrap.ts` | 26 | 6 插件注册 |

### 8.2 前端核心文件

| 文件 | 行数 | 角色 |
|------|------|------|
| `src/pages/Settings.tsx` | 3140 | 设置页（待拆分） |
| `src/pages/LearningMode.tsx` | 2118 | 学习模式（待拆分） |
| `src/pages/GraphMap.tsx` | 2111 | 图谱地图（待拆分） |
| `src/components/GraphEditor/toolbar/GraphToolbar.tsx` | 1715 | 工具栏（待拆分） |
| `src/components/GraphEditor/panels/GraphOutline.tsx` | 1607 | 大纲面板（待拆分） |
| `src/services/api/contracts/IApi.ts` | 74 | API 契约聚合根 |
| `src/store/useStore.ts` | 47 | 认证状态 |

### 8.3 shared/electron 核心文件

| 文件 | 行数 | 角色 |
|------|------|------|
| `shared/types/graph.ts` | 1422 | 图谱类型（待拆分） |
| `electron/db/schema.ts` | 1894 | SQLite Schema（待拆分） |
| `electron/main.ts` | 542 | Electron 主进程 |
| `electron/sync/syncEngine.ts` | 447 | 同步引擎 |
| `shared/kernel/PluginLifecycleBase.ts` | 205 | 插件基类（跨端复用） |

---

**文档结束**

本路线图将作为后续多轮优化的参考依据。每轮优化开始前，建议先阅读对应章节，明确任务范围与验证标准。
