# 图谱协作功能 Spec

## Why
当前知识图谱仅支持单用户私有使用，无法实现团队知识共建。添加协作功能可以让多个用户共同编辑同一个知识图谱，大幅提升产品的团队协作价值和市场竞争力。

## What Changes
- 新增 `graph_collaborators` 表存储图谱协作者关系
- 新增协作者角色权限系统（owner/editor/viewer）
- 修改图谱访问的 RLS 策略以支持协作者访问
- 新增协作者管理 API 端点
- 新增分享邀请功能
- 前端新增协作者管理界面

## Impact
- Affected specs: 知识图谱访问控制、用户权限系统
- Affected code: 
  - `supabase/migrations/00000000000000_initial_schema.sql`
  - `api/routes/graphs.ts`
  - `api/services/graph/graphService.ts`
  - `api/middleware/auth.ts`
  - `shared/types/graph.ts`
  - 前端图谱相关组件

## ADDED Requirements

### Requirement: 协作者数据模型
系统 SHALL 提供 `graph_collaborators` 表存储图谱与用户的协作关系。

#### Scenario: 协作者表结构
- **WHEN** 系统初始化数据库
- **THEN** 创建 `graph_collaborators` 表，包含以下字段：
  - `graph_id`: 关联的知识图谱 ID
  - `user_id`: 协作者用户 ID
  - `role`: 协作者角色（owner/editor/viewer）
  - `invited_by`: 邀请者用户 ID
  - `invited_at`: 邀请时间
  - `accepted_at`: 接受邀请时间
  - `created_at`: 创建时间

### Requirement: 协作者角色权限
系统 SHALL 根据协作者角色提供不同的操作权限。

#### Scenario: Owner 权限
- **WHEN** 用户是图谱的 owner
- **THEN** 用户拥有完全控制权限，包括：
  - 查看、编辑、删除图谱
  - 管理协作者（邀请、移除、修改角色）
  - 转移所有权
  - 删除图谱

#### Scenario: Editor 权限
- **WHEN** 用户是图谱的 editor
- **THEN** 用户拥有编辑权限，包括：
  - 查看图谱
  - 添加、编辑、删除节点和边
  - 编辑图谱设置
  - 不能管理协作者或删除图谱

#### Scenario: Viewer 权限
- **WHEN** 用户是图谱的 viewer
- **THEN** 用户仅拥有查看权限，包括：
  - 查看图谱内容
  - 不能进行任何编辑操作

### Requirement: 协作者管理 API
系统 SHALL 提供协作者管理 API 端点。

#### Scenario: 获取协作者列表
- **WHEN** owner 或 editor 请求 `GET /api/graphs/:graphId/collaborators`
- **THEN** 返回图谱的所有协作者列表

#### Scenario: 邀请协作者
- **WHEN** owner 请求 `POST /api/graphs/:graphId/collaborators` 并提供用户邮箱和角色
- **THEN** 创建协作者记录并发送邀请通知

#### Scenario: 更新协作者角色
- **WHEN** owner 请求 `PATCH /api/graphs/:graphId/collaborators/:userId` 并提供新角色
- **THEN** 更新协作者角色

#### Scenario: 移除协作者
- **WHEN** owner 请求 `DELETE /api/graphs/:graphId/collaborators/:userId`
- **THEN** 删除协作者记录

#### Scenario: 接受邀请
- **WHEN** 被邀请用户请求 `POST /api/collaborations/:invitationId/accept`
- **THEN** 更新协作者记录的 accepted_at 字段

### Requirement: 图谱访问控制更新
系统 SHALL 更新图谱相关表的 RLS 策略以支持协作者访问。

#### Scenario: 协作者查看图谱
- **WHEN** 用户是图谱的协作者（任何角色）
- **THEN** 用户可以查看该图谱及其节点和边

#### Scenario: 协作者编辑图谱内容
- **WHEN** 用户是图谱的 editor 或 owner
- **THEN** 用户可以编辑该图谱的节点和边

### Requirement: 分享邀请功能
系统 SHALL 提供图谱分享邀请功能。

#### Scenario: 生成分享链接
- **WHEN** owner 请求生成分享链接
- **THEN** 返回包含图谱 ID 和邀请码的分享链接

#### Scenario: 通过链接加入
- **WHEN** 用户通过分享链接访问图谱
- **THEN** 自动添加为 viewer 或显示邀请确认页面

### Requirement: 协作者界面
系统 SHALL 在前端提供协作者管理界面。

#### Scenario: 分享对话框
- **WHEN** 用户点击分享按钮
- **THEN** 显示分享对话框，包含：
  - 协作者列表
  - 邀请新协作者表单
  - 分享链接生成

#### Scenario: 协作者头像显示
- **WHEN** 查看图谱时
- **THEN** 在图谱标题栏显示协作者头像列表

## MODIFIED Requirements

### Requirement: 图谱所有权
原有的图谱 user_id 字段 SHALL 保持为图谱创建者（owner），同时通过 graph_collaborators 表支持多协作者。

### Requirement: 图谱列表查询
图谱列表查询 SHALL 同时返回：
- 用户拥有的图谱
- 用户作为协作者参与的图谱

## REMOVED Requirements
无移除的需求。
