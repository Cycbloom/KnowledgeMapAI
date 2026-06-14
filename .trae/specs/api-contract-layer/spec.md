# Web/Mobile API 契约层 Spec

## Why

当前 Web API 层（`src/services/api/`）和 Mobile API 层（`src/services/mobile/`）的每个模块都定义了相同的方法签名，但完全靠人工保持同步。以 `graphsApi` 为例：Web 端有 47 个方法，Mobile 端有 25 个方法，其中 20+ 个方法签名完全一致，但没有编译期约束。新增或修改一个方法时，没有任何机制提醒开发者同步更新另一端的实现。adapter.ts 中大量使用 `any` 和 `createNoopApi` 掩盖了类型不匹配的问题。

引入共享接口契约层后，方法签名变更会在编译期暴露出两端的不一致，从根本上消除"改了 Web 忘了改 Mobile"的风险。

## What Changes

- **新增** `src/services/api/contracts/` 目录，定义所有 API 模块的 TypeScript 接口
- **新增** `src/services/api/contracts/IGraphsApi.ts` — 图谱 API 契约接口
- **新增** `src/services/api/contracts/INodesApi.ts` — 节点 API 契约接口
- **新增** `src/services/api/contracts/IEdgesApi.ts` — 边 API 契约接口
- **新增** `src/services/api/contracts/IAuthApi.ts` — 认证 API 契约接口
- **新增** `src/services/api/contracts/IAiApi.ts` — AI API 契约接口
- **新增** `src/services/api/contracts/IStudyApi.ts` — 学习 API 契约接口
- **新增** `src/services/api/contracts/ISchedulerApi.ts` — 调度 API 契约接口
- **新增** `src/services/api/contracts/IQuizApi.ts` — 测验 API 契约接口
- **新增** `src/services/api/contracts/IAchievementsApi.ts` — 成就 API 契约接口
- **新增** `src/services/api/contracts/IDashboardApi.ts` — 仪表盘 API 契约接口
- **新增** `src/services/api/contracts/IStatisticsApi.ts` — 统计 API 契约接口
- **新增** `src/services/api/contracts/IPeriodicTasksApi.ts` — 周期任务 API 契约接口
- **新增** `src/services/api/contracts/index.ts` — 统一导出
- **修改** `src/services/api/graphs.ts` — `graphsApi` 声明为 `IGraphsApi` 类型
- **修改** `src/services/mobile/graphs.ts` — `mobileGraphsApi` 声明为 `IGraphsApi` 类型
- **修改** 其他所有 Web API 和 Mobile API 模块，添加接口类型声明
- **修改** `src/services/api/adapter.ts` — 移除 `createNoopApi` 和 `any` 类型，使用接口类型约束

## Impact

- Affected specs: 无（纯架构重构，行为不变）
- Affected code:
  - `src/services/api/contracts/`（新增 ~13 个文件）
  - `src/services/api/graphs.ts`, `nodes.ts`, `auth.ts`, `ai.ts`, `study.ts`, `quiz.ts` 等（添加类型声明）
  - `src/services/mobile/graphs.ts`, `nodes.ts`, `auth.ts`, `ai.ts`, `study.ts`, `quiz.ts` 等（添加类型声明 + 补齐缺失方法）
  - `src/services/api/adapter.ts`（重构）
  - `src/services/api/index.ts`（导出契约接口类型）
  - `src/services/mobile/index.ts`（导出契约接口类型）

## ADDED Requirements

### Requirement: API 契约接口定义

系统 SHALL 为每个 API 模块提供共享的 TypeScript 接口，定义该模块所有方法的签名（参数类型和返回类型）。

#### Scenario: 图谱 API 契约
- **WHEN** 开发者查看 `IGraphsApi` 接口
- **THEN** 接口包含 `list`、`get`、`create`、`update`、`delete`、`restore`、`permanentDelete`、`toggleFavorite`、`togglePublic`、`batchDelete`、`batchRestore`、`getTags`、`getDomains`、`getNodes`、`getMap` 等所有图谱相关方法的完整签名

#### Scenario: 节点 API 契约
- **WHEN** 开发者查看 `INodesApi` 接口
- **THEN** 接口包含 `create`、`get`、`update`、`delete`、`batchDelete`、`batchUpdatePositions`、`getRelated`、`searchSimilar`、`getKnowledgePointGraphs` 等方法签名

#### Scenario: 方法签名覆盖完整
- **WHEN** 某个方法在 Web 端存在但 Mobile 端不支持
- **THEN** 接口中仍定义该方法，Mobile 端实现抛出 `NotSupportedError` 或返回合理的空值，而非静默返回 `{}`

### Requirement: 双端实现类型约束

系统 SHALL 要求 Web API 和 Mobile API 的每个模块对象显式声明实现对应的契约接口，使 TypeScript 编译器在方法签名不匹配时报错。

#### Scenario: 方法签名不一致时编译报错
- **WHEN** 开发者在 `graphsApi` 中新增一个方法 `batchUpdateTags(ids: string[], tags: string[])`，但未在 `mobileGraphsApi` 中添加对应方法
- **THEN** TypeScript 编译报错：`mobileGraphsApi` 不满足 `IGraphsApi` 接口

#### Scenario: 参数类型不一致时编译报错
- **WHEN** 开发者在 Web 端将 `delete(id: string)` 改为 `delete(id: string, options: DeleteOptions)`，但 Mobile 端未同步修改
- **THEN** TypeScript 编译报错，提示参数类型不匹配

#### Scenario: 返回类型不一致时编译报错
- **WHEN** 开发者修改 Web 端 `list()` 返回 `Promise<Graph[]>` 为 `Promise<PaginatedResult<Graph>>`，但 Mobile 端返回类型未同步
- **THEN** TypeScript 编译报错，提示返回类型不匹配

### Requirement: Adapter 层类型安全重构

系统 SHALL 重构 `adapter.ts`，移除 `createNoopApi` 和 `any` 类型，使用契约接口实现类型安全的 Web/Mobile 切换。

#### Scenario: 适配器使用接口类型
- **WHEN** 适配器返回 API 对象
- **THEN** 返回类型为具体的契约接口类型（如 `IApi`），而非 `any` 或 `Record<string, unknown>`

#### Scenario: 移除 createNoopApi
- **WHEN** 适配器选择 Mobile 实现
- **THEN** 直接返回 Mobile API 对象，不再使用 `createNoopApi` 包装，Mobile 端不支持的方法由 Mobile 实现自行处理（抛出 `NotSupportedError` 或返回空值）

## MODIFIED Requirements

无。此为纯架构重构，所有现有 API 行为保持不变。

## REMOVED Requirements

### Requirement: createNoopApi 函数
**Reason**: 该函数使用 `any` 类型和 `Proxy` 动态创建空实现，掩盖了 Mobile 端缺失方法的真实情况，且破坏了类型安全。
**Migration**: Mobile 端未实现的方法在接口中保留，但 Mobile 实现中显式抛出 `NotSupportedError` 或返回合理的空值，调用方可通过 try-catch 或类型守卫判断。