# Tasks

## Phase 1: 契约接口定义（核心基础设施）

- [ ] Task 1: 创建契约接口目录和基础类型
  - [ ] SubTask 1.1: 创建 `src/services/api/contracts/` 目录
  - [ ] SubTask 1.2: 创建 `src/services/api/contracts/types.ts`，定义 `NotSupportedError` 类和共享的辅助类型

- [ ] Task 2: 定义图谱 API 契约接口 `IGraphsApi`
  - [ ] SubTask 2.1: 分析 `graphsApi` 和 `mobileGraphsApi` 的方法签名，确定所有共有方法
  - [ ] SubTask 2.2: 创建 `IGraphsApi.ts`，包含 Graph 对象的所有方法签名（含参数类型、返回类型）
  - [ ] SubTask 2.3: 导出 `IGraphsApi` 到 `contracts/index.ts`

- [ ] Task 3: 定义节点和边 API 契约接口
  - [ ] SubTask 3.1: 创建 `INodesApi.ts`，定义节点 CRUD + 批量操作 + 查询方法签名
  - [ ] SubTask 3.2: 创建 `IEdgesApi.ts`，定义边 CRUD 方法签名
  - [ ] SubTask 3.3: 导出到 `contracts/index.ts`

- [ ] Task 4: 定义认证、AI、学习 API 契约接口
  - [ ] SubTask 4.1: 创建 `IAuthApi.ts`
  - [ ] SubTask 4.2: 创建 `IAiApi.ts`
  - [ ] SubTask 4.3: 创建 `IStudyApi.ts`
  - [ ] SubTask 4.4: 创建 `IDashboardApi.ts` 和 `IStatisticsApi.ts`
  - [ ] SubTask 4.5: 导出到 `contracts/index.ts`

- [ ] Task 5: 定义调度、测验、成就、周期任务 API 契约接口
  - [ ] SubTask 5.1: 创建 `ISchedulerApi.ts`
  - [ ] SubTask 5.2: 创建 `IQuizApi.ts`
  - [ ] SubTask 5.3: 创建 `IAchievementsApi.ts`
  - [ ] SubTask 5.4: 创建 `IPeriodicTasksApi.ts`
  - [ ] SubTask 5.5: 导出到 `contracts/index.ts`

- [ ] Task 6: 定义顶层 `IApi` 聚合接口
  - [ ] SubTask 6.1: 创建 `IApi.ts`，聚合所有子模块接口为一个顶层接口
  - [ ] SubTask 6.2: 在 `contracts/index.ts` 中统一导出所有接口

## Phase 2: Web API 层适配（添加类型声明）

- [ ] Task 7: Web API 模块添加接口类型声明
  - [ ] SubTask 7.1: 修改 `graphsApi` 声明为 `satisfies IGraphsApi`（或显式类型注解）
  - [ ] SubTask 7.2: 修改 `nodesApi`、`edgesApi` 声明
  - [ ] SubTask 7.3: 修改 `authApi`、`aiApi`、`studyApi` 等声明
  - [ ] SubTask 7.4: 修改 `schedulerApi`、`quizApi` 等声明
  - [ ] SubTask 7.5: 修改 `api/index.ts` 中 `api` 聚合对象声明为 `IApi` 类型

## Phase 3: Mobile API 层适配（补齐缺失 + 类型声明）

- [ ] Task 8: Mobile API 模块补齐缺失方法并添加类型声明
  - [ ] SubTask 8.1: 为 `mobileGraphsApi` 补齐 Web 端有但 Mobile 端缺失的方法（分析、文献、跨域洞察等），暂用 `NotSupportedError` 或合理空值实现
  - [ ] SubTask 8.2: 为 `mobileNodesApi` 已有 stub 方法（`getRelated`、`searchSimilar`、`getKnowledgePointGraphs`）添加显式 `NotSupportedError`
  - [ ] SubTask 8.3: 为 `mobileAuthApi`、`mobileAiApi`、`mobileStudyApi` 等添加接口类型声明
  - [ ] SubTask 8.4: 修改 `mobile/index.ts` 中 `mobileApi` 聚合对象声明为 `IApi` 类型

## Phase 4: Adapter 层重构

- [ ] Task 9: 重构 `adapter.ts` 移除 `createNoopApi` 和 `any`
  - [ ] SubTask 9.1: 重写 `getResolvedApi()` 函数，使用 `IApi` 类型，直接返回 `webApi` 或 `mobileApi`
  - [ ] SubTask 9.2: 移除 `createNoopApi` 函数
  - [ ] SubTask 9.3: 移除所有 `any` 类型标注
  - [ ] SubTask 9.4: 确保 `api` Proxy 导出类型为 `IApi`

## Phase 5: 验证

- [ ] Task 10: 类型检查和构建验证
  - [ ] SubTask 10.1: 运行 `npm run check` 确保无类型错误
  - [ ] SubTask 10.2: 运行 `npm run lint` 确保无 lint 错误
  - [ ] SubTask 10.3: 手动验证：在 `IGraphsApi` 中新增一个方法，确认两端都报编译错误

# Task Dependencies

- Task 2-5 全部依赖 Task 1（基础类型和目录）
- Task 2-5 之间无依赖，可并行执行
- Task 6 依赖 Task 2-5（聚合接口需要所有子接口）
- Task 7 依赖 Task 6（Web 端需要聚合接口定义）
- Task 8 依赖 Task 6（Mobile 端需要聚合接口定义）
- Task 7 和 Task 8 可并行执行
- Task 9 依赖 Task 7 和 Task 8（Adapter 重构需要在两端都完成适配后）
- Task 10 依赖 Task 9（验证在所有重构完成后）