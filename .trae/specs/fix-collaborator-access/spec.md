# 修复协作者访问图谱 Bug Spec

## Why
当前协作功能存在一个严重 bug：协作者通过分享链接访问图谱时，节点无法显示。原因是后端 `getGraph()` 方法在应用层错误地添加了 `user_id` 过滤条件，导致协作者无法获取图谱信息，进而导致节点查询失败。

## What Changes
- 修复 `graphService.getGraph()` 方法，移除应用层对 `user_id` 的硬性过滤
- 修复 `graphService.getGraphNodes()` 方法，确保协作者可以正确查询节点
- 添加协作者访问图谱的后端逻辑检查
- 更新图谱访问 API 以正确支持协作者访问

## Impact
- Affected specs: 图谱协作功能
- Affected code: 
  - `api/services/graph/graphService.ts` - getGraph 和 getGraphNodes 方法
  - `api/routes/graphs.ts` - 图谱访问路由

## ADDED Requirements

### Requirement: 协作者图谱访问
系统 SHALL 允许协作者正确访问被分享的图谱。

#### Scenario: 协作者查看图谱
- **WHEN** 协作者用户请求 `GET /api/graphs/:graphId`
- **THEN** 系统应返回图谱信息（如果用户是 owner 或已接受的协作者）

#### Scenario: 协作者查看图谱节点
- **WHEN** 协作者用户请求 `GET /api/graphs/:graphId/nodes`
- **THEN** 系统应返回图谱的所有节点和边

### Requirement: 图谱访问权限检查
系统 SHALL 在应用层正确检查图谱访问权限。

#### Scenario: 权限检查逻辑
- **WHEN** 用户请求访问图谱
- **THEN** 系统应检查：
  - 用户是否是图谱所有者（user_id 匹配）
  - 用户是否是已接受的协作者（graph_collaborators 表中有 accepted_at 不为空的记录）
  - 图谱是否公开（is_public = true）

## MODIFIED Requirements

### Requirement: getGraph 方法
原有的 `getGraph()` 方法 SHALL 修改为：
1. 首先尝试通过 RLS 策略获取图谱（依赖数据库层权限控制）
2. 如果用户已登录，检查用户是否有访问权限（owner 或 collaborator）
3. 如果图谱公开，允许匿名访问

### Requirement: getGraphNodes 方法
原有的 `getGraphNodes()` 方法 SHALL 依赖 RLS 策略进行权限控制，不再在应用层添加额外的 user_id 过滤。

## REMOVED Requirements
无移除的需求。

## Root Cause Analysis

### 问题根源
在 `graphService.getGraph()` 方法中（第 164-204 行）：

```typescript
if (userId) {
  query = query.eq("user_id", userId);  // 问题代码
}
```

这段代码在用户已登录时，强制添加 `user_id = userId` 条件，导致：
1. 协作者用户无法获取图谱信息（因为 user_id 是图谱所有者，不是协作者）
2. 回退逻辑只检查 `is_public = true`，不检查协作者关系
3. 前端获取不到图谱信息，导致后续节点查询失败

### 正确的修复方案
1. 移除应用层的 `user_id` 硬性过滤
2. 依赖 RLS 策略进行权限控制（RLS 已正确配置）
3. 在应用层添加可选的权限验证，用于返回用户角色信息
