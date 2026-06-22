# 安全漏洞修复 — ShareModal isOwner 硬编码与邀请 Token 过期 Spec

## Why
ShareModal 中 `isOwner` 硬编码为 `true`，导致任何能打开分享弹窗的用户（包括 viewer）都能邀请协作者、生成分享链接和移除协作者，构成权限提升漏洞。同时，邀请 token 在数据库和业务逻辑中均无过期机制，生成的分享链接永久有效，存在长期暴露风险。

## What Changes
- 修复 ShareModal 中 `isOwner` 硬编码为 `true` 的 bug，改为根据当前用户与图谱 owner 判断
- 为 `graph_collaborators` 表添加 `invitation_expires_at` 列
- 在 `generateShareLink` 中设置默认过期时间（7 天）
- 在 `acceptInvitation` 和 `joinByShareLink` 中检查 token 是否过期
- 在 `getInvitationInfo` 中检查 token 是否过期
- 自动化 `cleanupExpiredInvitations` 调用

## Impact
- Affected specs: 无
- Affected code:
  - `src/components/GraphEditor/modals/ShareModal.tsx` — 修复 isOwner 判断
  - `supabase/migrations/05_domains_and_collaboration.sql` — 添加 invitation_expires_at 列
  - `api/services/graph/collaboratorService.ts` — 过期检查逻辑
  - `api/routes/collaborators.ts` — 可能需要传递 userId 用于 isOwner 判断

## ADDED Requirements

### Requirement: ShareModal 权限判断
ShareModal SHALL 根据当前用户 ID 与图谱 owner 的比较来判断 `isOwner`，而非硬编码为 `true`。

#### Scenario: 所有者打开分享弹窗
- **WHEN** 图谱所有者打开 ShareModal
- **THEN** `isOwner` 为 `true`，显示邀请协作者和生成分享链接的 UI

#### Scenario: 非所有者打开分享弹窗
- **WHEN** 非图谱所有者（editor/viewer）打开 ShareModal
- **THEN** `isOwner` 为 `false`，隐藏邀请协作者和生成分享链接的 UI，仅显示协作者列表

### Requirement: 邀请 Token 过期机制
系统 SHALL 为通过 `generateShareLink` 生成的邀请 token 设置过期时间，默认为 7 天。

#### Scenario: 生成分享链接时设置过期时间
- **WHEN** 用户调用 `generateShareLink` 生成分享链接
- **THEN** 系统在 `graph_collaborators` 记录中设置 `invitation_expires_at` 为当前时间 + 7 天

#### Scenario: 使用未过期的 token 加入图谱
- **WHEN** 用户通过未过期的分享链接加入图谱
- **THEN** 系统正常接受邀请，用户成为协作者

#### Scenario: 使用已过期的 token 加入图谱
- **WHEN** 用户通过已过期的分享链接尝试加入图谱
- **THEN** 系统拒绝并返回"邀请链接已过期"错误

#### Scenario: 查询已过期 token 的邀请信息
- **WHEN** 用户访问已过期 token 的邀请信息页面
- **THEN** 系统返回"邀请链接已过期"提示

### Requirement: 过期邀请自动清理
系统 SHALL 在每次 `generateShareLink` 调用时自动触发过期邀请的清理。

#### Scenario: 生成新链接时清理旧邀请
- **WHEN** 用户生成新的分享链接
- **THEN** 系统自动删除所有已过期且未被接受的邀请记录

## MODIFIED Requirements

### Requirement: graph_collaborators 表结构
`graph_collaborators` 表新增 `invitation_expires_at TIMESTAMPTZ` 列，用于存储邀请 token 的过期时间。该列允许 NULL，NULL 表示通过邮箱邀请的记录（非分享链接）不设置过期时间。

### Requirement: ShareModal 组件接口
ShareModal 组件新增可选的 `userId` prop，用于判断当前用户是否为图谱所有者。当未传入 `userId` 时，默认 `isOwner` 为 `false`（安全降级）。

## REMOVED Requirements

无。
