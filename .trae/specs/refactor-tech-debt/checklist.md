# Checklist

## 阶段一：死代码与依赖清理

- [ ] `src/utils/cachedApi.ts`、`dataCache.ts`、`queryOptimizer.ts`、`contextBuilder.ts` 已删除
- [ ] `src/hooks/queries/queryConfig.ts` 已删除，`config.ts` 仍正常工作
- [ ] `e2e/example.spec.ts` 已删除
- [ ] `api/middleware/indexMapping.ts` 已删除
- [ ] `api/app.ts` 中重复的 `/api/health` 端点已删除
- [ ] `api/services/scheduler/core/eventBus.ts` 冗余重导出已删除，引用方改为直接导入
- [ ] `api/services/common/index.ts` 中 `searchService` 重导出已删除
- [ ] `src/services/mobile/realtime.ts` 不再从 `mobile/index.ts` 对外导出
- [ ] `pdf-parse`、`@types/bcryptjs`、`@vercel/node` 已从 package.json 移除
- [ ] `@types/react-syntax-highlighter`、`@types/three`、`@capacitor/cli` 已移至 devDependencies
- [ ] `vite.config.ts` 中 `getBasePath()` 已删除
- [ ] `scripts/` 中 5 个未使用脚本已删除
- [ ] `npm run check` 和 `npm run lint` 通过

## 阶段二：类型安全加固

- [ ] `tsconfig.electron.json` 已启用 `strict: true` 和 `noImplicitAny: true`
- [ ] `electron/preload.ts` 中无 `any` 类型
- [ ] `api/middleware/auth.ts` 中 `user` 字段为具体类型而非 `any`
- [ ] `src/services/api/client.ts` 中 `handleResponse` 和 `request` 无 `<T = any>` 默认
- [ ] 后端路由中所有 `catch (error: any)` 已改为 `catch (error: unknown)`
- [ ] 后端路由中所有 `req.supabase!` 已改为安全检查模式
- [ ] `routes/achievements.ts` 使用 `AuthRequest` 而非手动类型转换
- [ ] `mobile/scheduler.ts` 中 `mobileSchedulerApi` 有具体类型而非 `any`
- [ ] `mobile/` 目录下无 `as any` 类型转换
- [ ] `sync/` 目录下无 `any` 类型
- [ ] `hooks/graphEditor/` 中无 `RefObject<any>` 或 `useRef<any>`
- [ ] `utils/markdownParser.ts` 中无 `any` 类型
- [ ] `npm run check` 通过

## 阶段三：合并重复后端服务

- [ ] 根级 `taskService.ts` 已重命名为 `asyncTaskService.ts`，类名 `AsyncTaskService`
- [ ] 调度器 `settingsService.ts` 已重命名为 `taskSettingsService.ts`，类名 `TaskSettingsService`
- [ ] 核心层 `settingsService.ts` 已重命名为 `appSettingsService.ts`，类名 `AppSettingsService`
- [ ] 所有引用已更新，无断链
- [ ] `scheduler/achievementService.ts` 已删除，功能整合到根级版本
- [ ] `services/graph/backboneValidatorService.ts` 已删除，引用改为 AI 版本
- [ ] `FocusSession` 仅在 `shared/types/scheduler.ts` 中定义一份
- [ ] `Achievement` 仅在 `shared/types/scheduler.ts` 中定义一份（含完整分类）
- [ ] `TaskSettings` 仅在 `shared/types/scheduler.ts` 中定义一份
- [ ] `TaskExecution`/`ExecutionFilters` 仅在 `shared/types/scheduler.ts` 中定义一份
- [ ] `Keyword` 仅在 `shared/types/graph.ts` 中定义一份
- [ ] `NetworkAnalysisResult` 仅在 `shared/types/graph.ts` 中定义一份
- [ ] `npm run check` 通过

## 阶段四：合并路由与统一响应

- [ ] `routes/focus.ts` 已删除，端点已迁移到 `routes/scheduler/focus.ts`
- [ ] `api/services/study/learningPathService.ts` 已创建，包含共享逻辑
- [ ] `routes/learningPath.ts` 和 `routes/learningPaths.ts` 无重复逻辑
- [ ] `api/utils/response.ts` 已创建，提供统一响应辅助函数
- [ ] 根级 `routes/tasks.ts` 使用 `AppError` 而非手动 `res.status()`
- [ ] 所有 API 端点返回统一的 `{ success, data/error, code? }` 格式
- [ ] `/api/tasks`、`/api/graphs`、`/api/backup` 已添加速率限制
- [ ] `npm run check` 和 `npm run lint` 通过

## 阶段五：前端 API 层去重

- [ ] `src/lib/supabase.ts` 统一处理 Supabase 客户端创建，支持 realtime 配置
- [ ] `src/services/mobile/client.ts` 中 `getMobileSupabaseClient()` 已删除
- [ ] `AuthResponse`、`RegisterData`、`LoginData`、`UpdateProfileData` 仅在 `shared/types/` 中定义
- [ ] `mobile/scheduler.ts` 已拆分为独立模块
- [ ] `mobile/aiService.ts` prompt 模板已提取到独立文件
- [ ] `mobile/promptService.ts` OUTPUT_SCHEMAS 已提取到独立文件
- [ ] `mobile/study.ts` 已拆分为 study、dashboard、statistics 模块
- [ ] `mobile/graphs.ts` stub 方法已清理
- [ ] `npm run check` 通过

## 阶段六：类型系统整理

- [ ] `shared/types/common.ts` 已拆分为 `notification.ts`、`task.ts`、`studyCard.ts`、`tutor.ts`、`tts.ts`
- [ ] `shared/types/index.ts` 导出已更新
- [ ] `User` 接口仅在 `shared/types/user.ts` 中定义，`api/models/user.ts` 通过扩展共享类型
- [ ] `CreateUserInput`/`UpdateUserInput` 仅在 `api/database/interface.ts` 中定义
- [ ] 旧 `Task` 接口已删除，全局使用 `UserTask`
- [ ] `shared/types/scheduler.ts` 中 12 个 `@deprecated` 类型已删除
- [ ] `shared/types/index.ts` 已补导出 `events.ts`
- [ ] `npm run check` 通过

## 阶段七：测试基础设施

- [ ] `package.json` 中 9 个无效测试脚本已删除
- [ ] `npx playwright test` 使用基础配置正常运行
- [ ] ESLint 不再忽略测试文件
- [ ] `requestLogger.ts` 中 `getRequestStats` 和 `LOG_BUFFER` 实现已修复
- [ ] `api/middleware/` 中无 `console.error`，全部使用 `logger`
- [ ] `npm run lint` 通过

## 阶段八：依赖统一与最终验证

- [ ] 3 个组件已从 `@hello-pangea/dnd` 迁移到 `@dnd-kit`
- [ ] `@hello-pangea/dnd` 已从 package.json 移除
- [ ] `npm run check` 全量类型检查通过
- [ ] `npm run lint` 代码检查通过
- [ ] `npm run electron:dev` 开发模式启动正常
- [ ] `npx playwright test` E2E 测试通过
