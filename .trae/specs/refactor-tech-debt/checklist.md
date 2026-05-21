# Checklist

## 阶段一：死代码与依赖清理

- [x] `src/utils/cachedApi.ts`、`dataCache.ts`、`queryOptimizer.ts`、`contextBuilder.ts` 已删除
- [x] `src/hooks/queries/queryConfig.ts` 已删除，`config.ts` 仍正常工作
- [x] `e2e/example.spec.ts` 已删除
- [x] `api/middleware/indexMapping.ts` 已删除
- [x] `api/app.ts` 中重复的 `/api/health` 端点已删除
- [x] `api/services/scheduler/core/eventBus.ts` 冗余重导出已删除，引用方改为直接导入
- [x] `api/services/common/index.ts` 中 `searchService` 重导出已删除
- [x] `src/services/mobile/realtime.ts` 不再从 `mobile/index.ts` 对外导出
- [x] `pdf-parse`、`@types/bcryptjs`、`@vercel/node` 已从 package.json 移除
- [x] `@types/react-syntax-highlighter`、`@types/three`、`@capacitor/cli` 已移至 devDependencies
- [x] `vite.config.ts` 中 `getBasePath()` 已删除
- [x] `scripts/` 中 5 个未使用脚本已删除
- [x] `api/index.ts` (Vercel 入口) 已删除
- [x] `npm run check` 和 `npm run lint` 通过

## 阶段二：类型安全加固（已跳过 — 需专项处理）

- [SKIP] `tsconfig.electron.json` strict 模式启用（导致 750+ 级联错误）
- [SKIP] 后端/前端 `any` 类型修复（依赖 strict 模式）

## 阶段三：合并重复后端服务

- [x] 根级 `taskService.ts` 已重命名为 `asyncTaskService.ts`，类名 `AsyncTaskService`
- [x] 调度器 `settingsService.ts` 已重命名为 `taskSettingsService.ts`，类名 `TaskSettingsService`
- [x] 核心层 `settingsService.ts` 已重命名为 `appSettingsService.ts`，类名 `AppSettingsService`
- [x] 所有引用已更新，无断链
- [x] `scheduler/achievementService.ts` 已删除，功能整合到根级版本
- [x] `services/graph/backboneValidatorService.ts` 已删除，方法合并到 AI 版本
- [x] `FocusSession` 仅在 `shared/types/scheduler.ts` 中定义一份
- [x] `Achievement` 仅在 `shared/types/scheduler.ts` 中定义一份（含完整分类）
- [x] `TaskSettings` 仅在 `shared/types/scheduler.ts` 中定义一份
- [x] `Keyword` 仅在 `shared/types/graph.ts` 中定义一份
- [x] `NetworkAnalysisResult` 仅在 `shared/types/graph.ts` 中定义一份
- [x] `npm run check` 通过

## 阶段四：合并路由与提取共享逻辑

- [x] `routes/focus.ts` 已删除，端点已迁移到 `routes/scheduler/focus.ts`
- [x] `api/services/study/learningPathService.ts` 已创建，包含共享逻辑
- [x] `routes/learningPath.ts` 和 `routes/learningPaths.ts` 无重复逻辑
- [SKIP] API 响应格式统一（留待后续专项处理）
- [SKIP] 速率限制添加（留待后续专项处理）
- [x] `npm run check` 和 `npm run lint` 通过

## 阶段五：前端 API 层去重（已跳过 — 需专项处理）

- [SKIP] Supabase 客户端合并
- [SKIP] 前端 API 接口提取
- [SKIP] 移动端巨型文件拆分

## 阶段六：类型系统整理（已跳过 — 需专项处理）

- [SKIP] common.ts 拆分
- [SKIP] User 类型统一
- [SKIP] 废弃类型清理

## 阶段七：测试基础设施

- [x] `package.json` 中 10 个无效测试脚本已删除
- [x] ESLint 不再忽略测试文件
- [x] `requestLogger.ts` 中 `getRequestStats` 实现已修复
- [x] `api/middleware/` 中无 `console.error`，全部使用 `logger`
- [x] `npm run lint` 通过

## 阶段八：依赖统一与最终验证

- [x] 3 个组件已从 `@hello-pangea/dnd` 迁移到 `@dnd-kit`
- [x] `@hello-pangea/dnd` 已从 package.json 移除
- [x] `npm run check` 全量类型检查通过
- [x] `npm run lint` 代码检查通过
