# Tasks

## 阶段一：清理死代码与无用依赖（快速减负）

- [x] Task 1: 删除未使用的前端工具文件
  - [x] SubTask 1.1: 删除 `src/utils/cachedApi.ts`
  - [x] SubTask 1.2: 删除 `src/utils/dataCache.ts`
  - [x] SubTask 1.3: 删除 `src/utils/queryOptimizer.ts`
  - [x] SubTask 1.4: 删除 `src/utils/contextBuilder.ts`
  - [x] SubTask 1.5: 删除 `src/hooks/queries/queryConfig.ts`（与 config.ts 重复且未被引用）
  - [x] SubTask 1.6: 删除 `e2e/example.spec.ts` 模板文件
  - [x] SubTask 1.7: 验证 `npm run check` 和 `npm run lint` 通过

- [x] Task 2: 删除未使用的后端代码
  - [x] SubTask 2.1: 删除 `api/middleware/indexMapping.ts`（零引用的中间件）
  - [x] SubTask 2.2: 删除 `api/app.ts` 中重复的 `/api/health` GET 端点（L230-235）
  - [x] SubTask 2.3: 删除 `api/services/scheduler/core/eventBus.ts` 冗余重导出，改为直接从 `core/eventBus` 导入
  - [x] SubTask 2.4: 删除 `api/services/common/index.ts` 中对 `searchService` 的不当重导出
  - [x] SubTask 2.5: 删除 `src/services/mobile/realtime.ts` 的外部导出（`mobile/index.ts` 中的 re-export）
  - [x] SubTask 2.6: 验证 `npm run check` 和 `npm run lint` 通过

- [x] Task 3: 清理无用 npm 依赖与修正依赖分类
  - [x] SubTask 3.1: 移除 `pdf-parse` 依赖（项目无任何引用）
  - [x] SubTask 3.2: 移除 `@types/bcryptjs` 依赖（项目使用 bcrypt 而非 bcryptjs）
  - [x] SubTask 3.3: 移除 `@vercel/node` 依赖（Electron 项目无 Vercel 部署）
  - [x] SubTask 3.4: 将 `@types/react-syntax-highlighter` 从 dependencies 移至 devDependencies
  - [x] SubTask 3.5: 将 `@types/three` 从 dependencies 移至 devDependencies
  - [x] SubTask 3.6: 将 `@capacitor/cli` 从 dependencies 移至 devDependencies
  - [x] SubTask 3.7: 删除 `vite.config.ts` 中未使用的 `getBasePath()` 函数
  - [x] SubTask 3.8: 执行 `npm install` 验证依赖变更正确

- [x] Task 4: 清理未使用的脚本文件
  - [x] SubTask 4.1: 删除 `scripts/dataConverter.ts`
  - [x] SubTask 4.2: 删除 `scripts/migrate_graph_domains.ts`
  - [x] SubTask 4.3: 删除 `scripts/syncUsers.ts`
  - [x] SubTask 4.4: 删除 `scripts/test_aliyun_tts.ts`
  - [x] SubTask 4.5: 删除 `scripts/delete_user.ts`
  - [x] SubTask 4.6: 验证 `npm run check` 通过

## 阶段二：类型安全加固

- [ ] Task 5: 修复 TypeScript 编译配置
  - [ ] SubTask 5.1: `tsconfig.electron.json` 启用 `strict: true` 和 `noImplicitAny: true`
  - [ ] SubTask 5.2: 修复 `electron/preload.ts` 中的 `any` 类型（callback 参数改为具体类型）
  - [ ] SubTask 5.3: 修复 `api/middleware/auth.ts` 中 `user?: any` 为具体 User 类型
  - [ ] SubTask 5.4: 修复 `src/services/api/client.ts` 中 `handleResponse` 和 `request` 的 `<T = any>` 默认类型
  - [ ] SubTask 5.5: 验证 `npm run check` 通过

- [ ] Task 6: 修复后端路由中的类型安全问题
  - [ ] SubTask 6.1: 修复 80+ 处 `catch (error: any)` 为 `catch (error: unknown)`，配合类型缩窄（`error instanceof Error`）
  - [ ] SubTask 6.2: 修复 74 处 `req.supabase!` 非空断言为安全检查模式（`if (!supabase) throw ...`）
  - [ ] SubTask 6.3: 修复 `routes/achievements.ts` 中 `(req as AuthRequest)` 手动类型转换为直接使用 `AuthRequest`
  - [ ] SubTask 6.4: 验证 `npm run check` 通过

