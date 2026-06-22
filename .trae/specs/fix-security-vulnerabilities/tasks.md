# Tasks

- [x] Task 1: 修复 ShareModal isOwner 硬编码
  - [x] SubTask 1.1: 为 ShareModal 添加 `ownerId` 可选 prop，根据图谱 owner 判断 isOwner
  - [x] SubTask 1.2: 在调用 ShareModal 的父组件中传入图谱 owner ID
  - [x] SubTask 1.3: 当 isOwner 为 false 时隐藏邀请表单和生成分享链接按钮

- [x] Task 2: 数据库添加 invitation_expires_at 列
  - [x] SubTask 2.1: 在 `05_domains_and_collaboration.sql` 中为 `graph_collaborators` 表添加 `invitation_expires_at TIMESTAMPTZ` 列

- [x] Task 3: 后端邀请 Token 过期逻辑
  - [x] SubTask 3.1: 修改 `generateShareLink` 方法，插入记录时设置 `invitation_expires_at` 为当前时间 + 7 天
  - [x] SubTask 3.2: 修改 `acceptInvitation` 方法，检查 `invitation_expires_at` 是否已过期
  - [x] SubTask 3.3: 修改 `joinByShareLink` 方法，检查 `invitation_expires_at` 是否已过期
  - [x] SubTask 3.4: 修改 `getInvitationInfo` 方法，检查 `invitation_expires_at` 是否已过期
  - [x] SubTask 3.5: 在 `generateShareLink` 方法末尾调用 `cleanupExpiredInvitations` 实现自动清理

# Task Dependencies
- Task 2 须先于 Task 3（数据库列需先存在）
- Task 1 与 Task 2/3 无依赖，可并行
