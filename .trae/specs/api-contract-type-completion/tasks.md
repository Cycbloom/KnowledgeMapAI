# Tasks

## Phase 1: 契约接口定义

- [x] Task 1: 定义知识点相关 API 契约接口
  - [x] SubTask 1.1: 创建 `IKnowledgePointsApi.ts`，定义 knowledgePoints 模块的 15 个方法签名
  - [x] SubTask 1.2: 在 `IKnowledgePointsApi.ts` 中定义 `IGraphNodesApi` 接口（graphNodes 模块的 7 个方法）
  - [x] SubTask 1.3: 在 `IKnowledgePointsApi.ts` 中定义 `ICombinedViewApi` 接口（combinedView 模块的 1 个方法）

- [x] Task 2: 定义任务/搜索/数据 API 契约接口
  - [x] SubTask 2.1: 创建 `ITasksApi.ts`，定义 tasks 模块的 4 个方法签名
  - [x] SubTask 2.2: 在 `ITasksApi.ts` 中定义 `ISearchApi` 接口（search 模块的 1 个方法）
  - [x] SubTask 2.3: 在 `ITasksApi.ts` 中定义 `IDataApi` 接口（data 模块的 2 个方法）

- [x] Task 3: 定义模板/Prompt/专注 API 契约接口
  - [x] SubTask 3.1: 创建 `ITemplatesApi.ts`，定义 templates 模块的 7 个方法签名
  - [x] SubTask 3.2: 在 `ITemplatesApi.ts` 中定义 `IPromptsApi` 接口（prompts 模块的 4 个方法）
  - [x] SubTask 3.3: 在 `ITemplatesApi.ts` 中定义 `IFocusApi` 接口（focus 模块的 2 个方法）

- [x] Task 4: 定义学习路径 API 契约接口
  - [x] SubTask 4.1: 创建 `ILearningPathsApi.ts`，定义 learningPaths 模块的 19 个方法签名
  - [x] SubTask 4.2: 在 `ILearningPathsApi.ts` 中定义 `ILearningPathApi` 接口（learningPath 模块的 3 个方法）

- [x] Task 5: 定义 AI 相关 API 契约接口
  - [x] SubTask 5.1: 创建 `ITtsApi.ts`，定义 tts 模块的 3 个方法签名
  - [x] SubTask 5.2: 创建 `IRagApi.ts`，定义 rag 模块的 4 个方法签名
  - [x] SubTask 5.3: 创建 `IAutoGraphApi.ts`，定义 autoGraph 模块的 8 个方法签名

- [x] Task 6: 定义系统工具 API 契约接口
  - [x] SubTask 6.1: 创建 `IHealthApi.ts`，定义 health 模块的 5 个方法签名
  - [x] SubTask 6.2: 创建 `IBackupApi.ts`，定义 backup 模块的 6 个方法签名
  - [x] SubTask 6.3: 创建 `IPerformanceApi.ts`，定义 performance 模块的 3 个方法签名

- [x] Task 7: 定义 Agent/领域/插件 API 契约接口
  - [x] SubTask 7.1: 创建 `IAgentApi.ts`，定义 agent 模块的 10 个方法签名
  - [x] SubTask 7.2: 创建 `IDomainsApi.ts`，定义 domains 模块的 9 个方法 + graphDomains 模块的 2 个方法
  - [x] SubTask 7.3: 创建 `IPluginsApi.ts`，定义 plugins 模块的 10 个方法签名

- [x] Task 8: 定义文献/区域/故事/概念/版本 API 契约接口
  - [x] SubTask 8.1: 创建 `ILiteratureApi.ts`，定义 literature 模块的 3 个方法签名
  - [x] SubTask 8.2: 创建 `IRegionsApi.ts`，定义 regions 模块的 5 个方法签名
  - [x] SubTask 8.3: 创建 `IStoryCreationApi.ts`，定义 5 个子模块接口（structures/characters/scenes/appearances/relationships，共 18 个方法）
  - [x] SubTask 8.4: 创建 `IConceptAggregationApi.ts`，定义 conceptAggregation 模块的 5 个方法签名
  - [x] SubTask 8.5: 创建 `IGraphVersionsApi.ts`，定义 graphVersions 模块的 9 个方法签名

## Phase 2: IApi 聚合接口更新

- [x] Task 9: 更新 IApi.ts 和 index.ts
  - [x] SubTask 9.1: 在 `IApi.ts` 中导入所有新增接口，将 26 个 `GenericApiModule` 替换为具体接口类型
  - [x] SubTask 9.2: 移除 `GenericApiModule` 类型定义
  - [x] SubTask 9.3: 在 `contracts/index.ts` 中导出所有新增接口

## Phase 3: Mobile 端类型安全占位

- [x] Task 10: 重构 Mobile 端占位模块
  - [x] SubTask 10.1: 将 `createNotSupportedModule` 改为泛型函数 `createNotSupportedModule<T>(): T`
  - [x] SubTask 10.2: 更新 `mobileApi` 中 26 个 `createNotSupportedModule` 调用，添加具体接口类型参数

## Phase 4: 验证

- [x] Task 11: 类型检查和构建验证
  - [x] SubTask 11.1: 运行 `npm run check` 确保无类型错误
  - [x] SubTask 11.2: 运行 `npm run lint` 确保无 lint 错误（特别是 no-explicit-any 规则）

# Task Dependencies

- Task 1-8 之间无依赖，可并行执行
- Task 9 依赖 Task 1-8（需要所有接口定义完成后更新 IApi）
- Task 10 依赖 Task 9（Mobile 端需要 IApi 中的具体接口类型）
- Task 11 依赖 Task 10（验证在所有修改完成后）