- [ ] Task 7: 修复前端移动端 API 层的类型安全问题
  - [ ] SubTask 7.1: 修复 `mobile/scheduler.ts` 中 `mobileSchedulerApi: any` 为具体类型
  - [ ] SubTask 7.2: 修复 `mobile/` 目录下 134 处 `as any` 类型转换为正确的类型标注
  - [ ] SubTask 7.3: 修复 `sync/` 目录下的 `any` 类型（`conflictService.ts`、`mobileSyncService.ts`、`syncAuthService.ts`）
  - [ ] SubTask 7.4: 修复 `hooks/graphEditor/index.ts` 中 `React.RefObject<any>` 和 `useRef<any>` 为具体类型
  - [ ] SubTask 7.5: 修复 `utils/markdownParser.ts` 中的 `any` 类型
  - [ ] SubTask 7.6: 验证 `npm run check` 通过

## 阶段三：合并重复后端服务

- [ ] Task 8: 重命名重复的服务类以消除歧义
  - [ ] SubTask 8.1: 根级 `api/services/taskService.ts` 重命名为 `asyncTaskService.ts`，类名 `TaskService` → `AsyncTaskService`，导出名 `taskService` → `asyncTaskService`
  - [ ] SubTask 8.2: 更新所有引用根级 taskService 的文件（`services/index.ts`、相关路由）
  - [ ] SubTask 8.3: 根级 `api/services/core/settingsService.ts` 重命名为 `appSettingsService.ts`，类名 → `AppSettingsService`
  - [ ] SubTask 8.4: 调度器 `api/services/scheduler/settingsService.ts` 重命名为 `taskSettingsService.ts`，类名 → `TaskSettingsService`
  - [ ] SubTask 8.5: 更新所有引用 settingsService 的文件
  - [ ] SubTask 8.6: 验证 `npm run check` 通过

- [ ] Task 9: 合并 AchievementService
  - [ ] SubTask 9.1: 将 `scheduler/achievementService.ts` 的 focus 成就检查逻辑整合到根级 `achievementService.ts`
  - [ ] SubTask 9.2: 更新 `scheduler/` 中对 achievementService 的引用改为使用根级版本
  - [ ] SubTask 9.3: 删除 `scheduler/achievementService.ts`
  - [ ] SubTask 9.4: 验证 `npm run check` 通过

- [ ] Task 10: 合并 BackboneValidatorService
  - [ ] SubTask 10.1: 确认 AI 版本（`services/ai/backboneValidatorService.ts`）已包含规则回退逻辑
  - [ ] SubTask 10.2: 更新 `services/graph/` 中对 backboneValidatorService 的引用改为使用 AI 版本
  - [ ] SubTask 10.3: 删除 `services/graph/backboneValidatorService.ts`
  - [ ] SubTask 10.4: 验证 `npm run check` 通过

- [ ] Task 11: 合并重复的接口定义到 shared/types
  - [ ] SubTask 11.1: 将 `api/services/scheduler/focusService.ts` 和 `achievementService.ts` 中的 `FocusSession` 合并到 `shared/types/scheduler.ts`，删除本地定义
  - [ ] SubTask 11.2: 将 `api/services/scheduler/achievementService.ts` 中的 `Achievement` 合并到 `shared/types/scheduler.ts`（保留完整分类含 study/creation），删除本地定义
  - [ ] SubTask 11.3: 将 `api/services/scheduler/settingsService.ts` 中的 `TaskSettings` 合并到 `shared/types/scheduler.ts`，删除本地定义
  - [ ] SubTask 11.4: 将 `api/services/scheduler/` 中的 `TaskExecution`/`ExecutionFilters` 合并到 `shared/types/scheduler.ts`，删除本地定义
  - [ ] SubTask 11.5: 将 `api/services/ai/aiService.ts` 中的 `Keyword` 合并到 `shared/types/graph.ts`，删除本地定义
  - [ ] SubTask 11.6: 将 `api/services/graph/networkAnalysisService.ts` 中的 `NetworkAnalysisResult` 合并到 `shared/types/graph.ts`，删除本地定义
  - [ ] SubTask 11.7: 验证 `npm run check` 通过

## 阶段四：合并重复路由与提取共享逻辑

- [ ] Task 12: 合并重复的 focus 路由
  - [ ] SubTask 12.1: 将 `routes/focus.ts` 的 4 个端点迁移到 `routes/scheduler/focus.ts`（调度器版本更完整）
  - [ ] SubTask 12.2: 更新 `app.ts` 中的路由注册，移除 `/api/focus` 挂载
  - [ ] SubTask 12.3: 删除 `routes/focus.ts`
  - [ ] SubTask 12.4: 验证 `npm run check` 通过

- [ ] Task 13: 提取 learningPath 共享逻辑到服务层
  - [ ] SubTask 13.1: 创建 `api/services/study/learningPathService.ts`，提取共享函数：`generateAIPath()`、`generateRulePath()`、`findPath()`、`buildProgressMap()`、`buildDependencyMaps()`、`LearningProgress`/`LearningPathStage` 接口
  - [ ] SubTask 13.2: 重构 `routes/learningPath.ts`（870 行）调用共享服务，删除内联重复逻辑
  - [ ] SubTask 13.3: 重构 `routes/learningPaths.ts`（1253 行）调用共享服务，删除内联重复逻辑
  - [ ] SubTask 13.4: 验证 `npm run check` 通过

