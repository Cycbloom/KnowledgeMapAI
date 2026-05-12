# 文献提取概念节点未挂载到骨干节点修复 Spec

## Why

用户报告专题研究中文献提取的概念节点没有正确挂载到骨干节点下。经过深入代码调研，发现**根本原因**是：

**当从模板创建专题研究图谱时，骨干节点的 `backboneModule` 属性没有被保存到数据库中**。

### 问题链路分析

1. **模板生成阶段** (`templateGeneratorService.ts:161-204`): 
   - `generateTopicResearchBackboneNodes()` 正确地为每个骨干节点设置了 `backboneModule` 属性
   
2. **模板应用阶段** (`templates.ts:127-139`) - **问题所在**:
   ```typescript
   properties: {
     aiPrompt: node.aiPrompt,
     color: node.color,
     // ❌ 缺少 backboneModule: node.backboneModule
   },
   ```
   - 只保存了 `aiPrompt` 和 `color`，**没有保存 `backboneModule`**

3. **文献提取挂载阶段** (`literature.ts:696-701`):
   ```typescript
   if (kp?.properties?.backboneModule) {
     backboneModuleMap.set(kp.properties.backboneModule, gn.id);
   }
   ```
   - 由于 `backboneModule` 不存在，骨干节点不会被加入映射表
   - 概念节点找不到父节点，被创建为根节点

## What Changes

- **修复模板应用逻辑**: 在 `templates.ts` 的 `/from-template` 路由中，将 `backboneModule`、`needsRefinement`、`suggestedContent` 等属性正确保存到 `knowledge_points.properties`
- **增强日志**: 在文献提取应用时记录更详细的调试信息
- **数据修复**: 提供迁移脚本修复已存在的受损数据

## Impact

- Affected specs: 文献提取、专题研究模板
- Affected code:
  - `api/routes/templates.ts` - 修复属性保存逻辑（核心修复）
  - `api/routes/literature.ts` - 增强日志（辅助诊断）

## ADDED Requirements

### Requirement: 模板属性完整保存

系统 SHALL 在从模板创建图谱时完整保存所有节点属性：

#### Scenario: 专题研究模板属性保存

- **WHEN** 用户使用专题研究模板创建图谱
- **THEN** 系统将以下属性保存到 `knowledge_points.properties`:
  - `backboneModule`: 骨干模块标识
  - `needsRefinement`: 是否需要完善
  - `suggestedContent`: 建议内容
  - `aiPrompt`: AI 提示词
  - `color`: 节点颜色

#### Scenario: 文献提取正确挂载

- **WHEN** 用户在专题研究图谱中进行文献提取并应用概念
- **THEN** 系统能够正确找到对应的骨干节点
- **AND** 概念节点作为骨干节点的子节点创建
- **AND** 创建 `contains` 类型的边连接父子节点

## MODIFIED Requirements

### Requirement: 模板应用接口修复

现有的 `/api/templates/from-template` 接口需要修复：

#### Scenario: 完整属性传递

- **WHEN** 调用 `/api/templates/from-template` 接口
- **THEN** 传入的模板节点所有属性都被保存
- **AND** 特别确保 `backboneModule` 属性被保存

## Technical Design

### 修复方案

1. **修改 `api/routes/templates.ts` 第 130-138 行**:
   
   修改前：
   ```typescript
   properties: {
     aiPrompt: node.aiPrompt,
     color: node.color,
   },
   ```
   
   修改后：
   ```typescript
   properties: {
     ...(node.aiPrompt && { aiPrompt: node.aiPrompt }),
     ...(node.color && { color: node.color }),
     ...(node.backboneModule && { backboneModule: node.backboneModule }),
     ...(node.needsRefinement !== undefined && { needsRefinement: node.needsRefinement }),
     ...(node.suggestedContent && { suggestedContent: node.suggestedContent }),
   },
   ```

2. **可选：添加数据修复 API**
   - 提供 `/api/graphs/:graphId/fix-backbone-modules` 端点
   - 扫描专题研究图谱中 level 为 "core" 且标题匹配骨干模块标签的节点
   - 自动补全缺失的 `backboneModule` 属性

### 验证方法

1. 创建新的专题研究图谱
2. 检查数据库中骨干节点的 `properties` 字段是否包含 `backboneModule`
3. 执行文献提取操作
4. 验证概念节点是否正确挂载到骨干节点下
