# Tasks

- [x] Task 1: 数据库层 - 创建协作者表和索引
  - [x] SubTask 1.1: 在 schema.sql 中添加 `graph_collaborators` 表定义
  - [x] SubTask 1.2: 添加协作者角色枚举类型
  - [x] SubTask 1.3: 创建协作者表相关索引
  - [x] SubTask 1.4: 添加协作者表的 RLS 策略

- [x] Task 2: 数据库层 - 更新图谱相关表的 RLS 策略
  - [x] SubTask 2.1: 更新 knowledge_graphs 表的 RLS 策略以支持协作者访问
  - [x] SubTask 2.2: 更新 graph_nodes 表的 RLS 策略以支持协作者访问
  - [x] SubTask 2.3: 更新 edges 表的 RLS 策略以支持协作者访问

- [x] Task 3: 类型定义 - 添加协作者相关类型
  - [x] SubTask 3.1: 在 shared/types/graph.ts 中添加 CollaboratorRole 类型
  - [x] SubTask 3.2: 添加 GraphCollaborator 接口
  - [x] SubTask 3.3: 添加协作者相关的 API 请求/响应类型

- [x] Task 4: 后端 API - 协作者管理服务
  - [x] SubTask 4.1: 创建 api/services/graph/collaboratorService.ts 服务文件
  - [x] SubTask 4.2: 实现获取协作者列表功能
  - [x] SubTask 4.3: 实现邀请协作者功能
  - [x] SubTask 4.4: 实现更新协作者角色功能
  - [x] SubTask 4.5: 实现移除协作者功能
  - [x] SubTask 4.6: 实现接受邀请功能

- [x] Task 5: 后端 API - 协作者路由
  - [x] SubTask 5.1: 创建 api/routes/collaborators.ts 路由文件
  - [x] SubTask 5.2: 实现 GET /api/graphs/:graphId/collaborators 端点
  - [x] SubTask 5.3: 实现 POST /api/graphs/:graphId/collaborators 端点
  - [x] SubTask 5.4: 实现 PATCH /api/graphs/:graphId/collaborators/:userId 端点
  - [x] SubTask 5.5: 实现 DELETE /api/graphs/:graphId/collaborators/:userId 端点
  - [x] SubTask 5.6: 实现 POST /api/collaborations/:invitationId/accept 端点

- [x] Task 6: 后端 API - 更新图谱服务
  - [x] SubTask 6.1: 修改 graphService.ts 以支持协作者图谱查询
  - [x] SubTask 6.2: 更新图谱列表查询以包含协作图谱
  - [x] SubTask 6.3: 添加权限检查辅助函数

- [x] Task 7: 后端 API - 分享邀请功能
  - [x] SubTask 7.1: 实现分享链接生成功能
  - [x] SubTask 7.2: 实现通过分享链接加入功能
  - [x] SubTask 7.3: 添加邀请过期机制

- [x] Task 8: 前端 - 协作者管理组件
  - [x] SubTask 8.1: 创建协作者列表组件
  - [x] SubTask 8.2: 创建邀请协作者对话框组件
  - [x] SubTask 8.3: 创建分享链接组件

- [x] Task 9: 前端 - 集成协作者功能
  - [x] SubTask 9.1: 在图谱页面添加分享按钮
  - [x] SubTask 9.2: 在图谱标题栏显示协作者头像
  - [x] SubTask 9.3: 更新图谱列表以显示协作图谱

- [x] Task 10: 测试验证
  - [x] SubTask 10.1: 重置数据库并验证表结构
  - [x] SubTask 10.2: 测试协作者邀请流程
  - [x] SubTask 10.3: 测试权限控制
  - [x] SubTask 10.4: 运行 lint 和 typecheck

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 4] depends on [Task 3]
- [Task 5] depends on [Task 4]
- [Task 6] depends on [Task 1, Task 2]
- [Task 7] depends on [Task 4]
- [Task 8] depends on [Task 3]
- [Task 9] depends on [Task 8]
- [Task 10] depends on [Task 1, Task 2, Task 3, Task 4, Task 5, Task 6, Task 7, Task 8, Task 9]
