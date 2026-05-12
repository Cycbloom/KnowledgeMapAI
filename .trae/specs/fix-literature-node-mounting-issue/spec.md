# 文献提取概念节点挂载问题深度分析 Spec

## Why

用户报告文献提取功能中，提取的概念节点没有正确挂载到对应的骨干节点下。经过深入分析代码，发现虽然后端代码已经实现了挂载逻辑，但存在以下潜在问题：

1. **边创建逻辑可能未正确执行**：虽然代码创建了 `contains` 类型的边，但需要验证边是否真的被创建到数据库中
2. **前端显示依赖边表**：前端 `GraphOutline` 组件完全依赖 `edges` 表来构建父子关系，如果边没有创建成功，节点就不会显示为骨干节点的子节点
3. **缺少验证机制**：没有验证边创建是否成功的机制

## What Changes

- **增强边创建验证**：在 `autoGraphService.processAINodes` 中添加边创建结果的验证和日志
- **增强错误处理**：当边创建失败时，提供详细的错误日志和用户提示
- **添加数据一致性检查**：在文献应用完成后，验证节点是否正确挂载
- **增强前端显示**：在前端显示挂载状态，帮助用户理解节点层级关系

## Impact

- Affected specs: 文献提取、专题调研增强
- Affected code:
  - `api/routes/literature.ts` - 增强验证和错误处理
  - `api/services/graph/autoGraphService.ts` - 增强边创建验证
  - `src/components/GraphEditor/panels/GraphOutline.tsx` - 可能需要增强显示逻辑

## ADDED Requirements

### Requirement: 边创建验证

系统应在创建边后验证边是否成功创建：

#### Scenario: 验证边创建成功

- **WHEN** `autoGraphService.processAINodes` 创建边后
- **THEN** 系统查询数据库验证边是否存在
- **AND** 记录验证结果到日志
- **AND** 如果验证失败，记录详细的错误信息

#### Scenario: 边创建失败处理

- **WHEN** 边创建验证失败
- **THEN** 系统记录详细的错误日志，包括：
  - 失败的边数量
  - 失败的节点 ID
  - 数据库错误信息
- **AND** 在响应中标记挂载失败状态
- **AND** 提供用户友好的错误提示

### Requirement: 挂载状态反馈

系统应在文献应用完成后提供挂载状态反馈：

#### Scenario: 返回挂载统计信息

- **WHEN** 文献概念应用完成
- **THEN** 返回详细的统计信息：
  - 成功挂载的节点数量
  - 作为根节点创建的节点数量
  - 挂载失败的节点数量（如果有）
- **AND** 提供每个节点的挂载状态

#### Scenario: 显示挂载详情

- **WHEN** 用户查看应用结果
- **THEN** 显示每个概念节点的挂载目标模块
- **AND** 显示挂载是否成功
- **AND** 对于未挂载的节点，显示原因（如骨干节点不存在）

### Requirement: 数据一致性检查

系统应提供数据一致性检查功能：

#### Scenario: 检查节点挂载一致性

- **WHEN** 文献应用完成后
- **THEN** 检查以下一致性：
  - 节点的 `properties.backboneModule` 是否与目标模块一致
  - 是否存在对应的 `contains` 类型的边
  - 边的源节点是否为骨干节点
- **AND** 记录不一致的情况到日志
- **AND** 提供修复建议

## MODIFIED Requirements

### Requirement: 文献应用接口增强

现有的 `/api/literature/apply` 接口需要增强：

#### Scenario: 返回详细的挂载信息

- **WHEN** 调用 `/api/literature/apply` 接口
- **THEN** 返回详细的挂载信息：
  ```json
  {
    "success": true,
    "addedCount": 5,
    "mergedCount": 2,
    "nodeMapping": {...},
    "mountingStats": {
      "mountedCount": 4,
      "unmountedCount": 1,
      "mountingDetails": [
        {
          "conceptTitle": "概念A",
          "targetModule": "core_concepts",
          "mountedTo": "骨干节点ID",
          "status": "success"
        },
        {
          "conceptTitle": "概念B",
          "targetModule": "research_methods",
          "mountedTo": null,
          "status": "failed",
          "reason": "骨干节点不存在"
        }
      ]
    }
  }
  ```

## Technical Design

### 问题诊断步骤

1. **检查边是否创建成功**
   - 在 `autoGraphService.createEdgesBatch` 中添加详细日志
   - 记录每条边的创建状态
   - 验证边是否真的插入到数据库

2. **检查骨干节点查询**
   - 验证 `backboneModuleMap` 是否正确构建
   - 检查骨干节点的 `properties.backboneModule` 是否正确设置
   - 记录查询结果到日志

3. **检查 parentId 传递**
   - 验证 `parentId` 是否正确传递到 `processAINodes`
   - 检查 `parentId` 是否为有效的骨干节点 ID

### 实现步骤

1. 在 `literature.ts` 中添加详细的日志记录
2. 在 `autoGraphService.ts` 中增强边创建验证
3. 添加挂载状态统计和返回
4. 在前端显示挂载状态

### 调试代码示例

```typescript
// 在 literature.ts 中添加详细日志
logger.info("Backbone module map:", {
  mapSize: backboneModuleMap.size,
  modules: Array.from(backboneModuleMap.entries()).map(([module, id]) => ({
    module,
    nodeId: id,
  })),
});

logger.info("Nodes to create with parentId:", {
  nodes: aiNodesData.map((n) => ({
    title: n.title,
    parentId: n.parentId,
    targetModule: nodesToCreate.find((nd) => nd.tempId === n.tempId)?.targetModule,
  })),
});

// 在 autoGraphService.ts 中添加边创建验证
logger.info("Edges to create:", {
  count: edgesToCreate.length,
  edges: edgesToCreate.map((e) => ({
    source: e.source_knowledge_point_id,
    target: e.target_knowledge_point_id,
    type: e.relationship_type,
  })),
});

// 创建边后验证
const { data: createdEdges, error: verifyError } = await supabase
  .from('edges')
  .select('*')
  .in('source_knowledge_point_id', edgesToCreate.map(e => e.source_knowledge_point_id))
  .in('target_knowledge_point_id', edgesToCreate.map(e => e.target_knowledge_point_id));

if (verifyError) {
  logger.error("Edge verification failed:", verifyError);
} else {
  logger.info("Edges verified:", {
    expected: edgesToCreate.length,
    actual: createdEdges?.length || 0,
  });
}
```

## Root Cause Analysis

经过深入分析，问题的根本原因可能是：

1. **边创建失败**：`createEdgesBatch` 可能因为某些原因失败，但没有详细的错误日志
2. **骨干节点查询问题**：骨干节点的 `properties.backboneModule` 可能没有正确设置
3. **数据类型不匹配**：`parentId` 可能不是有效的 UUID
4. **数据库约束**：可能存在唯一性约束或其他约束导致边创建失败

## Next Steps

1. 添加详细的调试日志，重现问题
2. 检查数据库中的实际数据
3. 根据调试结果修复具体问题
4. 添加自动化测试验证修复效果
