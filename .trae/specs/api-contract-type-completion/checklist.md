# Checklist

## 契约接口完整性

- [x] `IKnowledgePointsApi` 接口包含 knowledgePoints 模块的所有 15 个方法签名
- [x] `IGraphNodesApi` 接口包含 graphNodes 模块的所有 7 个方法签名
- [x] `ICombinedViewApi` 接口包含 combinedView 模块的 1 个方法签名
- [x] `ITasksApi` 接口包含 tasks 模块的 4 个方法签名
- [x] `ISearchApi` 接口包含 search 模块的 1 个方法签名
- [x] `IDataApi` 接口包含 data 模块的 2 个方法签名
- [x] `ITemplatesApi` 接口包含 templates 模块的 7 个方法签名
- [x] `IPromptsApi` 接口包含 prompts 模块的 4 个方法签名
- [x] `IFocusApi` 接口包含 focus 模块的 2 个方法签名
- [x] `ILearningPathsApi` 接口包含 learningPaths 模块的 19 个方法签名
- [x] `ILearningPathApi` 接口包含 learningPath 模块的 3 个方法签名
- [x] `ITtsApi` 接口包含 tts 模块的 3 个方法签名
- [x] `IRagApi` 接口包含 rag 模块的 4 个方法签名
- [x] `IAutoGraphApi` 接口包含 autoGraph 模块的 8 个方法签名
- [x] `IHealthApi` 接口包含 health 模块的 5 个方法签名
- [x] `IBackupApi` 接口包含 backup 模块的 6 个方法签名
- [x] `IPerformanceApi` 接口包含 performance 模块的 3 个方法签名
- [x] `IAgentApi` 接口包含 agent 模块的 10 个方法签名
- [x] `IDomainsApi` 接口包含 domains 模块的 9 个方法签名
- [x] `IGraphDomainsApi` 接口包含 graphDomains 模块的 2 个方法签名
- [x] `IPluginsApi` 接口包含 plugins 模块的 10 个方法签名
- [x] `ILiteratureApi` 接口包含 literature 模块的 3 个方法签名
- [x] `IRegionsApi` 接口包含 regions 模块的 5 个方法签名
- [x] `IStoryCreationApi` 接口包含 5 个子模块（structures/characters/scenes/appearances/relationships）共 18 个方法签名
- [x] `IConceptAggregationApi` 接口包含 conceptAggregation 模块的 5 个方法签名
- [x] `IGraphVersionsApi` 接口包含 graphVersions 模块的 9 个方法签名

## IApi 类型安全

- [x] `IApi` 接口中不存在 `GenericApiModule` 类型
- [x] `IApi` 接口中不存在 `any` 类型
- [x] `GenericApiModule` 类型定义已从 `IApi.ts` 中移除
- [x] `contracts/index.ts` 导出所有新增接口

## Mobile 端类型安全

- [x] `createNotSupportedModule` 改为泛型函数 `createNotSupportedModule<T>(): T`
- [x] `mobileApi` 中 26 个占位模块均使用具体接口类型参数
- [x] `mobileApi` 声明为 `IApi` 类型时 TypeScript 编译通过

## 构建验证

- [x] `npm run check` 无类型错误
- [x] `npm run lint` 无新增 any 相关 lint 错误

## 行为兼容

- [x] Web 端所有 API 调用行为不变
- [x] Mobile 端未实现模块调用仍抛出 `NotSupportedError`
