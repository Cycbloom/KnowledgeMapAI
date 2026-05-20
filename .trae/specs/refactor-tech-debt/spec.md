# 技术债务清理与重构 Spec

## Why

项目经过多轮功能迭代后积累了大量技术债务：前后端 API 层存在 ~4000+ 行重复代码、10+ 个类型接口在多处重复定义、后端存在同名但不同实现的重复服务类、`tsconfig.electron.json` 关闭了严格类型检查导致 `any` 泛滥、9 个 Playwright 配置文件缺失导致测试脚本全部失效。这些债务严重拖慢了开发效率和代码质量，需要系统性清理以轻装上阵。

## What Changes

### 阶段一：清理死代码与无用依赖（快速减负）
- 删除未使用的工具文件（`cachedApi.ts`、`dataCache.ts`、`queryOptimizer.ts`、`contextBuilder.ts`）
- 删除未使用的 `queryConfig.ts`（与 `config.ts` 重复）
- 删除未使用的 `publicKnowledgePointsApi` 导出
- 删除未使用的 `useKeyboardShortcuts` hook 导出
- 删除未使用的 `middleware/indexMapping.ts`（零引用）
- 删除 `e2e/example.spec.ts` 模板文件
- 删除 `api/app.ts` 中重复的 `/api/health` 端点
- 删除 `vite.config.ts` 中未使用的 `getBasePath()` 函数
- 删除 `api/services/scheduler/core/eventBus.ts` 冗余重导出
- 删除 `api/services/common/index.ts` 中对 `searchService` 的不当重导出
- 移除无用 npm 依赖：`pdf-parse`、`@types/bcryptjs`、`@vercel/node`
- 将 `@types/react-syntax-highlighter`、`@types/three`、`@capacitor/cli` 从 dependencies 移至 devDependencies
- 清理 `scripts/` 中未挂载 npm 命令的脚本（`dataConverter.ts`、`migrate_graph_domains.ts`、`syncUsers.ts`、`test_aliyun_tts.ts`、`delete_user.ts`）

### 阶段二：类型安全加固
- **BREAKING** `tsconfig.electron.json` 启用 `strict: true` 和 `noImplicitAny: true`
- 修复 `electron/preload.ts` 中的 `any` 类型
- 修复 `api/middleware/auth.ts` 中 `user?: any` 为具体类型
- 修复 `src/services/api/client.ts` 中 `handleResponse` 和 `request` 的 `<T = any>` 默认类型
- 修复 80+ 处 `catch (error: any)` 为 `catch (error: unknown)` 并配合类型缩窄
- 修复 74 处 `req.supabase!` 非空断言为安全检查模式
- 修复 `src/services/mobile/` 中 134 处 `as any` 类型转换

### 阶段三：合并重复后端服务
- 合并两个 `TaskService`：根级 `taskService.ts`（system_tasks）重命名为 `AsyncTaskService`，调度器 `taskService.ts`（user_tasks）保持不变
- 合并两个 `AchievementService`：将调度器版本的功能整合到根级版本中，删除调度器版本
- 合并两个 `BackboneValidatorService`：AI 版本已包含规则回退，删除图版本
- 合并两个 `SettingsService`：核心版本（app_settings）重命名为 `AppSettingsService`，调度器版本（task_settings）重命名为 `TaskSettingsService`
- 合并两个 `FocusSession` 接口定义到 `shared/types/scheduler.ts`
- 合并两个 `Achievement` 接口定义到 `shared/types/scheduler.ts`（保留完整分类）
- 合并两个 `TaskSettings` 接口定义到 `shared/types/scheduler.ts`
- 合并两个 `TaskExecution` / `ExecutionFilters` 接口定义到 `shared/types/scheduler.ts`
- 合并两个 `Keyword` 接口定义到 `shared/types/graph.ts`
- 合并两个 `NetworkAnalysisResult` 接口定义到 `shared/types/graph.ts`

### 阶段四：合并重复路由与提取共享逻辑
- 合并 `routes/focus.ts` 到 `routes/scheduler/focus.ts`（调度器版本更完整），删除根级版本
- 提取 `routes/learningPath.ts` 和 `routes/learningPaths.ts` 中的共享逻辑到 `services/study/learningPathService.ts`：`generateAIPath()`、`generateRulePath()`、`findPath()`、`buildProgressMap()`、`buildDependencyMaps()`
- `routes/learningPath.ts` 改为调用共享服务，删除内联的重复逻辑
- `routes/learningPaths.ts` 改为调用共享服务，删除内联的重复逻辑
- 统一 API 响应格式：所有路由使用 `{ success: true, data }` / `{ success: false, error, code }` 信封
- 修复 `routes/achievements.ts` 中 `(req as AuthRequest)` 手动类型转换为直接使用 `AuthRequest`
- 为写密集端点添加速率限制（`/api/tasks`、`/api/graphs`、`/api/backup`）

### 阶段五：前端 API 层去重
- 提取 `services/api/` 和 `services/mobile/` 的共享接口定义到 `shared/types/`
- 合并两个 Supabase 客户端工厂：`src/lib/supabase.ts` 统一处理，移动端通过参数区分 realtime 配置
- 为 `services/api/` 和 `services/mobile/` 建立适配器模式，共享接口定义
- 拆分 `mobile/scheduler.ts`（1181 行）为独立模块：tasks、queues、settings、focus、achievements 等
- 拆分 `mobile/aiService.ts`（818 行）：提取 prompt 模板到独立文件
- 拆分 `mobile/promptService.ts`（773 行）：提取 OUTPUT_SCHEMAS 到独立数据文件
- 拆分 `mobile/study.ts`（629 行）：分离 dashboard 和 statistics API
- 清理 `mobile/graphs.ts` 中的 ~230 行 stub 方法

