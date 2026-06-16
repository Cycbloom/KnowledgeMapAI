# IApi 接口类型安全补全 Spec

## Why

`IApi.ts` 中仍有 26 个模块使用 `GenericApiModule`（即 `Record<string, any>`），违反项目禁止 `any` 的规范。这导致：1）调用方无法获得 IDE 自动补全和类型检查；2）方法签名变更无法在编译期发现不一致；3）重构时无法安全地追踪影响范围。此前 `api-contract-layer` spec 已为 12 个核心模块建立了契约接口，本 spec 将补全剩余 26 个模块。

## What Changes

- **新增** `src/services/api/contracts/IKnowledgePointsApi.ts` — 知识点 API 契约接口（含 graphNodes、combinedView 子模块）
- **新增** `src/services/api/contracts/ITtsApi.ts` — TTS API 契约接口
- **新增** `src/services/api/contracts/ITasksApi.ts` — 后台任务 API 契约接口（含 search、data 子模块）
- **新增** `src/services/api/contracts/ITemplatesApi.ts` — 模板 API 契约接口（含 prompts、focus 子模块）
- **新增** `src/services/api/contracts/ILearningPathsApi.ts` — 学习路径 API 契约接口（含 learningPath 子模块）
- **新增** `src/services/api/contracts/IRagApi.ts` — RAG API 契约接口
- **新增** `src/services/api/contracts/IAutoGraphApi.ts` — 自动图谱 API 契约接口
- **新增** `src/services/api/contracts/IHealthApi.ts` — 健康检查 API 契约接口
- **新增** `src/services/api/contracts/IBackupApi.ts` — 备份 API 契约接口
- **新增** `src/services/api/contracts/IAgentApi.ts` — Agent API 契约接口
- **新增** `src/services/api/contracts/IPerformanceApi.ts` — 性能监控 API 契约接口
- **新增** `src/services/api/contracts/IDomainsApi.ts` — 领域 API 契约接口（含 graphDomains 子模块）
- **新增** `src/services/api/contracts/IPluginsApi.ts` — 插件 API 契约接口
- **新增** `src/services/api/contracts/ILiteratureApi.ts` — 文献 API 契约接口
- **新增** `src/services/api/contracts/IRegionsApi.ts` — 区域 API 契约接口
- **新增** `src/services/api/contracts/IStoryCreationApi.ts` — 故事创作 API 契约接口（含 structures、characters、scenes、appearances、relationships 子模块）
- **新增** `src/services/api/contracts/IConceptAggregationApi.ts` — 概念聚合 API 契约接口
- **新增** `src/services/api/contracts/IGraphVersionsApi.ts` — 图谱版本 API 契约接口
- **修改** `src/services/api/contracts/IApi.ts` — 将所有 `GenericApiModule` 替换为具体接口类型，移除 `GenericApiModule` 定义
- **修改** `src/services/api/contracts/index.ts` — 导出所有新增接口
- **修改** `src/services/mobile/index.ts` — 将 `createNotSupportedModule` 替换为类型安全的 `createNotSupportedModule<T>()` 泛型函数，使 Mobile 端占位模块满足契约接口

## Impact

- Affected specs: `api-contract-layer`（本 spec 是其延续）
- Affected code:
  - `src/services/api/contracts/`（新增 ~18 个接口文件）
  - `src/services/api/contracts/IApi.ts`（移除 GenericApiModule，替换为具体接口）
  - `src/services/api/contracts/index.ts`（新增导出）
  - `src/services/mobile/index.ts`（类型安全的占位模块）

## ADDED Requirements

### Requirement: 剩余 26 个 API 模块的契约接口定义

系统 SHALL 为 IApi 中所有使用 `GenericApiModule` 的模块提供具体的 TypeScript 接口，定义该模块所有方法的签名（参数类型和返回类型）。

#### Scenario: 知识点 API 契约
- **WHEN** 开发者查看 `IKnowledgePointsApi` 接口
- **THEN** 接口包含 `list`、`get`、`getWithGraphs`、`create`、`update`、`searchSimilar`、`searchSimilarByEmbedding`、`softDeleteFromGraph`、`hardDelete`、`getGraphs`、`getVersions`、`getVersion`、`compareVersions`、`rollbackVersion`、`createVersion` 等方法的完整签名

#### Scenario: 图谱节点 API 契约
- **WHEN** 开发者查看 `IGraphNodesApi` 接口
- **THEN** 接口包含 `create`、`get`、`update`、`delete`、`batchUpdatePositions`、`listByGraph`、`addExistingKnowledgePoint` 等方法签名

#### Scenario: Agent API 契约
- **WHEN** 开发者查看 `IAgentApi` 接口
- **THEN** 接口包含 `createSession`、`getSession`、`executeSession`、`getSkills`、`applyRecommendations`、`mergeGraphs`、`linkGraphs`、`dismissMergeSuggestion`、`getTools`、`executeAutonomous` 等方法签名

#### Scenario: 故事创作 API 契约（嵌套子模块）
- **WHEN** 开发者查看 `IStoryCreationApi` 接口
- **THEN** 接口包含 `structures`、`characters`、`scenes`、`appearances`、`relationships` 五个子模块接口，每个子模块包含各自的 CRUD 方法签名

### Requirement: IApi 聚合接口完全类型安全

系统 SHALL 确保 `IApi` 接口中不再存在 `GenericApiModule` 或 `any` 类型，所有模块属性均为具体的契约接口类型。

#### Scenario: IApi 无 any 类型
- **WHEN** 开发者查看 `IApi` 接口定义
- **THEN** 所有 37 个模块属性均为具体接口类型，不存在 `GenericApiModule` 或 `Record<string, any>`

### Requirement: Mobile 端占位模块类型安全

系统 SHALL 使用泛型版本的 `createNotSupportedModule<T>()` 替代当前的 `createNotSupportedModule()`，使 Mobile 端占位模块满足契约接口的类型约束。

#### Scenario: Mobile 占位模块满足接口类型
- **WHEN** `mobileApi` 对象声明为 `IApi` 类型
- **THEN** TypeScript 编译通过，所有 `createNotSupportedModule<IXxxApi>()` 调用返回的对象满足对应接口类型

#### Scenario: Mobile 占位模块运行时行为不变
- **WHEN** 在 Mobile 端调用未实现的模块方法
- **THEN** 仍然抛出 `NotSupportedError`，行为与当前一致

## MODIFIED Requirements

无。所有现有 API 行为保持不变。

## REMOVED Requirements

### Requirement: GenericApiModule 类型别名
**Reason**: 该类型是 `Record<string, any>` 的别名，违反项目禁止 `any` 的规范，掩盖了模块方法签名缺失的真实情况。
**Migration**: 所有使用 `GenericApiModule` 的模块属性替换为具体的契约接口类型。
