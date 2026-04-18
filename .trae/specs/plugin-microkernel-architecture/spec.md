# 插件化微内核架构 Spec

## Why

KnowledgeMap 当前是典型的模块化单体架构，服务按业务域组织良好，但所有组装都是命令式硬编码：30+ 后端路由、20+ 前端页面、27 个 API 模块全部静态导入。项目已具备 3 个类插件机制（TaskProcessor 注册表、Agent ToolRegistry、前端 CommandRegistry）和 1 个成熟的事件总线，但缺乏统一的插件框架。引入微内核架构可以将核心与业务功能解耦，使现有功能可插拔、第三方可扩展，最终形成类似 VS Code 的插件生态。

## What Changes

- **创建 Kernel 内核**：提供服务容器、插件注册表、生命周期管理、扩展点注册
- **定义 Plugin 接口**：标准化的插件元数据、生命周期钩子、依赖声明
- **创建后端路由注册表**：替代 app.ts 中 30+ 硬编码路由，支持插件自注册路由
- **创建前端路由注册表**：替代 App.tsx 中 20+ 硬编码页面，支持插件注册页面和导航项
- **创建 API 模块注册表**：替代 api/index.ts 中硬编码的 27 个 API 模块
- **统一扩展点**：将 TaskProcessor、ToolRegistry、CommandRegistry、AI Provider Factory 纳入 Kernel 管理
- **包装现有模块为插件**：将 core/graph/ai/scheduler/study/agent 逐步包装为独立插件
- **事件类型动态扩展**：从编译时联合类型改为运行时注册 + Zod Schema 验证

## Impact

- Affected specs: 后端服务初始化流程、前端路由加载机制、API 模块组织方式
- Affected code:
  - `api/app.ts` — 路由注册方式
  - `api/server.ts` — 服务初始化流程
  - `api/services/index.ts` — 服务导出方式
  - `api/services/core/eventBus.ts` — 事件类型系统
  - `api/services/taskProcessors/index.ts` — 合并到 Kernel
  - `api/services/agent/ToolRegistry.ts` — 合并到 Kernel
  - `src/App.tsx` — 路由注册方式
  - `src/services/api/index.ts` — API 模块组织
  - `src/components/Layout/Layout.tsx` — 导航项注册
  - `src/services/console/CommandRegistry.ts` — 合并到 Kernel
  - `shared/types/events.ts` — 事件类型动态化

## ADDED Requirements

### Requirement: Kernel 内核服务

系统 SHALL 提供一个 Kernel 类作为微内核的核心，管理所有插件的生命周期和服务注册。

#### Scenario: Kernel 初始化
- **WHEN** 应用启动
- **THEN** Kernel 实例被创建并初始化
- **AND** 内核服务（事件总线、服务容器、插件注册表）可用
- **AND** 内核按依赖顺序加载和激活已注册的插件

#### Scenario: 服务容器
- **WHEN** 插件需要获取其他插件提供的服务
- **THEN** 通过 `kernel.getService<T>(serviceName)` 获取
- **AND** 服务在注册时指定接口类型
- **AND** 未注册的服务返回 undefined 而非抛出异常

#### Scenario: 插件生命周期管理
- **WHEN** 插件被注册到 Kernel
- **THEN** Kernel 按以下顺序调用生命周期钩子：`onInstall` → `onActivate`
- **WHEN** 插件被卸载
- **THEN** Kernel 按以下顺序调用：`onDeactivate` → `onUninstall`
- **AND** 依赖该插件的其他插件先被停用

### Requirement: Plugin 接口定义

系统 SHALL 定义标准化的 Plugin 接口，所有业务模块必须实现此接口才能作为插件运行。

#### Scenario: 插件元数据
- **WHEN** 一个插件被注册
- **THEN** 必须提供以下元数据：
  - `name`: 唯一标识符（如 "graph"、"ai"、"scheduler"）
  - `version`: 语义化版本号
  - `description`: 功能描述
  - `dependencies`: 依赖的其他插件名称列表（可选）

#### Scenario: 插件生命周期钩子
- **WHEN** 插件实现 Plugin 接口
- **THEN** 必须实现 `onInstall(kernel)` 方法，用于注册服务、路由、事件处理器
- **AND** 可选实现 `onActivate()` 方法，用于启动服务
- **AND** 可选实现 `onDeactivate()` 方法，用于停用服务
- **AND** 可选实现 `onUninstall()` 方法，用于清理资源

#### Scenario: 插件依赖解析
- **WHEN** 插件 A 声明依赖插件 B
- **THEN** Kernel 在激活 A 之前先激活 B
- **AND** 如果 B 未注册，Kernel 报错并拒绝激活 A
- **AND** 卸载 B 时，Kernel 先自动停用所有依赖 B 的插件

### Requirement: 后端路由注册表

系统 SHALL 提供路由注册表，替代 app.ts 中的硬编码路由挂载。

