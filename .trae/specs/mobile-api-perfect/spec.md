# 移动端 API 完善 - Product Requirement Document

## Overview
- **Summary**: 完善移动端 API，使其能够从 Supabase 获取真实数据，修复现有问题并实现缺失的功能。
- **Purpose**: 确保移动端 API 能够正确连接 Supabase 数据库，提供完整的图谱、学习卡片、仪表盘和统计数据功能。
- **Target Users**: 移动端用户、开发者

## Goals
- 修复 graph API 中的表名不一致问题
- 实现 graph API 中返回假数据的方法
- 完善 study API 的所有功能（学习卡片）
- 完善 dashboard API 的统计功能
- 完善 statistics API 的学习统计功能
- 确保所有移动端 API 都能正确从 Supabase 获取真实数据

## Non-Goals (Out of Scope)
- 不修改后端 API 服务器
- 不修改桌面端 API 实现
- 不重构现有架构
- 不添加新的 API 端点

## Background & Context
- 项目使用 Supabase 作为数据库
- 移动端 API 位于 `src/services/mobile/` 目录
- 现有部分 API 存在表名不一致（`graphs` vs `knowledge_graphs`）
- `study.ts`、部分 `graphs.ts` 方法返回假数据
- 需要参考后端服务实现（`api/services/` 目录）

## Functional Requirements
- **FR-1**: 修复 graphs.ts 中的表名不一致，统一使用 `knowledge_graphs`
- **FR-2**: 实现 `getNodeStatus` 方法，从 Supabase 获取节点学习状态
- **FR-3**: 实现 `getLearningPath` 方法，从 Supabase 获取学习路径
- **FR-4**: 实现 study API 的 `getCards` 方法，获取学习卡片
- **FR-5**: 实现 study API 的 `getCardsByKnowledgePoint` 方法
- **FR-6**: 实现 study API 的 `createCardsBatch` 方法
- **FR-7**: 实现 study API 的 `update`、`delete`、`deleteBatch` 方法
- **FR-8**: 实现 study API 的 `updateProgress` 方法，支持 FSRS 算法
- **FR-9**: 实现 study API 的 `getCardGroups` 方法
- **FR-10**: 实现 dashboard API 的 `getStats` 方法，获取真实统计数据
- **FR-11**: 实现 statistics API 的 `getStats` 方法，获取学习统计

## Non-Functional Requirements
- **NFR-1**: 所有 API 调用错误处理完整
- **NFR-2**: 代码风格与现有移动端 API 保持一致
- **NFR-3**: 不引入新的依赖

## Constraints
- **Technical**: 使用 Supabase JavaScript SDK，TypeScript
- **Business**: 保持与现有数据库 schema 兼容
- **Dependencies**: Supabase 客户端、共享类型定义

## Assumptions
- 数据库表结构与 schema 文件一致
- 用户已通过 Supabase Auth 认证
- Supabase 客户端正确初始化

## Acceptance Criteria

### AC-1: 修复 graphs.ts 表名不一致
- **Given**: graphs.ts 中存在表名不一致问题
- **When**: 访问 graph 相关 API
- **Then**: 所有方法都使用正确的表名 `knowledge_graphs`
- **Verification**: `programmatic`
- **Notes**: 检查所有 CRUD 操作的表名

### AC-2: 实现 getNodeStatus
- **Given**: 有一个包含学习卡片的图谱
- **When**: 调用 `getNodeStatus(graphId)`
- **Then**: 返回该图谱中节点的学习状态统计
- **Verification**: `programmatic`
- **Notes**: 返回 total_nodes 和 completed_nodes

### AC-3: 实现 getLearningPath
- **Given**: 有一个学习路径的图谱
- **When**: 调用 `getLearningPath(graphId)`
- **Then**: 返回该图谱的学习路径数据
- **Verification**: `programmatic`
- **Notes**: 返回 milestones 和 progress

### AC-4: 实现学习卡片获取 API
- **Given**: 用户有学习卡片数据
- **When**: 调用 `getCards()` 或 `getCardsByKnowledgePoint()`
- **Then**: 返回真实的学习卡片数据
- **Verification**: `programmatic`
- **Notes**: 支持参数筛选

### AC-5: 实现学习卡片 CRUD
- **Given**: 有学习卡片数据
- **When**: 调用 `update`、`delete`、`deleteBatch` 方法
- **Then**: 正确执行对应的数据库操作
- **Verification**: `programmatic`

### AC-6: 实现学习进度更新
- **Given**: 有一张学习卡片
- **When**: 调用 `updateProgress(cardId, quality)`
- **Then**: 更新卡片的 FSRS 状态并安排下次复习
- **Verification**: `programmatic`
- **Notes**: 使用 FSRS 算法计算

### AC-7: 实现仪表盘统计
- **Given**: 用户有图谱和学习数据
- **When**: 调用 `mobileDashboardApi.getStats()`
- **Then**: 返回真实的统计数据（图谱数、节点数、学习卡片数等）
- **Verification**: `programmatic`

### AC-8: 实现学习统计
- **Given**: 用户有学习数据
- **When**: 调用 `mobileStatisticsApi.getStats()`
- **Then**: 返回学习进度分布、热力图等数据
- **Verification**: `programmatic`

## Open Questions
- [ ] 是否需要实现 `getCardGroups` 方法的分组逻辑？
- [ ] `statistics API` 是否需要完整的热力图数据？
