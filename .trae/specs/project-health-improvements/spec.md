# 项目健康度改善 Spec

## Why
项目经过长期迭代，积累了大量技术债务：巨型单文件（graphs.ts 2656 行、MindMapCanvas 1601 行）、mobile 与 api 层大量重复逻辑、路由架构混乱（同一处理器挂载到 3 个路径）、组件 props 爆炸（30+ 个）以及前端巨型组件缺乏错误边界。这些问题直接影响开发效率和代码可维护性，需要系统性地清理和重构。

## What Changes
- 拆分巨型路由文件（graphs.ts → 多子路由模块）
- 拆分巨型前端组件（MindMapCanvas、GraphMapCanvas、TaskWorkbench 等）
- 消除 mobile 层与 api 层的重复逻辑
- 统一路由挂载架构（清理重复路径映射）
- 为关键巨型组件添加 ErrorBoundary 保护
- 清理 package.json 中重复/不必要的依赖
- 提升 server.ts 启动流程的健壮性
- 统一 API 路由命名（kebab-case）

## Impact
- Affected specs: 无（纯重构，不改变功能行为）
- Affected code: `api/routes/`, `src/components/`, `src/services/mobile/`, `api/server.ts`, `api/app.ts`, `package.json`, `src/App.tsx`

## ADDED Requirements

### Requirement: 巨型路由文件拆分
系统 SHALL 将超过 800 行的路由文件拆分为多个子路由模块，每个模块聚焦单一职责。

#### Scenario: graphs.ts 拆分
- **GIVEN** `api/routes/graphs.ts` 包含 2656 行代码
- **WHEN** 进行拆分重构
- **THEN** 应拆分为 `api/routes/graphs/` 目录，包含 `index.ts`（路由汇总）、`crud.ts`（CRUD 操作）、`domains.ts`（领域分析）、`expansion.ts`（扩展操作）、`backbone.ts`（骨干模块）等子模块
- **AND** 原有 API 路径和功能行为保持不变

### Requirement: 巨型前端组件拆分
系统 SHALL 将超过 600 行的 React 组件拆分为更小的子组件，使用组合模式而非巨型单体。

#### Scenario: MindMapCanvas 拆分
- **GIVEN** `MindMapCanvas.tsx` 包含 1601 行代码和 30+ 个 props
- **WHEN** 进行拆分重构
- **THEN** 应将画布交互逻辑、节点渲染、边渲染、选择管理、布局计算等职责拆分为独立的 hooks 和子组件
- **AND** 原有交互行为不变

#### Scenario: GraphMapCanvas 拆分
- **GIVEN** `GraphMapCanvas.tsx` 包含 918 行代码
- **WHEN** 进行拆分重构
- **THEN** 应将渲染逻辑与交互逻辑分离为独立模块

#### Scenario: TaskWorkbench 拆分
- **GIVEN** `TaskWorkbench.tsx` 包含 567 行代码且管理多个 Tab
- **WHEN** 进行拆分重构
- **THEN** 每个 Tab 内容应提取为独立子组件

### Requirement: Mobile 与 API 层逻辑去重
系统 SHALL 消除 `src/services/mobile/` 与 `api/services/` 之间的重复业务逻辑，将共享逻辑移至 `shared/` 目录。

#### Scenario: 共享逻辑提取
- **GIVEN** mobile 层的 `graphs.ts`、`auth.ts`、`tasks.ts` 等与 api 层存在结构和逻辑重复
- **WHEN** 进行去重重构
- **THEN** 共享的类型定义、数据转换函数、常量应统一放在 `shared/` 目录
- **AND** mobile 层应仅保留 API 调用适配逻辑

### Requirement: 路由架构清理
系统 SHALL 消除同一路由处理器挂载到多个路径的混乱情况，为每个路由提供唯一、清晰的路径映射。

#### Scenario: knowledgePointRoutes 路径去重
- **GIVEN** `knowledgePointRoutes` 同时挂载在 `/api/knowledge-points`、`/api/graph-nodes`、`/api/combined-view` 三个路径
- **WHEN** 进行路由架构清理
- **THEN** 每个路径应有独立的、语义明确的路由处理器
- **AND** 共享的业务逻辑应提取到 service 层

### Requirement: ErrorBoundary 覆盖率提升
系统 SHALL 确保所有大型页面级组件和关键功能组件被 ErrorBoundary 包裹，防止局部错误导致整个应用崩溃。

#### Scenario: ErrorBoundary 保护
- **GIVEN** `ErrorBoundary.tsx` 已存在但未被广泛使用
- **WHEN** 进行防护加强
- **THEN** MindMapCanvas、GraphMapCanvas、TaskWorkbench、GraphSidebarManager 等大型组件应被 ErrorBoundary 包裹
- **AND** 错误回退 UI 应提供"重试"操作

### Requirement: 依赖清理
系统 SHALL 清理 package.json 中的冗余依赖配置。

#### Scenario: 重复/不必要依赖清理
- **GIVEN** `@types/react-syntax-highlighter` 同时出现在 dependencies 和 devDependencies
- **AND** `babel-plugin-react-dev-locator` 在生产中不必要
- **WHEN** 进行依赖清理
- **THEN** `@types/*` 包应全部移至 devDependencies
- **AND** 仅开发时需要的包不应进入生产构建

### Requirement: 服务启动流程健壮性
系统 SHALL 改善 server.ts 的启动流程，添加依赖顺序检查和启动失败优雅降级。

#### Scenario: 启动流程改进
- **GIVEN** server.ts 中插件注册、性能监控初始化、第三方插件加载并行执行但无依赖检查
- **WHEN** 进行启动流程改进
- **THEN** 各初始化步骤应明确依赖关系并按序执行
- **AND** 非关键服务启动失败不应阻止服务器启动

### Requirement: API 路由命名统一
系统 SHALL 统一所有 API 路由路径为 kebab-case 格式。

#### Scenario: 路由命名统一
- **GIVEN** 部分路由使用 kebab-case（`/api/learning-paths`），部分可能不一致
- **WHEN** 进行命名统一
- **THEN** 所有 API 路径应使用 kebab-case（如 `relationship-types`、`knowledge-points`）
- **AND** 保持向后兼容（旧路径保留重定向或别名）

## REMOVED Requirements
无

## MODIFIED Requirements
无