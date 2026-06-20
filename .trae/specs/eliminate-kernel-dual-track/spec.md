# 消除插件系统双轨架构 Spec

## Why

后端存在严重的双轨架构问题：`app.ts` 直接硬编码 45 条路由注册，同时 Kernel 插件系统又注册了 25 条路由，两者使用相同的 Router 实例，导致 14 条路由完全重复挂载、8 条路由因缺少 `/api` 前缀创建幽灵路由。此外，Kernel 的事件系统（0 消费者）、服务容器（0 调用 `getService`）、扩展点（0 调用 `getExtensions`）均为空壳，而 AppEventBus（40+ 调用点）才是实际在用的事件系统。这种双轨并存造成架构混乱、安全风险和维护负担。

## What Changes

- **移除 `app.ts` 中所有直接路由注册**（第 186-230 行的 45 条 `app.use()`），改为全部通过插件系统注册
- **修复插件路由前缀 BUG**：AIPlugin、StudyPlugin 的路由缺少 `/api` 前缀
- **精简 Kernel**：移除未使用的事件系统（subscribe/publish/unsubscribe/registerEventType）、服务容器（registerService/getService）、扩展点（registerExtension/getExtensions）、配置管理（registerConfigSchema/getPluginConfig），仅保留插件生命周期管理和路由注册
- **移除 Kernel 事件系统相关代码**：`coreEvents.ts`、Kernel 中的 `eventHandlers`/`eventTypeRegistry`、`types.ts` 中相关类型
- **移除 Kernel 服务容器和扩展点相关代码**：`ExtensionPoint.ts`、Kernel 中的 `serviceContainer`/`extensionPoint`/`configSchemas`/`configValues`
- **保留 AppEventBus** 作为唯一事件系统，不做任何改动
- **更新 6 个内置插件**：移除 `registerService`/`registerExtension`/`registerEventType` 调用，仅保留 `registerRoutes`
- **更新 `Plugin` 接口和 `KernelAPI` 接口**：移除事件、服务容器、扩展点、配置管理相关方法
- **移除 `PluginLoader` 和 `PluginStoreService`** 中对已移除 Kernel 功能的依赖

## Impact

- Affected code: `api/app.ts`、`api/server.ts`、`api/services/kernel/` 全部文件、`api/services/plugins/` 全部文件
- Affected specs: 无其他 spec 依赖此变更
- **BREAKING**: `KernelAPI` 接口大幅缩减，任何外部插件（如果有）需要适配新接口

## ADDED Requirements

### Requirement: 单一路由注册通道

系统 SHALL 仅通过 Kernel 插件系统的 `registerRoutes` 注册路由，`app.ts` SHALL NOT 包含任何业务路由的直接 `app.use()` 注册。

#### Scenario: 路由仅通过插件注册
- **WHEN** 服务器启动
- **THEN** 所有业务路由均由 6 个内置插件的 `onInstall` 钩子通过 `kernel.registerRoutes()` 注册
- **AND** `app.ts` 中不存在任何业务路由的 `app.use()` 调用
- **AND** `applyKernelRoutes(app, kernel)` 是唯一的路由挂载入口

### Requirement: 插件路由前缀一致性

所有插件注册的路由前缀 SHALL 以 `/api/` 开头，与现有 API 路径规范一致。

#### Scenario: AI 插件路由前缀正确
- **WHEN** AIPlugin 调用 `kernel.registerRoutes()`
- **THEN** 所有路由前缀以 `/api/` 开头（如 `/api/ai`、`/api/prompts`、`/api/rag`、`/api/search`）

#### Scenario: Study 插件路由前缀正确
- **WHEN** StudyPlugin 调用 `kernel.registerRoutes()`
- **THEN** 所有路由前缀以 `/api/` 开头（如 `/api/study`、`/api/learning-paths`、`/api/quiz-sets`）

### Requirement: Kernel 精简为插件生命周期 + 路由注册器

Kernel SHALL 仅提供以下功能：
1. 插件注册与生命周期管理（registerPlugin、activatePlugin、deactivatePlugin、activateAll、deactivateAll）
2. 路由注册与查询（registerRoutes、getRegisteredRoutes）
3. 依赖解析（DependencyResolver）
4. 插件元信息查询（getPlugin）

