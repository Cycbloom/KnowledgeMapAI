# Round 11 Checklist

## Task 1: P2-17 i18n 迁移 GraphStyleSettings.tsx + TextToGraphModal.tsx

- [x] `src/components/GraphEditor/shared/GraphStyleSettings.tsx` 中硬编码中文已全部迁移为 `t()` 调用
- [x] `src/components/GraphEditor/modals/TextToGraphModal.tsx` 中硬编码中文已全部迁移为 `t()` 调用
- [x] `src/i18n/locales/zh-CN.json` 新增 graphStyleSettings 与 textToGraph 命名空间
- [x] `src/i18n/locales/en-US.json` 新增对应英文翻译
- [x] `npm run check` 通过（退出码 0）
- [x] `npm run lint` 通过（退出码 0）
- [x] 无新增 `any` 类型、非空断言 `!`、前端 `console.log/info`

## Task 2: P2-02 learningPaths.ts 路由拆分

- [x] `api/routes/learningPaths/` 目录已创建，含子文件与 index.ts 聚合（7 个文件：index/shared/crud/nodes/progress/plans/generation）
- [x] 原 `api/routes/learningPaths.ts` 已删除
- [x] 引用已更新（StudyPlugin.ts 的 import 自动解析到 ./learningPaths/index）
- [x] 路由路径与行为完全不变
- [x] `npm run check` 通过（退出码 0）
- [x] `npm run lint` 通过（退出码 0）
- [x] 无新增 `any` 类型、非空断言 `!`、后端 `console.*`

## Task 3: P2-02 ai/content.ts 路由拆分

- [x] `api/routes/ai/content/` 目录已创建，含子文件与 index.ts 聚合（5 个文件：index/status/annotate/podcast/generate）
- [x] 原 `api/routes/ai/content.ts` 已删除
- [x] 引用已更新（api/routes/ai/index.ts 的 `import contentRouter from './content'` 自动解析到 ./content/index）
- [x] 路由路径与行为完全不变（6 个路由：/status、/annotate-terms、/podcast/script、/generate-content、/learning-material、/generate-content-stream）
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

- **P2-17 剩余约 321 处硬编码**：本轮迁移 GraphStyleSettings.tsx + TextToGraphModal.tsx，剩余约 321 处分布在 98 个文件中
- **P2-01 剩余 5 个 service 文件**：literatureApplyService.ts（28722）、achievementService.ts（24580）、learningTools.ts（20252）、aiActionService.ts（20711）、cacheService.ts（14868）
- **P2-01 AgentService 高风险模块**：PendingActionManager / ToolExecutor / SessionOrchestrator 未拆分
- **P2-02 剩余 5 个路由文件**：graphs/expansion.ts（14271）、literature.ts（13925）、knowledgePoints.ts（12735）、agent.ts（11714）、ai/document.ts（11154）
- **Redis 后端实现**：桌面应用单实例不暴露问题
- **SSE 跨实例广播**：同上
- **P3-12 SQLite/PostgreSQL schema 同步**：已评估为不必要