#### Scenario: 插件注册路由
- **WHEN** 插件在 `onInstall` 中调用 `kernel.registerRoutes(prefix, router, options)`
- **THEN** 路由被注册到 Express app 的指定前缀下
- **AND** 可指定中间件（如 `requireAuth`、`rateLimiter`）

#### Scenario: 路由注册顺序
- **WHEN** 多个插件注册路由
- **THEN** 路由按插件激活顺序注册
- **AND** 内核路由（如 `/api/health`、`/api/plugins`）优先于插件路由

#### Scenario: 路由冲突检测
- **WHEN** 两个插件注册相同前缀的路由
- **THEN** Kernel 发出警告日志
- **AND** 后注册的路由覆盖先注册的（Express 默认行为）

### Requirement: 前端路由注册表

系统 SHALL 提供前端路由注册表，替代 App.tsx 中的硬编码路由。

#### Scenario: 插件注册页面
- **WHEN** 插件调用 `kernel.registerRoute({ path, component, ... })`
- **THEN** 路由被动态添加到 React Router 中
- **AND** 组件使用 `React.lazy()` 实现按需加载

#### Scenario: 插件注册导航项
- **WHEN** 插件调用 `kernel.registerNavItem({ path, icon, label, order })`
- **THEN** 导航项出现在侧边栏中
- **AND** 按 `order` 字段排序
- **AND** 支持权限控制（如需要登录才显示）

#### Scenario: 导航项分组
- **WHEN** 多个插件注册导航项
- **THEN** 内核导航项（Dashboard、Settings）始终在最前和最后
- **AND** 插件导航项按注册顺序排列

### Requirement: API 模块注册表

系统 SHALL 提供 API 模块注册表，替代 api/index.ts 中的硬编码 API 对象。

#### Scenario: 插件注册 API 模块
- **WHEN** 插件调用 `kernel.registerApiModule(name, apiModule)`
- **THEN** API 模块可通过 `kernel.getApiModule(name)` 获取
- **AND** 前端通过 `api[name]` 访问时自动代理到注册的模块

#### Scenario: API 模块类型安全
- **WHEN** 插件注册 API 模块
- **THEN** 模块接口类型通过泛型参数约束
- **AND** 未注册的模块访问时返回 undefined

### Requirement: 统一扩展点管理

系统 SHALL 将现有的 TaskProcessor、ToolRegistry、CommandRegistry、AI Provider Factory 统一纳入 Kernel 管理。

#### Scenario: 扩展点注册
- **WHEN** 内核初始化
- **THEN** 以下扩展点被自动注册：
  - `taskProcessor` — 任务处理器扩展点
  - `agentTool` — Agent 工具扩展点
  - `consoleCommand` — 控制台命令扩展点
  - `aiProvider` — AI 提供商扩展点
  - `middleware` — 中间件扩展点
  - `subscriber` — 事件订阅者扩展点

#### Scenario: 第三方插件注册扩展
- **WHEN** 第三方插件需要添加新的 Agent 工具
- **THEN** 通过 `kernel.registerExtension('agentTool', toolDefinition)` 注册
- **AND** 工具自动出现在 Agent 的可用工具列表中
- **AND** 插件停用时工具自动移除

#### Scenario: 扩展点隔离
- **WHEN** 插件注册扩展
- **THEN** 扩展与插件绑定，插件停用时所有注册的扩展自动清理
- **AND** 扩展的执行在插件上下文中进行，可追踪来源

### Requirement: 事件类型动态扩展

系统 SHALL 支持事件类型的运行时注册，替代编译时联合类型。

#### Scenario: 插件注册自定义事件
- **WHEN** 插件调用 `kernel.registerEventType('plugin:custom_event', { payloadSchema: z.object({...}) })`
- **THEN** 事件类型可被发布和订阅
- **AND** 发布时 payload 通过 Zod Schema 验证
- **AND** 插件停用时自动取消该事件类型的所有订阅

#### Scenario: 内核事件保持兼容
- **WHEN** 迁移到动态事件系统
- **THEN** 现有的 23 种内核事件（shared/types/events.ts）自动注册
- **AND** 现有的事件发布/订阅代码无需修改
- **AND** 编译时类型提示通过类型映射保留

### Requirement: 现有模块插件化包装

系统 SHALL 将现有业务模块逐步包装为独立插件，保持功能不变。

#### Scenario: Core 插件
- **WHEN** Core 插件被激活
- **THEN** 以下服务可用：authService、settingsService、healthService、sseService、eventBus
- **AND** 以下路由注册：`/api/auth`、`/api/health`
- **AND** 以下事件订阅者注册：cacheInvalidation、sseNotification

