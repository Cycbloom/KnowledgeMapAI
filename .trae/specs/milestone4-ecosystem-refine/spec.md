# Milestone 4 生态完善 Spec

## Why
前后端错误体系割裂（同名AppError但签名完全不同）、AI Provider新增需改5-7个文件、路由双轨制（22条路由重复注册+导航项完全未从Kernel消费）、缓存策略保守（MAX_CACHE_KEYS=1000且有冗余失效），导致开发效率和系统可维护性受限。

## What Changes
- **OPT-14 错误体系统一**：抽取共享错误基类到 `shared/types/`，前后端仅扩展各自特有部分，统一404响应格式
- **OPT-13 Provider注册表**：引入 `providerRegistry.register()` 模式，解耦 BaseAIProvider 对 OpenAI SDK 的强绑定，消除 config.ts 中的 `any`，统一前端 AIProviderType 引用
- **OPT-12 路由统一**：移除 App.tsx 中全部硬编码路由，由 Kernel `useKernelRoutes()` 完全驱动；Layout 侧边栏和 MobileBottomNav 从 Kernel 动态获取导航项
- **OPT-15 缓存优化**：提升 MAX_CACHE_KEYS，合并冗余失效调用，抽象 CacheInterface 消除 instanceof 依赖

## Impact
- Affected specs: 错误处理模块、AI Provider 模块、前端路由和导航、后端缓存服务
- Affected code:
  - `api/middleware/errorHandler.ts` + `src/utils/errors.ts` → 共享基类重构
  - `shared/types/ai.ts` + `api/services/ai/providers/base.ts` + `api/services/ai/factory.ts` + `api/services/ai/config.ts` → Provider注册表
  - `src/App.tsx` + `src/services/kernel/plugins.ts` + `src/components/Layout/Layout.tsx` + `src/components/Layout/MobileBottomNav.tsx` → 路由统一
  - `api/services/common/cacheStore.ts` + `api/services/common/cacheService.ts` → 缓存优化

## ADDED Requirements

### Requirement: 共享错误基类
系统 SHALL 在 `shared/types/` 中提供共享的 `AppErrorBase` 基类，前后端 `AppError` 继承该基类，确保 `toJSON()` 输出格式一致。

#### Scenario: 前端反序列化后端错误
- **WHEN** 后端返回 `{ code: "RESOURCE_NOT_FOUND", message: "...", statusCode: 404 }`
- **THEN** 前端 `createErrorFromResponse` 能正确映射 `code` 字段到对应子类

#### Scenario: 404响应格式一致
- **WHEN** 请求不存在的API端点
- **THEN** 响应体包含 `code`、`message`、`requestId`、`timestamp` 字段，与标准 errorHandler 格式一致

### Requirement: Provider注册表模式
系统 SHALL 提供动态 Provider 注册机制，新增 Provider 仅需创建 Provider 类文件 + 一处注册调用。

#### Scenario: 新增Provider改1文件
- **WHEN** 开发者新增一个名为 "example" 的 AI Provider
- **THEN** 仅需创建 `providers/example.ts` + 在一处调用 `providerRegistry.register('example', ExampleProvider, defaultConfig)`

### Requirement: BaseAIProvider解耦OpenAI SDK
系统 SHALL 将 `BaseAIProvider.client` 改为通用接口类型，非 OpenAI 兼容的 Provider 不再需要伪造 OpenAI client。

### Requirement: 消除config.ts中any类型
系统 SHALL 将 `Record<string, any>` 替换为具体配置类型。

### Requirement: 路由完全由Kernel驱动
系统 SHALL 移除 App.tsx 中全部24个硬编码 lazy import 和26个硬编码 Route 组件，改由 `useKernelRoutes()` 完全驱动路由渲染。

#### Scenario: 新增页面改1处
- **WHEN** 开发者新增一个页面
- **THEN** 仅需在 `plugins.ts` 对应插件的 `onInstall()` 中添加 `registerRoute()` + `registerNavItem()`

### Requirement: 导航项从Kernel动态获取
系统 SHALL 让 Layout 侧边栏和 MobileBottomNav 从 `frontendKernel.getNavItems()` 动态渲染导航项，替换硬编码的 SidebarLink 和 navItems 数组。

### Requirement: 缓存容量提升
系统 SHALL 将 MAX_CACHE_KEYS 从 1000 提升至 5000。

### Requirement: 消除冗余缓存失效
系统 SHALL 合并 `invalidateAllGraphRelated` 中的冗余失效调用，确保每个缓存 key 只被删除一次。

### Requirement: CacheInterface抽象
系统 SHALL 将命中率统计、标签删除等功能抽象到 `CacheInterface` 中，不再依赖 `instanceof` 检查判断后端类型。

## MODIFIED Requirements

### Requirement: AIProvider接口通用化
从 `client: OpenAI` 改为 `client: AIProviderClient`（通用接口），现有 Provider 通过适配器模式兼容。

### Requirement: RouteRegistration增加layout字段
在 Kernel 的 `RouteRegistration` 类型中增加 `layout` 字段（`"protected" | "public"`），区分 Layout 内外路由，使 `useKernelRoutes()` 能正确分组渲染。

## REMOVED Requirements

### Requirement: OPT-10 测试覆盖率提升
**Reason**: 用户明确要求"测试覆盖率暂时不做"，将在后续 Milestone 中处理
**Migration**: 无需迁移

## 3轮迭代计划

### Round 1（错误体系 + Provider注册表 — 基础设施层）
| 优化项 | 文件 | 当前进度 | 目标 |
|--------|------|----------|------|
| OPT-14 | `api/middleware/errorHandler.ts` + `src/utils/errors.ts` | 两个不同AppError | 共享基类 + 统一404 |
| OPT-13 | `api/services/ai/providers/` + `factory.ts` + `config.ts` | switch-case硬编码 | Registry模式 + 解耦OpenAI |

### Round 2（路由统一 — 前端架构层）
| 优化项 | 文件 | 当前进度 | 目标 |
|--------|------|----------|------|
| OPT-12 | `src/App.tsx` | 24硬编码lazy+26硬编码Route | Kernel完全驱动 |
| OPT-12 | `src/components/Layout/Layout.tsx` | 12硬编码SidebarLink | Kernel NavItem动态渲染 |
| OPT-12 | `src/components/Layout/MobileBottomNav.tsx` | 硬编码navItems数组 | Kernel NavItem动态渲染 |

### Round 3（缓存优化 + 全局验证 — 收尾层）
| 优化项 | 文件 | 当前进度 | 目标 |
|--------|------|----------|------|
| OPT-15 | `api/services/common/cacheStore.ts` | MAX_CACHE_KEYS=1000 | 提升至5000 |
| OPT-15 | `api/services/common/cacheService.ts` | 冗余失效+5处instanceof | 合并失效+CacheInterface抽象 |
| 全局验证 | check:full + lint:full | -- | 零错误 |
