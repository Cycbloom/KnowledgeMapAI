# 概念聚合与层级构建功能 Spec

## Why

当前知识图谱从文献中提取概念后，会产生大量节点，存在以下问题：
1. **概念冗余**：相同/相似的概念被重复提取为多个节点（如「CNN」「卷积神经网络」「ConvNet」）
2. **结构扁平**：概念之间缺乏层次关系，无法体现知识的上下位结构（如「机器学习」→「深度学习」→「CNN」）
3. **管理困难**：用户需要手动整理和归类概念，效率低下

本功能旨在提供 AI 驱动的概念聚合能力，自动识别概念的语义关系，构建有层次的知识体系。

## What Changes

### 新增功能
- **概念智能聚合服务**：独立的 AI 服务（与 literature 提取同级），用于分析图谱内概念的语义关系
- **层级关系自动识别**：AI 自动判断概念之间的上下位（父子）关系
- **别名机制**：支持一个知识点拥有多个名称（别名），解决同义词问题
- **聚合操作**：合并相似概念、建立层级连接、设置别名
- **可视化展示**：
  - 聚合结果预览面板
  - 概念层次树/聚类图
  - 图谱中的相似度标注

### 数据库变更
- `knowledge_points` 表新增 `aliases` 字段（TEXT[]），存储别名列表

### API 变更
- 新增 `/api/graphs/:graphId/concept-aggregation` 相关接口
- 新增 AI 服务端点用于层级识别

## Impact

- Affected specs: 无直接影响的现有 spec
- Affected code:
  - `api/services/graph/conceptAggregationService.ts` - 扩展现有服务
  - `api/services/ai/` - 新增层级识别 AI 服务
  - `supabase/migrations/` - 新增 aliases 字段迁移
  - `src/components/` - 新增聚合面板 UI 组件
  - `src/services/api/` - 新增 API 调用

## ADDED Requirements

### Requirement: 概念聚合服务

系统 SHALL 提供独立的概念聚合 AI 服务，支持对指定图谱内的概念进行智能分析。

#### Scenario: 触发聚合分析
- **WHEN** 用户在 AI 助手面板中点击「概念聚合」按钮并选择目标图谱
- **THEN** 系统 SHALL 调用 AI 服务分析该图谱内所有概念的语义关系
- **AND** 返回以下分析结果：
  - 相似概念组（候选合并列表）
  - 建议的层级关系（父子关系建议）
  - 建议的别名映射

#### Scenario: 执行聚合操作
- **WHEN** 用户确认聚合建议
- **THEN** 系统 SHALL 执行以下操作：
  - 合并被选中的相似概念为一个节点
  - 创建/更新层级边（parent-child 关系）
  - 设置节点的别名

### Requirement: 别名机制

系统 SHALL 支持知识点别名功能，允许一个概念拥有多个名称表示。

#### 数据模型
```sql
ALTER TABLE knowledge_points 
ADD COLUMN IF NOT EXISTS aliases TEXT[] DEFAULT '{}';
```

#### Scenario: 设置别名
- **WHEN** 用户为概念 A 设置别名「B」「C」
- **THEN** 系统 SHALL 将「B」「C」存储到 concept A 的 aliases 字段
- **AND** 后续搜索「B」或「C」时能匹配到概念 A

#### Scenario: 聚合时自动生成别名
- **WHEN** 概念 X 被合并到概念 A
- **THEN** 系统 SHALL 自动将 X 的标题添加到 A 的 aliases 中

### Requirement: 层级关系识别

系统 SHALL 使用 AI 自动识别概念之间的上下位（is-a）层级关系。

#### Scenario: AI 层级分析
- **WHEN** 系统对图谱执行层级分析
- **THEN** AI SHALL 返回建议的父子关系对列表，格式如：
  ```json
  [
    {"parent": "机器学习", "child": "深度学习", "confidence": 0.92},
    {"parent": "深度学习", "child": "卷积神经网络", "confidence": 0.88}
  ]
  ```

#### Scenario: 应用层级关系
- **WHEN** 用户确认某组层级关系
- **THEN** 系统 SHALL 在图谱中创建对应的层级边（edge）
- **AND** 更新相关节点的 level 属性（root/core/sub/normal/leaf）

### Requirement: 可视化界面

系统 SHALL 在 AI 助手面板中提供概念聚合功能的完整 UI。

#### Scenario: 聚合结果预览面板
- **WHEN** 聚合分析完成
- **THEN** 系统 SHALL 显示：
  - 相似概念分组列表（每组显示成员、相似度、来源）
  - 每组的操作按钮：「合并」「忽略」「手动调整」
  - 建议的层级关系树形图
  - 预计变更摘要（将合并 N 个节点，创建 M 条层级边）

#### Scenario: 概念层次树视图
- **WHEN** 用户切换到「层次树」标签页
- **THEN** 系统 SHALL 以可交互的树形图展示当前图谱的概念层级结构
- **AND** 支持展开/折叠、拖拽调整层级

#### Scenario: 图谱相似度标注
- **WHEN** 聚合分析完成且用户开启「相似度标注」模式
- **THEN** 系统 SHALL 在图谱画布中：
  - 高亮显示相似概念组（使用相同颜色）
  - 用虚线连接相似概念
  - 悬停显示相似度分数和合并建议

### Requirement: API 接口

系统 SHALL 提供以下 API 接口：

```
POST   /api/graphs/:graphId/concept-aggregation/analyze     # 执行聚合分析
POST   /api/graphs/:graphId/concept-aggregation/merge       # 执行合并操作
POST   /api/graphs/:graphId/concept-aggregation/hierarchy    # 识别层级关系
GET    /api/graphs/:graphId/concept-aggregation/results      # 获取分析结果
PUT    /api/knowledge-points/:id/aliases                     # 更新别名
```

## MODIFIED Requirements

### Requirement: ConceptAggregationService

扩展现有的 `conceptAggregationService`，新增以下能力：

1. **层级识别方法** `identifyHierarchy()`
   - 调用 AI 分析概念间的 is-a 关系
   - 返回带置信度的层级建议列表

2. **批量合并方法** `batchMerge()`
   - 支持一次合并多个概念组
   - 自动处理别名累加
   - 更新关联边的目标节点

3. **别名管理方法**
   - `addAliases(kpId, aliases)`
   - `removeAlias(kpId, alias)`

## REMOVED Requirements

无

## 技术约束

1. **AI 服务调用**：使用现有的 aiService，需设计新的 prompt 模板用于层级识别
2. **性能考虑**：大规模图谱（>500 节点）需分批处理，支持进度反馈
3. **事务安全**：合并操作需在事务中执行，支持回滚
4. **用户体验**：分析过程需显示进度，预计耗时提示