#### Scenario: Graph 插件
- **WHEN** Graph 插件被激活
- **THEN** 以下服务可用：graphService、nodeService、edgeService、knowledgePointService、autoGraphService 等
- **AND** 以下路由注册：`/api/graphs`、`/api/nodes`、`/api/knowledge-points` 等
- **AND** 以下前端页面注册：GraphEditor、GraphMap、CombinedViewPage
- **AND** 以下前端导航项注册：知识图谱、知识地图

#### Scenario: AI 插件
- **WHEN** AI 插件被激活
- **THEN** 以下服务可用：aiService、promptService、embeddingService、ragService、searchService 等
- **AND** 以下路由注册：`/api/ai`、`/api/rag`、`/api/search` 等
- **AND** 依赖 Core 插件

#### Scenario: Study 插件
- **WHEN** Study 插件被激活
- **THEN** 以下服务可用：studyService、learningPathService、reviewService、studyProgressService
- **AND** 以下路由注册：`/api/study`、`/api/learning-paths` 等
- **AND** 以下前端页面注册：Study、LearningMode、QuizPractice
- **AND** 依赖 Graph 插件和 AI 插件

#### Scenario: Scheduler 插件
- **WHEN** Scheduler 插件被激活
- **THEN** 以下服务可用：taskService、focusService、achievementService、sm2Service 等
- **AND** 以下路由注册：`/api/scheduler`、`/api/tasks`、`/api/focus` 等
- **AND** 以下前端页面注册：Scheduler、Tasks、CalendarPage
- **AND** 依赖 Core 插件

#### Scenario: Agent 插件
- **WHEN** Agent 插件被激活
- **THEN** 以下服务可用：agentService、toolRegistry、sessionManager
- **AND** 以下路由注册：`/api/agent`
- **AND** 以下扩展点注册：agentTool（16 个工具）
- **AND** 依赖 Graph 插件和 AI 插件

### Requirement: 插件管理 API

系统 SHALL 提供插件管理 API，支持查询、启用、停用插件。

#### Scenario: 查询已安装插件
- **WHEN** GET `/api/plugins`
- **THEN** 返回所有已注册插件的列表，包含名称、版本、描述、状态（active/inactive）、依赖

#### Scenario: 启用插件
- **WHEN** POST `/api/plugins/:name/activate`
- **THEN** 插件被激活，其路由、服务、事件订阅者生效
- **AND** 依赖该插件的其他插件可被激活

#### Scenario: 停用插件
- **WHEN** POST `/api/plugins/:name/deactivate`
- **THEN** 插件被停用，其路由、服务、事件订阅者失效
- **AND** 依赖该插件的其他插件先被自动停用

#### Scenario: 插件状态持久化
- **WHEN** 用户停用某个插件
- **THEN** 停用状态被持久化到数据库
- **AND** 下次启动时该插件保持停用状态

### Requirement: 插件配置系统

系统 SHALL 支持插件级别的配置管理。

#### Scenario: 插件声明配置 Schema
- **WHEN** 插件在 `onInstall` 中调用 `kernel.registerConfigSchema(name, zodSchema)`
- **THEN** 插件的配置项被注册到内核配置系统
- **AND** 配置值可通过 `kernel.getPluginConfig(name)` 获取

#### Scenario: 插件配置 API
- **WHEN** GET `/api/plugins/:name/config`
- **THEN** 返回该插件的当前配置
- **WHEN** PATCH `/api/plugins/:name/config`
- **THEN** 更新该插件的配置，值通过 Zod Schema 验证

## MODIFIED Requirements

### Requirement: 后端服务初始化流程

原有行为：server.ts 中命令式硬编码初始化所有服务、路由、订阅者

修改后行为：
1. Kernel 实例化并注册所有内置插件
2. Kernel 按依赖顺序激活插件
3. 每个插件在 `onInstall` 中自注册路由、服务、事件处理器
4. server.ts 仅负责创建 Kernel 和启动 HTTP 服务器

### Requirement: 前端路由加载

原有行为：App.tsx 中 20+ 页面通过 `React.lazy()` 硬编码导入

修改后行为：
1. Kernel 前端实例注册所有内置插件
2. 每个插件在 `onInstall` 中注册页面路由和导航项
3. App.tsx 从 Kernel 路由注册表动态生成路由

### Requirement: 事件类型系统

原有行为：23 种事件类型通过 TypeScript 联合类型定义在 `shared/types/events.ts`

修改后行为：
1. 23 种内核事件在 Kernel 初始化时自动注册
2. 插件可通过 `registerEventType` 注册自定义事件
3. 保留编译时类型提示（通过类型映射从注册表生成）

## REMOVED Requirements

### Requirement: AI Provider 工厂硬编码
**Reason**: 工厂模式中的 switch-case 硬编码限制了新 Provider 的扩展，改为注册式后 AI 插件可动态注册新 Provider
**Migration**: 将 switch-case 改为 `kernel.registerExtension('aiProvider', providerClass)`，现有 3 个 Provider 在 AI 插件中注册
