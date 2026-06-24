# 清理 nodeHelpers 类型重复定义 Spec

## Why
`shared/utils/nodeHelpers.ts` 和 `api/utils/nodeHelpers.ts` 存在 4 个完全相同的重复定义（`GraphNodeRaw` 类型、`getKnowledgePoint`、`buildNodeFromGraphNode`、`buildNodesFromGraphNodes`），修改一处时另一处容易遗漏，存在类型漂移风险。

## What Changes
- `api/utils/nodeHelpers.ts` 从 shared 重新导出 4 个重复项，删除本地重复实现
- 保留 api 独有的 4 个函数（依赖 SupabaseClient 的数据库操作函数）

## Impact
- Affected code: `api/utils/nodeHelpers.ts` 及其 10 个消费者文件
- 无破坏性变更，所有消费者仍从 `api/utils/nodeHelpers` 导入，接口不变

## ADDED Requirements

### Requirement: nodeHelpers 单一数据源
`api/utils/nodeHelpers.ts` 中与 `shared/utils/nodeHelpers.ts` 重复的类型和函数 SHALL 通过 re-export 从 shared 导入，而非本地重复声明。

#### Scenario: 修改 shared 中的 GraphNodeRaw 类型
- **WHEN** 开发者在 `shared/utils/nodeHelpers.ts` 中修改 `GraphNodeRaw` 类型
- **THEN** `api/utils/nodeHelpers.ts` 的消费者自动获得更新，无需手动同步

#### Scenario: api 消费者导入路径不变
- **WHEN** api 代码执行 `import { buildNodeFromGraphNode } from "../../utils/nodeHelpers"`
- **THEN** 正常工作，无需修改导入路径