- [ ] Task 14: 统一 API 响应格式与错误处理
  - [ ] SubTask 14.1: 创建 `api/utils/response.ts`，提供 `successResponse(res, data)` 和 `errorResponse(res, error, code)` 辅助函数
  - [ ] SubTask 14.2: 修复根级 `routes/tasks.ts` 中的手动 `res.status(500).json()` 改为抛出 `AppError`
  - [ ] SubTask 14.3: 逐步统一所有路由的响应格式为 `{ success, data/error, code? }`
  - [ ] SubTask 14.4: 为写密集端点添加速率限制（`/api/tasks`、`/api/graphs`、`/api/backup`）
  - [ ] SubTask 14.5: 验证 `npm run check` 和 `npm run lint` 通过

## 阶段五：前端 API 层去重

- [ ] Task 15: 合并 Supabase 客户端工厂
  - [ ] SubTask 15.1: 扩展 `src/lib/supabase.ts` 的 `getSupabaseClient()` 支持 `realtime` 配置参数
  - [ ] SubTask 15.2: 更新 `src/services/mobile/client.ts` 改为调用 `src/lib/supabase.ts`，删除 `getMobileSupabaseClient()`
  - [ ] SubTask 15.3: 验证 `npm run check` 通过

- [ ] Task 16: 提取前端 API 共享接口定义
  - [ ] SubTask 16.1: 将 `api/auth.ts` 和 `mobile/auth.ts` 中的 `AuthResponse`、`RegisterData`、`LoginData`、`UpdateProfileData` 提取到 `shared/types/`
  - [ ] SubTask 16.2: 更新 `api/auth.ts` 和 `mobile/auth.ts` 从 `shared/types/` 导入接口
  - [ ] SubTask 16.3: 验证 `npm run check` 通过

- [ ] Task 17: 拆分移动端巨型文件
  - [ ] SubTask 17.1: 拆分 `mobile/scheduler.ts`（1181 行）为独立模块：`mobile/scheduler/tasks.ts`、`mobile/scheduler/queues.ts`、`mobile/scheduler/settings.ts`、`mobile/scheduler/focus.ts`、`mobile/scheduler/achievements.ts` 等
  - [ ] SubTask 17.2: 拆分 `mobile/aiService.ts`（818 行）：提取 prompt 模板到 `mobile/aiPrompts.ts`
  - [ ] SubTask 17.3: 拆分 `mobile/promptService.ts`（773 行）：提取 OUTPUT_SCHEMAS 到 `mobile/outputSchemas.ts`
  - [ ] SubTask 17.4: 拆分 `mobile/study.ts`（629 行）：分离 `mobile/dashboard.ts` 和 `mobile/statistics.ts`
  - [ ] SubTask 17.5: 清理 `mobile/graphs.ts` 中 ~230 行 stub 方法，改为抛出 "Not implemented" 或删除
  - [ ] SubTask 17.6: 验证 `npm run check` 通过

## 阶段六：类型系统整理

- [ ] Task 18: 拆分 shared/types/common.ts
  - [ ] SubTask 18.1: 创建 `shared/types/notification.ts`，迁移 Notification 相关类型
  - [ ] SubTask 18.2: 创建 `shared/types/task.ts`，迁移 Task 相关类型
  - [ ] SubTask 18.3: 创建 `shared/types/studyCard.ts`，迁移 StudyCard 相关类型
  - [ ] SubTask 18.4: 创建 `shared/types/tutor.ts`，迁移 TutorSession 相关类型
  - [ ] SubTask 18.5: 创建 `shared/types/tts.ts`，迁移 TTSConfig 相关类型
  - [ ] SubTask 18.6: 更新 `shared/types/index.ts` 的导出
  - [ ] SubTask 18.7: 更新所有引用 `common.ts` 中已迁移类型的文件
  - [ ] SubTask 18.8: 验证 `npm run check` 通过

