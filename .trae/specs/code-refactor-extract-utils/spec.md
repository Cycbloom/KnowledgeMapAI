# 项目代码重构优化规范

## Why
项目中存在大量重复代码模式，包括数据转换函数、软删除逻辑、缓存失效处理等，导致代码维护困难、文件过大、修改时容易遗漏。通过提取公共工具函数和统一处理模式，可以减少代码重复、提高可维护性、降低出错风险。

## What Changes
- 提取统一的节点数据转换函数
- 创建软删除工具函数
- 封装缓存失效处理逻辑
- 统一日志输出方式
- 提取数据库查询字段常量
- 拆分过大的服务文件
- 提取 AI 调用通用模式

## Impact
- Affected specs: 无直接影响，属于内部重构
- Affected code: 
  - `api/utils/nodeHelpers.ts` - 扩展节点转换工具
  - `api/utils/softDelete.ts` - 新建软删除工具
  - `api/services/cache.ts` - 扩展缓存失效方法
  - `api/services/taskService.ts` - 拆分重构
  - `api/routes/nodes.ts` - 使用提取的工具函数
  - `api/services/graphNodeService.ts` - 使用提取的工具函数
  - `api/services/graphService.ts` - 使用提取的工具函数
  - `api/services/edgeService.ts` - 使用提取的工具函数
  - `api/services/studyService.ts` - 统一日志使用

## ADDED Requirements

### Requirement: 统一节点数据转换
系统 SHALL 提供统一的节点数据转换函数，将 `graph_nodes` + `knowledge_points` 联表查询结果转换为前端使用的 Node 格式。

#### Scenario: 转换成功
- **WHEN** 调用 `buildNodeFromGraphNode(graphNode)` 函数
- **THEN** 返回符合 Node 类型定义的对象，包含所有必要字段

#### Scenario: 空值处理
- **WHEN** 传入 null 或 undefined
- **THEN** 返回 null

### Requirement: 软删除工具函数
系统 SHALL 提供统一的软删除工具函数，自动设置 `deleted_at` 字段。

#### Scenario: 软删除成功
- **WHEN** 调用 `softDelete(supabase, tableName, id)` 函数
- **THEN** 将指定记录的 `deleted_at` 设置为当前时间戳

#### Scenario: 批量软删除
- **WHEN** 调用 `softDeleteBatch(supabase, tableName, ids)` 函数
- **THEN** 将所有指定记录的 `deleted_at` 设置为当前时间戳

### Requirement: 缓存失效封装
系统 SHALL 提供高级缓存失效方法，简化缓存清理逻辑。

#### Scenario: 图谱相关缓存失效
- **WHEN** 调用 `invalidateGraphCache(userId, graphId)` 函数
- **THEN** 清除该图谱相关的所有缓存（节点、学习路径、学习卡片等）

#### Scenario: 用户图谱列表缓存失效
- **WHEN** 调用 `invalidateUserGraphsCache(userId)` 函数
- **THEN** 清除用户的图谱列表缓存

### Requirement: 统一日志输出
系统 SHALL 在所有服务层使用统一的 logger 工具，替代 console.log/error/warn。

#### Scenario: 日志输出
- **WHEN** 服务层需要输出日志
- **THEN** 使用 `logger.info/debug/warn/error` 方法

### Requirement: 拆分任务服务
系统 SHALL 将 taskService.ts 拆分为多个专门的处理器文件，每个处理器负责一种任务类型。

#### Scenario: 任务处理器拆分
- **WHEN** 处理后台任务
- **THEN** 根据任务类型路由到对应的处理器

### Requirement: 数据库查询字段常量
系统 SHALL 提供统一的数据库查询字段常量，避免重复定义 SELECT 字段列表。

#### Scenario: 使用查询字段常量
- **WHEN** 查询 graph_nodes 表
- **THEN** 使用 `GRAPH_NODES_SELECT` 常量

## MODIFIED Requirements
无

## REMOVED Requirements
无
