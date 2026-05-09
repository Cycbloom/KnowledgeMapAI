# 文献提取节点挂载修复 Spec

## Why

当前文献提取功能存在严重问题：提取的概念节点被创建为独立的根节点，而不是挂载到对应的骨干节点下。这违背了专题调研功能的设计初衷，导致知识图谱结构混乱，用户无法看到概念与骨干模块的层级关系。

## What Changes

- **修复文献提取应用逻辑**：在创建节点时，根据 `targetModule` 查找对应的骨干节点，并设置正确的 `parentId`
- **增强骨干节点查询**：添加根据 `backboneModule` 属性查询骨干节点的功能
- **增强节点创建逻辑**：确保提取的概念节点正确挂载到骨干节点下
- **增强错误处理**：当找不到对应的骨干节点时，提供友好的错误提示

## Impact

- Affected specs: 文献概念提取、专题调研增强
- Affected code:
  - `api/routes/literature.ts` - 修复节点创建逻辑
  - `api/services/graph/autoGraphService.ts` - 可能需要增强以支持骨干节点挂载
  - `api/services/graph/backboneValidatorService.ts` - 可能需要增强查询功能

## ADDED Requirements

### Requirement: 概念节点挂载到骨干节点

系统应在创建概念节点时，自动将其挂载到对应的骨干节点下：

#### Scenario: 根据目标模块挂载节点

- **WHEN** 用户确认提取的概念并应用到图谱
- **THEN** 系统根据概念的 `targetModule` 属性查找对应的骨干节点
- **AND** 将概念节点作为骨干节点的子节点创建
- **AND** 设置概念节点的 `parentId` 为骨干节点的 ID
- **AND** 在概念节点和骨干节点之间创建 `contains` 类型的边

#### Scenario: 骨干节点不存在时的处理

- **WHEN** 查找骨干节点时，发现图谱中不存在对应的骨干节点
- **THEN** 系统记录警告日志
- **AND** 将概念节点作为根节点创建（降级处理）
- **AND** 在响应中标记该节点为"未挂载"状态

#### Scenario: 验证挂载结果

- **WHEN** 概念节点创建完成
- **THEN** 节点的 `parentId` 应该指向正确的骨干节点
- **AND** 节点的 `properties.backboneModule` 应该与 `targetModule` 一致
- **AND** 图谱中应该存在从骨干节点到概念节点的边

### Requirement: 骨干节点查询增强

系统应提供根据 `backboneModule` 属性查询骨干节点的功能：

#### Scenario: 查询骨干节点

- **WHEN** 系统需要根据模块类型查找骨干节点
- **THEN** 查询 `graph_nodes` 表中 `properties.backboneModule` 等于目标模块的节点
- **AND** 返回节点的 ID 和相关信息

## MODIFIED Requirements

### Requirement: 文献应用接口增强

现有的 `/api/literature/apply` 接口需要增强：

#### Scenario: 节点创建前查询骨干节点

- **WHEN** 准备创建概念节点时
- **THEN** 先查询图谱中是否存在对应的骨干节点
- **AND** 缓存骨干节点映射关系，避免重复查询

#### Scenario: 设置正确的父节点 ID

- **WHEN** 调用 `autoGraphService.processAINodes` 创建节点
- **THEN** 为每个节点设置正确的 `parentId`（骨干节点 ID 或 null）
- **AND** 确保父子关系在数据库中正确建立

## Technical Design

### 数据流

```
提取概念 → 确定目标模块 → 查询骨干节点 → 设置 parentId → 创建节点 → 创建边
```

### 实现步骤

1. 在 `literature.ts` 的 `/apply` 接口中，在创建节点前查询骨干节点
2. 构建 `backboneModule -> nodeId` 的映射
3. 在创建节点时，根据 `targetModule` 设置 `parentId`
4. 创建从骨干节点到概念节点的边

### 代码修改示例

```typescript
// 查询骨干节点
const { data: backboneNodes } = await supabase
  .from('graph_nodes')
  .select(`
    id,
    knowledge_point_id,
    knowledge_points (
      id,
      title,
      properties
    )
  `)
  .eq('graph_id', graph_id)
  .is('deleted_at', null);

// 构建骨干模块映射
const backboneModuleMap = new Map<BackboneModule, string>();
for (const gn of backboneNodes || []) {
  const kp = gn.knowledge_points as unknown as { properties?: { backboneModule?: BackboneModule } };
  if (kp?.properties?.backboneModule) {
    backboneModuleMap.set(kp.properties.backboneModule, gn.id);
  }
}

// 创建节点时设置 parentId
const aiNodesData = nodesToCreate.map((node) => {
  const backboneNodeId = node.targetModule ? backboneModuleMap.get(node.targetModule) : null;
  return {
    tempId: node.tempId,
    parentId: backboneNodeId || null,  // 设置为骨干节点 ID
    title: node.title,
    content: node.content,
    level: node.level,
    x_position: node.x_position,
    y_position: node.y_position,
  };
});
```