Kernel SHALL NOT 提供事件系统、服务容器、扩展点、配置管理功能。

#### Scenario: Kernel 不包含事件系统
- **WHEN** 检查 Kernel 类的公共 API
- **THEN** 不存在 `subscribe`、`publish`、`unsubscribe`、`registerEventType` 方法
- **AND** 不存在 `eventHandlers`、`eventTypeRegistry` 私有字段

#### Scenario: Kernel 不包含服务容器
- **WHEN** 检查 Kernel 类的公共 API
- **THEN** 不存在 `registerService`、`getService` 方法
- **AND** 不存在 `serviceContainer` 私有字段

#### Scenario: Kernel 不包含扩展点
- **WHEN** 检查 Kernel 类的公共 API
- **THEN** 不存在 `registerExtension`、`getExtensions` 方法
- **AND** 不存在 `extensionPoint` 私有字段

### Requirement: AppEventBus 为唯一事件系统

AppEventBus SHALL 保持不变，作为项目唯一的事件发布/订阅系统。Kernel 不再提供并行的事件系统。

#### Scenario: 事件通过 AppEventBus 发布
- **WHEN** 任何服务需要发布或订阅事件
- **THEN** 使用 `appEventBus.publish()` 和 `appEventBus.subscribe()`
- **AND** 不通过 Kernel 的事件 API 操作

## MODIFIED Requirements

### Requirement: Plugin 接口

Plugin 接口 SHALL 仅包含：
- `name`、`version`、`description`（必需）
- `dependencies`（可选）
- `onInstall(kernel: KernelAPI): void`（必需）
- `onActivate?(): Promise<void>`（可选）
- `onDeactivate?(): Promise<void>`（可选）
- `onUninstall?(): void`（可选）

移除的属性：`author`、`icon`、`screenshots`、`homepage`、`repository`、`keywords`、`category`、`permissions`。

### Requirement: KernelAPI 接口

KernelAPI 接口 SHALL 仅包含：
- `registerRoutes(prefix: string, router: Router, options?: RouteOptions): void`
- `getPlugin(name: string): PluginEntry | undefined`

移除的方法：`registerService`、`getService`、`registerExtension`、`getExtensions`、`registerEventType`、`subscribe`、`unsubscribe`、`publish`、`registerConfigSchema`、`getPluginConfig`。

### Requirement: PluginEntry 接口

PluginEntry 接口 SHALL 仅包含：
- `plugin: Plugin`
- `state: PluginState | "error"`
- `errorMessage?: string`
- `registeredRoutes: string[]`

移除的字段：`registeredServices`、`registeredExtensions`、`registeredEventTypes`、`registeredSubscriptions`。

## REMOVED Requirements

### Requirement: Kernel 事件系统
**Reason**: 0 个实际消费者，AppEventBus 已承担全部事件职责
**Migration**: 无需迁移，Kernel 事件系统从未被业务代码使用

### Requirement: Kernel 服务容器
**Reason**: 0 个 `getService` 调用，所有业务代码直接 import 服务实例
**Migration**: 无需迁移，服务容器从未被消费

### Requirement: Kernel 扩展点
**Reason**: 0 个 `getExtensions` 调用，扩展从未被消费
**Migration**: 无需迁移，扩展点从未被消费

### Requirement: Kernel 配置管理
**Reason**: 0 个 `getPluginConfig` 调用，配置从未被消费
**Migration**: 无需迁移，配置管理从未被消费

### Requirement: ExtensionPoint 类
**Reason**: 随扩展点功能一起移除
**Migration**: 无需迁移

### Requirement: coreEvents 事件类型注册
**Reason**: 注册了 26 种事件类型但无人消费，随 Kernel 事件系统一起移除
**Migration**: 无需迁移

### Requirement: PluginManifest 和 manifest 验证
**Reason**: 外部插件加载功能未实际使用，manifest 验证无意义
**Migration**: 无需迁移

### Requirement: Plugin 权限系统
**Reason**: 权限仅声明式存在，无运行时检查
**Migration**: 无需迁移
