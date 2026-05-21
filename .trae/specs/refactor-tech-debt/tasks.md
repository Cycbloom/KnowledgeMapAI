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

## 阶段二：类型安全加固（已跳过 — 改动量过大，留待后续专项处理）

- [SKIP] Task 5: 修复 TypeScript 编译配置（strict 模式导致 750+ 级联错误，需专项处理）
- [SKIP] Task 6: 修复后端路由中的类型安全问题（依赖 Task 5）
- [SKIP] Task 7: 修复前端移动端 API 层的类型安全问题（依赖 Task 5）

## 阶段三：合并重复后端服务

- [x] Task 8: 重命名重复的服务类以消除歧义
  - [x] SubTask 8.1: 根级 `api/services/taskService.ts` 重命名为 `asyncTaskService.ts`，类名 `TaskService` → `AsyncTaskService`，导出名 `taskService` → `asyncTaskService`
  - [x] SubTask 8.2: 更新所有引用根级 taskService 的文件（`services/index.ts`、相关路由）
  - [x] SubTask 8.3: 根级 `api/services/core/settingsService.ts` 重命名为 `appSettingsService.ts`，类名 → `AppSettingsService`
  - [x] SubTask 8.4: 调度器 `api/services/scheduler/settingsService.ts` 重命名为 `taskSettingsService.ts`，类名 → `TaskSettingsService`
  - [x] SubTask 8.5: 更新所有引用 settingsService 的文件
  - [x] SubTask 8.6: 验证 `npm run check` 通过

- [x] Task 9: 合并 AchievementService
  - [x] SubTask 9.1: 将 `scheduler/achievementService.ts` 的 focus 成就检查逻辑整合到根级 `achievementService.ts`
  - [x] SubTask 9.2: 更新 `scheduler/` 中对 achievementService 的引用改为使用根级版本
  - [x] SubTask 9.3: 删除 `scheduler/achievementService.ts`
  - [x] SubTask 9.4: 验证 `npm run check` 通过

- [x] Task 10: 合并 BackboneValidatorService
  - [x] SubTask 10.1: 确认 AI 版本（`services/ai/backboneValidatorService.ts`）已包含规则回退逻辑
  - [x] SubTask 10.2: 更新 `services/graph/` 中对 backboneValidatorService 的引用改为使用 AI 版本
  - [x] SubTask 10.3: 删除 `services/graph/backboneValidatorService.ts`
  - [x] SubTask 10.4: 验证 `npm run check` 通过

- [x] Task 11: 合并重复的接口定义到 shared/types
  - [x] SubTask 11.1-11.7: 所有接口已合并到 shared/types，本地定义已删除

## 阶段四：合并重复路由与提取共享逻辑

- [x] Task 12: 合并重复的 focus 路由
  - [x] SubTask 12.1: 将 `routes/focus.ts` 的 today 端点迁移到 `routes/scheduler/focus.ts`
  - [x] SubTask 12.2: 更新 `app.ts` 中的路由注册，移除 `/api/focus` 挂载
  - [x] SubTask 12.3: 删除 `routes/focus.ts`
  - [x] SubTask 12.4: 验证 `npm run check` 通过

- [x] Task 13: 提取 learningPath 共享逻辑到服务层
  - [x] SubTask 13.1: 创建 `api/services/study/learningPathService.ts`
  - [x] SubTask 13.2: 重构 `routes/learningPath.ts` 调用共享服务
  - [x] SubTask 13.3: 重构 `routes/learningPaths.ts` 调用共享服务
  - [x] SubTask 13.4: 验证 `npm run check` 通过

- [SKIP] Task 14: 统一 API 响应格式与错误处理（改动范围大，留待后续专项处理）

## 阶段五：前端 API 层去重（留待后续专项处理 — 涉及大量移动端代码重构）

- [SKIP] Task 15: 合并 Supabase 客户端工厂
- [SKIP] Task 16: 提取前端 API 共享接口定义
- [SKIP] Task 17: 拆分移动端巨型文件

## 阶段六：类型系统整理（留待后续专项处理 — 涉及大量文件更新）

- [SKIP] Task 18: 拆分 shared/types/common.ts
- [SKIP] Task 19: 统一 User 类型与清理废弃类型

## 阶段七：测试基础设施修复

- [x] Task 20: 修复 Playwright 测试配置
  - [x] SubTask 20.1: 删除 `package.json` 中 9+1 个引用不存在配置文件的 npm 脚本
  - [x] SubTask 20.2: 验证 `npx playwright test` 使用基础 `playwright.config.ts` 正常运行

- [x] Task 21: 修复 ESLint 和日志问题
  - [x] SubTask 21.1: 从 `eslint.config.js` 的 ignores 中移除 `**/*.test.ts` 和 `**/*.test.tsx`
  - [x] SubTask 21.2: 修复 `api/middleware/requestLogger.ts` 中 `getRequestStats` 实现
  - [x] SubTask 21.3: 确认 `api/middleware/` 中无 `console.error`
  - [x] SubTask 21.4: 验证 `npm run lint` 通过

## 阶段八：依赖库统一

- [x] Task 22: 统一拖拽库
  - [x] SubTask 22.1: 将 3 个组件从 `@hello-pangea/dnd` 迁移到 `@dnd-kit`
  - [x] SubTask 22.2: 移除 `@hello-pangea/dnd` 依赖
  - [x] SubTask 22.3: 验证 `npm run check` 和 `npm run lint` 通过

- [x] Task 23: 最终验证
  - [x] SubTask 23.1: `npm run check` 全量类型检查通过
  - [x] SubTask 23.2: `npm run lint` 代码检查通过

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
