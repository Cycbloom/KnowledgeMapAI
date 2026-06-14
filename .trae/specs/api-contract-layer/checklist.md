# Checklist

## 契约接口完整性

- [x] `IGraphsApi` 接口包含 Web API `graphsApi` 的所有方法签名（47 个方法）
- [x] `INodesApi` 接口包含 Web API `nodesApi` 的所有方法签名
- [x] `IEdgesApi` 接口包含 Web API `edgesApi` 的所有方法签名
- [x] `IAuthApi` 接口包含 Web API `authApi` 的所有方法签名
- [x] `IAiApi` 接口包含 Web API `aiApi` 的所有方法签名
- [x] `IStudyApi` 接口包含 Web API `studyApi` 的所有方法签名
- [x] `IDashboardApi` 接口包含 Web API `dashboardApi` 的所有方法签名
- [x] `IStatisticsApi` 接口包含 Web API `statisticsApi` 的所有方法签名
- [x] `ISchedulerApi` 接口包含 Web API `schedulerApi` 的所有方法签名
- [x] `IQuizApi` 接口包含 Web API `quizApi` 的所有方法签名
- [x] `IAchievementsApi` 接口包含 Web API `achievementsApi` 的所有方法签名
- [x] `IPeriodicTasksApi` 接口包含 Web API `periodicTasksApi` 的所有方法签名
- [x] `IApi` 聚合接口包含所有子模块接口（37 个模块）

## 类型安全

- [x] Web API 的 `api` 聚合对象声明为 `IApi` 类型
- [x] Mobile API 的 `mobileApi` 聚合对象声明为 `IApi` 类型
- [x] `adapter.ts` 中无 `any` 类型
- [x] `adapter.ts` 中 `createNoopApi` 函数已移除
- [x] `adapter.ts` 导出的 `api` 类型为 `IApi`

## Mobile 端缺失方法处理

- [x] `mobileGraphsApi` 中 27 个不支持的方法使用 `NotSupportedError` 显式抛出
- [x] `mobileNodesApi` 中 `getRelated`、`searchSimilar`、`getKnowledgePointGraphs` 已改为 `NotSupportedError`
- [x] 其他有契约接口的 Mobile 模块（auth、ai、study、quiz、scheduler、achievements、periodicTasks）正确实现了接口

## 构建验证

- [x] `npm run check` 无类型错误（exit code 0）
- [x] `npm run lint` 仅 1 个预存错误（`ActiveTaskPanel.tsx:87` react-hooks/refs），与契约层无关

## 行为兼容

- [x] Web 端所有 API 调用行为不变
- [x] Mobile 端所有 API 调用行为不变
- [x] `getApi()` 和 `api` 导出的使用方式不变