### 阶段六：类型系统整理
- 拆分 `shared/types/common.ts`（416 行）为独立文件：`notification.ts`、`task.ts`、`studyCard.ts`、`tutor.ts`、`tts.ts`、`learningPath.ts`
- 从 `shared/types/index.ts` 补导出 `events.ts`
- 删除 `shared/types/scheduler.ts` 中标记 `@deprecated` 但仍导出的类型（`ReviewTask`、`CreateReviewTaskData` 等 12 个）
- 统一 `User` 接口：以 `shared/types/user.ts` 为权威定义，`api/models/user.ts` 改为扩展共享类型，删除 `api/middleware/indexMapping.ts` 中的内联 `User`
- 统一 `CreateUserInput` / `UpdateUserInput`：删除 `api/models/user.ts` 中的重复定义，使用 `api/database/interface.ts` 中的版本
- 统一 `Task`（common.ts）和 `UserTask`（scheduler.ts）：删除旧 `Task` 接口，统一使用 `UserTask`

### 阶段七：测试基础设施修复
- 修复 9 个缺失的 Playwright 配置文件（或删除 package.json 中对应的 npm 脚本）
- 补充 Page Object Model 文件（当前仅 1 个）
- 将 ESLint 配置中的 `**/*.test.ts` 和 `**/*.test.tsx` 从忽略列表中移除
- 修复 `api/middleware/requestLogger.ts` 中 `getRequestStats` 和 `LOG_BUFFER` 的无效实现
- 修复 `vite.config.ts` 中 PWA devOptions 在开发模式下的缓存问题

### 阶段八：依赖库统一
- 统一拖拽库：选择 `@dnd-kit` 作为唯一拖拽方案，迁移 `@hello-pangea/dnd` 的 3 个使用处，移除 `@hello-pangea/dnd`
- 删除 `mobile/realtime.ts` 的外部导出（仅内部使用）

## Impact

- Affected specs: 类型系统、API 层架构、服务层架构、测试基础设施
- Affected code:
  - `src/services/mobile/` — 大规模重构
  - `src/services/api/` — 接口统一
  - `api/services/` — 服务合并与重命名
  - `api/routes/` — 路由合并与响应格式统一
  - `shared/types/` — 类型拆分与去重
  - `tsconfig.electron.json` — 严格模式启用
  - `package.json` — 依赖清理
  - `e2e/` — 测试基础设施修复

## ADDED Requirements

### Requirement: 死代码清理
系统 SHALL 不包含任何未被引用的工具文件、中间件、路由端点或 npm 依赖。

#### Scenario: 删除未使用文件后项目仍可正常构建
- **WHEN** 执行 `npm run check` 和 `npm run lint`
- **THEN** 所有检查通过，无新增错误

### Requirement: 类型安全强制执行
系统 SHALL 在所有 TypeScript 配置中启用 `strict: true`，禁止 `any` 类型和 `!` 非空断言。

#### Scenario: 严格模式启用后无类型错误
- **WHEN** 执行 `npm run check`
- **THEN** 零类型错误

#### Scenario: catch 块使用 unknown 类型
- **WHEN** 代码审查 catch 块
- **THEN** 所有 catch 块使用 `error: unknown` 并配合类型缩窄

### Requirement: 服务去重
系统 SHALL 不存在同名但不同实现的重复服务类。

#### Scenario: TaskService 命名清晰
- **WHEN** 开发者搜索 TaskService
- **THEN** 仅存在 `AsyncTaskService`（system_tasks）和 `TaskService`（user_tasks），命名明确区分职责

### Requirement: API 响应格式统一
系统 SHALL 所有 API 端点返回统一的响应信封格式。

#### Scenario: 成功响应格式
- **WHEN** API 请求成功
- **THEN** 响应体为 `{ success: true, data: T }`

#### Scenario: 错误响应格式
- **WHEN** API 请求失败
- **THEN** 响应体为 `{ success: false, error: string, code?: string }`

### Requirement: 前端 API 层去重
系统 SHALL 前端 API 层和移动端 API 层共享接口定义，不重复定义相同类型。

#### Scenario: AuthResponse 类型唯一
- **WHEN** 搜索 AuthResponse 接口定义
- **THEN** 仅在 `shared/types/` 中存在一份定义

### Requirement: 类型系统单一来源
系统 SHALL 所有共享类型在 `shared/types/` 中有且仅有一份权威定义。

#### Scenario: User 接口唯一
- **WHEN** 搜索 User 接口定义
- **THEN** 仅在 `shared/types/user.ts` 中存在权威定义，其他位置通过 import 引用

### Requirement: 测试基础设施可用
系统 SHALL 所有 package.json 中定义的测试脚本均可正常执行。

#### Scenario: 运行特定测试脚本
- **WHEN** 执行 `npm run test:auth`
- **THEN** 脚本正常运行，不因配置文件缺失而报错

## MODIFIED Requirements

### Requirement: TypeScript 编译配置
`tsconfig.electron.json` SHALL 启用 `strict: true` 和 `noImplicitAny: true`，与 `tsconfig.json` 保持一致的严格性。

### Requirement: ESLint 配置
ESLint 配置 SHALL 不忽略测试文件，确保测试代码质量同样受检。

## REMOVED Requirements

### Requirement: 移动端独立 API 类型定义
**Reason**: 移动端和常规 API 的类型定义完全重复，应统一到 `shared/types/`
**Migration**: 移动端 API 文件改为从 `shared/types/` 导入类型

### Requirement: `@hello-pangea/dnd` 拖拽库
**Reason**: 与 `@dnd-kit` 功能重叠，统一使用 `@dnd-kit`
**Migration**: 将 3 个使用 `@hello-pangea/dnd` 的组件迁移到 `@dnd-kit`
