# 领域图谱生成问题修复 Spec

## Why

当前领域图谱生成功能存在以下关键问题：
1. **节点之间没有连线**：批量创建领域图谱时，图谱之间的关系没有正确创建，导致图谱地图上看不到连线
2. **背景板位置不在节点中心**：DomainBackground 组件使用错误的坐标属性计算边界，导致领域背景框位置偏移
3. **初始化过程没有成功**：批量初始化图谱时，任务创建后没有正确触发执行

## What Changes

### 问题1修复：图谱关系创建
- 修复 `/domain/batch-create` API 中的关系创建逻辑
- 确保所有图谱之间根据 `relation_type` 正确创建关系
- **BREAKING**：不再只以第一个图谱为中心，而是创建更合理的关系网络

### 问题2修复：背景板位置计算
- 修复 `DomainBackground.tsx` 使用布局后的节点坐标（`node.x`, `node.y`）
- 当前错误使用 `node.x_position` 和 `node.y_position`（这些值在图谱地图中总是0）

### 问题3修复：初始化任务执行
- 确保任务队列正确配置
- 添加任务执行的日志和错误处理
- 验证 `recursive_graph_generation` 处理器是否正确注册

## Impact

- Affected specs: 领域图谱生成功能
- Affected code:
  - `api/routes/graphs.ts` - 修复关系创建逻辑
  - `src/components/GraphMap/DomainBackground.tsx` - 修复坐标计算
  - `api/services/taskService.ts` - 验证任务执行流程
  - `api/services/taskProcessors/recursiveGraphProcessor.ts` - 验证处理器注册

## ADDED Requirements

### Requirement: 图谱关系正确创建

系统 SHALL 在批量创建领域图谱时正确创建图谱间关系。

#### Scenario: 批量创建图谱时创建关系
- **GIVEN** 用户选择多个推荐图谱进行批量创建
- **WHEN** 系统创建图谱
- **THEN** 系统根据每个图谱的 `relation_type` 创建对应的图谱关系
- **AND** `prerequisite` 类型：源图谱是目标图谱的前置知识
- **AND** `extension` 类型：源图谱是目标图谱的扩展知识
- **AND** `related` 类型：源图谱与目标图谱相关
- **AND** 所有关系都正确存储在 `graph_relations` 表中

#### Scenario: 关系方向正确
- **GIVEN** 图谱 A 标记为 `prerequisite` 类型
- **WHEN** 创建关系
- **THEN** A 是某个核心图谱的前置知识
- **AND** 关系方向为 A → 核心图谱

### Requirement: 领域背景框位置正确

系统 SHALL 正确计算领域背景框的位置。

#### Scenario: 背景框包围所有同领域节点
- **GIVEN** 多个图谱属于同一领域
- **WHEN** 渲染图谱地图
- **THEN** 领域背景框正确包围所有该领域的图谱节点
- **AND** 背景框中心位于节点的几何中心

#### Scenario: 使用布局后坐标
- **GIVEN** 节点经过力导向布局计算
- **WHEN** 计算领域背景框边界
- **THEN** 使用布局后的 `node.x` 和 `node.y` 坐标
- **AND** 不使用 `node.x_position` 和 `node.y_position`（这些值在图谱地图中无效）

### Requirement: 初始化任务正确执行

系统 SHALL 正确执行图谱初始化任务。

#### Scenario: 任务创建后立即执行
- **GIVEN** 用户选择初始化新创建的图谱
- **WHEN** 系统创建初始化任务
- **THEN** 任务立即开始执行或加入队列等待执行
- **AND** 用户可以通过任务列表查看进度

#### Scenario: 任务执行生成知识点
- **GIVEN** 初始化任务开始执行
- **WHEN** 处理器运行
- **THEN** 为图谱生成根节点、核心节点和子节点
- **AND** 节点之间正确创建边（连线）
- **AND** 任务状态更新为 completed

## MODIFIED Requirements

### Requirement: 批量创建领域图谱（修改）

系统 SHALL 在批量创建图谱时创建完整的关系网络。

#### Scenario: 创建关系网络
- **GIVEN** 用户选择了 N 个推荐图谱
- **WHEN** 批量创建完成
- **THEN** 系统识别核心图谱（如第一个或高优先级图谱）
- **AND** 其他图谱根据 `relation_type` 与核心图谱建立关系
- **AND** 关系正确存储并可在图谱地图上显示

## REMOVED Requirements

无移除的需求。
