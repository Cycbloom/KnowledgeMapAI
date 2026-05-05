# 修复图谱列表 template_type 字段缺失 Spec

## Why

后端 `graphService.listGraphs` 方法返回的数据没有包含 `template_type` 字段，导致前端 Dashboard 无法显示模板类型图标。

## What Changes

- 修改 `GraphWithCount` 接口添加 `template_type` 字段
- 修改 `listGraphsFallback` 方法返回 `template_type`
- 修改 `api/routes/graphs.ts` 中带 domain 过滤的返回数据包含 `template_type`

## Impact

- Affected code:
  - `api/services/graph/graphService.ts` - GraphWithCount 接口和 listGraphsFallback 方法
  - `api/routes/graphs.ts` - GET /graphs 路由

## ADDED Requirements

### Requirement: 图谱列表返回 template_type

系统应在图谱列表中返回 `template_type` 字段：

#### Scenario: listGraphsFallback 返回 template_type
- **WHEN** 调用 `graphService.listGraphs` 获取图谱列表
- **THEN** 返回数据包含 `template_type` 字段

#### Scenario: domain 过滤时返回 template_type
- **WHEN** 使用 domain_id 或 domain_ids 过滤图谱列表
- **THEN** 返回数据包含 `template_type` 字段
