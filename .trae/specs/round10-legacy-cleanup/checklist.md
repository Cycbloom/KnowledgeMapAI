# Round 10 Checklist

## Task 1: 修复 AgentService.ts `finalSession!` 非空断言

- [x] `api/services/agent/AgentService.ts` 第 670 行 `finalSession!` 非空断言已移除
- [x] 改为显式空值检查 + 抛错（`if (!finalSession) throw new Error("Session not found after update")`）
- [x] `npm run check` 通过（退出码 0）
- [x] `npm run lint` 通过（退出码 0）
- [x] 无新增非空断言 `!`

## Task 2: P2-17 i18n 迁移 SchedulerStats.tsx + CombinedViewPage.tsx

- [x] `src/pages/SchedulerStats.tsx` 中 74 处硬编码中文已全部迁移为 `t()` 调用（含 7 个子组件：QueueDistributionChart / DailyTrendChart / DurationTrendChart / SchedulerHeatmap / ExecutionHistoryTable / EfficiencyChart / SchedulerStats 主组件）
- [x] `src/pages/CombinedViewPage.tsx` 中 20 处硬编码中文已全部迁移为 `t()` 调用（含 2 个组件：GraphSelector / CombinedViewPage 主组件）
- [x] `src/i18n/locales/zh-CN.json` 新增 schedulerStats（64 key）与 combinedViewPage（20 key）命名空间
- [x] `src/i18n/locales/en-US.json` 新增对应英文翻译（84 key）
- [x] 额外修复 SchedulerHeatmap 的 `reduce<number>` 类型错误（预先存在的 TypeScript 类型推断问题）
- [x] `npm run check` 通过（退出码 0）
- [x] `npm run lint` 通过（退出码 0）
- [x] 无新增 `any` 类型、非空断言 `!`、前端 `console.log/info`

## Task 3: P2-02 autoGraph.ts 路由拆分

- [x] `api/routes/autoGraph/` 目录已创建，含 5 个文件：index.ts（16 行）、graph.ts（331 行）、templates.ts（187 行）、prompt.ts（108 行）、embeddings.ts（58 行）
- [x] 原 `api/routes/autoGraph.ts`（660 行）已删除
- [x] `api/services/plugins/GraphPlugin.ts` 的 `import autoGraphRoutes from "../../routes/autoGraph"` 自动解析到 `./autoGraph/index`，无需修改
- [x] 路由路径与行为完全不变（init/expand/save-nodes/generate-templates/apply-template/optimize-prompt/generate-embeddings/embedding-status）
- [x] `npm run check` 通过（退出码 0）
- [x] `npm run lint` 通过（退出码 0）
- [x] 无新增 `any` 类型、非空断言 `!`、后端 `console.*`

## 全局验证

- [x] `npm run check` 通过
- [x] `npm run check:electron` 通过（退出码 0）
- [x] `npm run lint` 通过
- [x] 无新增 `any` 类型（生产代码）
- [x] 无新增非空断言（`!`）
- [x] 无新增 `console.log`/`console.info`（前端）
- [x] 无新增 `console.*`（后端，使用 logger）

## 暂缓遗留问题（非本轮范围）

- **P2-17 剩余约 343 处硬编码**：本轮迁移 SchedulerStats.tsx 74 处 + CombinedViewPage.tsx 20 处 = 94 处，剩余约 526-89-94=343 处分布在 129 个文件中
- **P2-01 剩余 5 个 service 文件**：literatureApplyService.ts（28722）、achievementService.ts（24580）、learningTools.ts（20252）、aiActionService.ts（20711）、cacheService.ts（14868）
- **P2-01 AgentService 高风险模块**：PendingActionManager / ToolExecutor / SessionOrchestrator 未拆分
- **P2-02 剩余 7 个路由文件**：learningPaths.ts（15356）、graphs/expansion.ts（14271）、literature.ts（13925）、agent.ts（11714）、ai/document.ts（11154）、ai/content.ts（10436）、knowledgePoints.ts（12735）
- **Redis 后端实现**：桌面应用单实例不暴露问题，Web 多实例部署时再做
- **SSE 跨实例广播**：同上
- **P3-12 SQLite/PostgreSQL schema 同步**：已评估为不必要
