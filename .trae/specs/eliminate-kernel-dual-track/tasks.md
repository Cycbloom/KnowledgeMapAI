# Tasks

- [x] Task 1: 精简 Kernel 核心类
  - [x] SubTask 1.1: 从 Kernel.ts 中移除事件系统相关代码（eventHandlers、eventTypeRegistry、subscribe、publish、unsubscribe、registerEventType 方法及所有私有字段）
  - [x] SubTask 1.2: 从 Kernel.ts 中移除服务容器相关代码（serviceContainer、registerService、getService 方法）
  - [x] SubTask 1.3: 从 Kernel.ts 中移除扩展点相关代码（extensionPoint、registerExtension、getExtensions 方法）
  - [x] SubTask 1.4: 从 Kernel.ts 中移除配置管理相关代码（configSchemas、configValues、registerConfigSchema、getPluginConfig 方法）
  - [x] SubTask 1.5: 从 Kernel.ts 中移除 currentPluginName 和 runInPluginContext（仅服务于服务容器/扩展点的事件追踪）
  - [x] SubTask 1.6: 保留插件生命周期管理（registerPlugin、activatePlugin、deactivatePlugin、activateAll、deactivateAll）和路由注册（registerRoutes、getRegisteredRoutes）

- [x] Task 2: 精简 Kernel 类型定义
  - [x] SubTask 2.1: 更新 types.ts 中的 KernelAPI 接口，仅保留 registerRoutes 和 getPlugin
  - [x] SubTask 2.2: 更新 types.ts 中的 Plugin 接口，移除 author、icon、screenshots、homepage、repository、keywords、category、permissions
  - [x] SubTask 2.3: 更新 types.ts 中的 PluginEntry 接口，移除 registeredServices、registeredExtensions、registeredEventTypes、registeredSubscriptions
  - [x] SubTask 2.4: 移除 types.ts 中的 AppEvent、AppEventHandler、EventTypeEntry 类型（这些与 Kernel 事件系统绑定）
  - [x] SubTask 2.5: 移除 types.ts 中的 PluginManifest、PluginAuthor 类型

- [x] Task 3: 删除 Kernel 附属文件
  - [x] SubTask 3.1: 删除 ExtensionPoint.ts
  - [x] SubTask 3.2: 删除 coreEvents.ts
  - [x] SubTask 3.3: 删除 manifest.ts
  - [x] SubTask 3.4: 删除 permissions.ts
  - [x] SubTask 3.5: 更新 kernel/index.ts 导出，移除已删除文件的引用

- [x] Task 4: 修复插件路由前缀 BUG
  - [x] SubTask 4.1: 修复 AIPlugin.ts 中 5 条路由前缀（`/ai` → `/api/ai`、`/ai/actions` → `/api/ai-actions`、`/prompts` → `/api/prompts`、`/rag` → `/api/rag`、`/search` → `/api/search`）
  - [x] SubTask 4.2: 修复 StudyPlugin.ts 中 3 条路由前缀（`/study` → `/api/study`、`/learning-paths` → `/api/learning-paths`、`/quiz-sets` → `/api/quiz-sets`）
  - [x] SubTask 4.3: 修复 GraphPlugin.ts 中不一致的前缀（`/api/nodes` → `/api`、`/api/graph-relations` → `/api/graphs`、`/api/collaborators` → `/api/collaborations`）

- [x] Task 5: 精简 6 个内置插件
  - [x] SubTask 5.1: CorePlugin - 移除 registerService/registerExtension/registerEventType 调用，仅保留 registerRoutes
  - [x] SubTask 5.2: GraphPlugin - 移除 registerService/registerExtension 调用，仅保留 registerRoutes
  - [x] SubTask 5.3: AIPlugin - 移除 registerService/registerExtension/registerEventType 调用，仅保留 registerRoutes
  - [x] SubTask 5.4: StudyPlugin - 移除 registerService/registerExtension 调用，仅保留 registerRoutes
  - [x] SubTask 5.5: SchedulerPlugin - 移除 registerService 调用，仅保留 registerRoutes
  - [x] SubTask 5.6: AgentPlugin - 移除 registerService/registerExtension 调用，仅保留 registerRoutes

- [x] Task 6: 迁移 app.ts 路由注册到插件系统
  - [x] SubTask 6.1: 将 app.ts 中 45 条直接路由注册拆分到对应的 6 个插件中（确保每个路由有且仅有一个插件注册）
  - [x] SubTask 6.2: 为尚未被任何插件覆盖的路由（如 data、dashboard、backup、sync、literature、conceptAggregation、region、story 等）分配到合适的插件
  - [x] SubTask 6.3: 从 app.ts 中移除所有业务路由的 `app.use()` 调用和对应的 import 语句
  - [x] SubTask 6.4: 确保 applyKernelRoutes 中的限流器映射覆盖所有需要的限流策略
  - [x] SubTask 6.5: 保留 app.ts 中的中间件配置、applyKernelRoutes 调用、启动任务（autoBackup、graphTaskEventHandler）

- [x] Task 7: 清理 PluginLoader 和 PluginStoreService
  - [x] SubTask 7.1: 更新 PluginLoader.ts，移除对已删除 Kernel 功能的依赖
  - [x] SubTask 7.2: 更新 PluginStoreService.ts，移除对已删除 Kernel 功能的依赖

- [x] Task 8: 验证与测试
  - [x] SubTask 8.1: 运行 `npm run check` 确保类型检查通过
  - [x] SubTask 8.2: 运行 `npm run lint` 确保代码规范通过
  - [x] SubTask 8.3: 系统性验证 14 项检查全部通过
  - [x] SubTask 8.4: 幽灵路由（/ai、/search、/rag、/prompts、/study、/learning-paths、/quiz-sets）已消除

# Task Dependencies
- [Task 2] depends on [Task 1] (类型定义需与 Kernel 实现同步)
- [Task 3] depends on [Task 1] (删除文件前需确认 Kernel 不再引用)
- [Task 4] depends on nothing (可并行)
- [Task 5] depends on [Task 1, Task 2] (插件需适配新的 KernelAPI)
- [Task 6] depends on [Task 4, Task 5] (路由迁移需先修复前缀和精简插件)
- [Task 7] depends on [Task 1, Task 2] (需适配精简后的 Kernel)
- [Task 8] depends on [Task 6, Task 7] (所有修改完成后验证)
