# 消除服务间传递性循环依赖 Spec

## Why
`graph/` 服务目录与 `ai/` 服务目录之间存在传递性循环依赖：graph（多个文件）→ ai → graph（通过 `ragService→graphTraversalService`）。虽然当前运行时安全（graphTraversalService 是叶子节点），但违反了单向依赖原则，未来如果 graphTraversalService 需要调用 AI 功能，将立即导致 ESM 循环导入的 `undefined` 运行时错误。此外，graph/ 对 ai/ 的高耦合（8 次导入）和 ai/ 的高被依赖度（22 次被导入）是架构脆弱点。

## What Changes
- 消除 `ragService→graphTraversalService` 的直接导入，改为构造函数注入遍历能力
- 在 `api/services/index.ts` 中建立服务初始化顺序，确保依赖方向一致
- 添加依赖方向文档注释

## Impact
- Affected code: `api/services/ai/ragService.ts`, `api/services/index.ts`
- Affected specs: aiservice-refactor（已完成，无冲突）

## ADDED Requirements

### Requirement: RAG 服务遍历能力注入
`ragService` SHALL 通过构造函数参数接收图谱遍历能力，而非直接 import `graphTraversalService`。

#### Scenario: RAG 服务初始化时注入遍历能力
- **WHEN** 应用启动并初始化 `ragService`
- **THEN** `ragService` 通过构造函数参数接收 `traverseGraph` 函数
- **AND** `ragService` 不再直接 import `graphTraversalService`

#### Scenario: RAG 搜索使用注入的遍历能力
- **WHEN** `ragService` 需要遍历图谱关系扩展上下文
- **THEN** 调用注入的 `traverseGraph` 函数
- **AND** 行为与直接调用 `graphTraversalService` 完全一致

### Requirement: 服务依赖方向规则
服务间依赖 SHALL 遵循单向依赖原则：`common ← core ← ai ← graph ← study ← scheduler`。反向依赖（如 ai → graph）SHALL 通过注入或事件总线解耦。

#### Scenario: 新增服务间导入时遵循方向规则
- **WHEN** 开发者在服务 A 中新增对服务 B 的 import
- **THEN** B 的层级必须等于或低于 A 的层级（common=0, core=1, ai=2, graph=3, study=4, scheduler=5）
- **AND** 不允许反向导入（高层级导入低层级以外的服务）

## MODIFIED Requirements

### Requirement: ragService 图谱遍历
`ragService` 的 `buildContext` 方法中使用的图谱遍历能力 SHALL 从构造函数注入获取，而非模块顶层 import。

## REMOVED Requirements

### Requirement: ragService 直接导入 graphTraversalService
**Reason**: 造成 graph→ai→graph 传递性循环依赖
**Migration**: 在服务初始化时将 `graphTraversalService.traverseGraph` 注入到 `ragService`