- [ ] Task 19: 统一 User 类型与清理废弃类型
  - [ ] SubTask 19.1: 以 `shared/types/user.ts` 为权威 User 定义，`api/models/user.ts` 改为扩展共享类型（添加 password_hash 等 DB 字段）
  - [ ] SubTask 19.2: 删除 `api/middleware/indexMapping.ts` 中的内联 `User` 接口（文件已在 Task 2 删除）
  - [ ] SubTask 19.3: 统一 `CreateUserInput`/`UpdateUserInput`：删除 `api/models/user.ts` 中的重复定义
  - [ ] SubTask 19.4: 统一 `Task`（common.ts）和 `UserTask`（scheduler.ts）：删除旧 `Task` 接口，全局使用 `UserTask`
  - [ ] SubTask 19.5: 从 `shared/types/scheduler.ts` 删除 12 个 `@deprecated` 类型（`ReviewTask`、`CreateReviewTaskData`、`UpdateReviewTaskData`、`ReviewTaskStats`、`PendingReviewTask`、`TaskStatus`、`ScheduledTask`、`TaskDetail`、`TaskStats`、`TaskFilters`、`CreateScheduledTaskData`、`UpdateScheduledTaskData`）
  - [ ] SubTask 19.6: 从 `shared/types/index.ts` 补导出 `events.ts`
  - [ ] SubTask 19.7: 验证 `npm run check` 通过

## 阶段七：测试基础设施修复

- [ ] Task 20: 修复 Playwright 测试配置
  - [ ] SubTask 20.1: 删除 `package.json` 中 9 个引用不存在配置文件的 npm 脚本（`test:auth`、`test:dashboard`、`test:study`、`test:graph`、`test:settings`、`test:profile`、`test:scheduler`、`test:achievements`、`test:integration`）
  - [ ] SubTask 20.2: 验证 `npx playwright test` 使用基础 `playwright.config.ts` 正常运行

- [ ] Task 21: 修复 ESLint 和日志问题
  - [ ] SubTask 21.1: 从 `eslint.config.js` 的 ignores 中移除 `**/*.test.ts` 和 `**/*.test.tsx`
  - [ ] SubTask 21.2: 修复 `api/middleware/requestLogger.ts` 中 `getRequestStats` 和 `LOG_BUFFER` 的无效实现
  - [ ] SubTask 21.3: 修复 `api/middleware/` 中 `console.error` 改为使用 `logger`
  - [ ] SubTask 21.4: 验证 `npm run lint` 通过

## 阶段八：依赖库统一

- [ ] Task 22: 统一拖拽库
  - [ ] SubTask 22.1: 将 `HorizontalQueueView.tsx`、`HorizontalQueue.tsx`、`DraggableTaskCard.tsx` 从 `@hello-pangea/dnd` 迁移到 `@dnd-kit`
  - [ ] SubTask 22.2: 移除 `@hello-pangea/dnd` 依赖
  - [ ] SubTask 22.3: 验证 `npm run check` 和 `npm run lint` 通过

- [ ] Task 23: 最终验证
  - [ ] SubTask 23.1: 执行 `npm run check` 全量类型检查通过
  - [ ] SubTask 23.2: 执行 `npm run lint` 代码检查通过
  - [ ] SubTask 23.3: 执行 `npm run electron:dev` 验证开发模式启动正常
  - [ ] SubTask 23.4: 执行 `npx playwright test` 验证 E2E 测试通过

# Task Dependencies

- [Task 5] depends on [Task 1, Task 2] (先清理死代码再修类型，减少修复范围)
- [Task 6] depends on [Task 5] (tsconfig 严格模式启用后再修路由类型)
- [Task 7] depends on [Task 5] (tsconfig 严格模式启用后再修移动端类型)
- [Task 8] depends on [Task 6] (服务重命名需类型安全基础)
- [Task 9] depends on [Task 8] (AchievementService 合并依赖服务重命名)
- [Task 10] depends on [Task 8] (BackboneValidatorService 合并依赖服务重命名)
- [Task 11] depends on [Task 9, Task 10] (接口合并依赖服务合并)
- [Task 12] depends on [Task 11] (路由合并依赖接口统一)
- [Task 13] depends on [Task 12] (learningPath 提取依赖路由清理)
- [Task 14] depends on [Task 13] (响应格式统一依赖路由合并)
- [Task 15] depends on [Task 7] (Supabase 客户端合并依赖移动端类型修复)
- [Task 16] depends on [Task 15] (接口提取依赖客户端合并)
- [Task 17] depends on [Task 16] (文件拆分依赖接口提取)
- [Task 18] depends on [Task 11] (类型拆分依赖接口合并)
- [Task 19] depends on [Task 18] (类型统一依赖类型拆分)
- [Task 20] depends on [Task 1] (测试修复依赖死代码清理)
- [Task 21] depends on [Task 6] (ESLint 修复依赖类型修复)
- [Task 22] depends on [Task 1] (拖拽库迁移独立于其他任务)
- [Task 23] depends on [all previous tasks]

# Parallelizable Work

以下任务可以并行执行：
- Task 1, Task 2, Task 3, Task 4 (阶段一内部可并行)
- Task 6 和 Task 7 (后端和前端类型修复可并行)
- Task 8, Task 9, Task 10 (服务合并可部分并行，但需注意命名冲突)
- Task 15, Task 22 (Supabase 合并和拖拽库迁移可并行)
- Task 20, Task 21 (测试和 ESLint 修复可并行)
