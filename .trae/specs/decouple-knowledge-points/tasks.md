# Tasks

- [x] Task 1: 创建数据库迁移文件
  - [x] SubTask 1.1: 创建 knowledge_points 表
  - [x] SubTask 1.2: 创建 graph_nodes 关联表
  - [x] SubTask 1.3: 修改 edges 表结构（添加新字段，保留旧字段兼容）
  - [x] SubTask 1.4: 修改 study_cards 表结构
  - [x] SubTask 1.5: 创建数据迁移脚本（将现有 nodes 数据迁移到新表）
  - [x] SubTask 1.6: 添加必要的索引
  - [x] SubTask 1.7: 更新 RLS 策略

- [x] Task 2: 更新 TypeScript 类型定义
  - [x] SubTask 2.1: 添加 KnowledgePoint 类型
  - [x] SubTask 2.2: 添加 GraphNode 类型
  - [x] SubTask 2.3: 修改 Node 类型为组合类型（兼容现有代码）
  - [x] SubTask 2.4: 更新 Edge 类型定义

- [x] Task 3: 更新后端 API 服务
  - [x] SubTask 3.1: 创建 knowledgePointsApi 服务
  - [x] SubTask 3.2: 修改 nodesApi 以适配新架构
  - [x] SubTask 3.3: 更新 edgesApi

- [x] Task 4: 更新前端 Hooks 和组件
  - [x] SubTask 4.1: 更新 useGraphNodeOperations hook
  - [x] SubTask 4.2: 更新图谱编辑器组件
  - [x] SubTask 4.3: 更新节点渲染逻辑

- [x] Task 5: 实现 AI 自动复用知识点功能
  - [x] SubTask 5.1: 创建知识点语义相似度搜索 API
  - [x] SubTask 5.2: 实现手动创建时的知识点匹配提示组件
  - [x] SubTask 5.3: 修改 AI 生成图谱逻辑，集成知识点复用
  - [x] SubTask 5.4: 实现知识点复用确认对话框组件
  - [x] SubTask 5.5: 添加复用知识点的相似度阈值配置

- [x] Task 6: 实现知识点删除机制
  - [x] SubTask 6.1: 创建软删除 API（删除 graph_nodes 关联）
  - [x] SubTask 6.2: 创建硬删除 API（彻底删除知识点）
  - [x] SubTask 6.3: 实现删除确认对话框（展示影响范围）
  - [x] SubTask 6.4: 添加删除操作的 UI 交互（右键菜单选项）

- [x] Task 7: 实现卡组区分功能
  - [x] SubTask 7.1: 修改 study_cards 表添加 source_graph_id 字段
  - [x] SubTask 7.2: 创建按图谱筛选卡片的 API
  - [x] SubTask 7.3: 实现卡组筛选 UI 组件

- [x] Task 8: 实现知识点可见性与公共知识点管理
  - [x] SubTask 8.1: 添加 knowledge_points 表的 visibility 和 owner_id 字段
  - [x] SubTask 8.2: 创建公共知识点查询 API
  - [x] SubTask 8.3: 实现知识点可见性切换 UI
  - [x] SubTask 8.4: 创建知识点建议提交 API
  - [x] SubTask 8.5: 实现自动审核逻辑（内容质量、重复检测）
  - [x] SubTask 8.6: 创建管理员审核界面
  - [x] SubTask 8.7: 实现公共知识点更新通知机制

- [x] Task 9: 实现联立视图功能
  - [x] SubTask 9.1: 创建联立视图数据查询 API
  - [x] SubTask 9.2: 在图谱地图页面添加联立视图入口
  - [x] SubTask 9.3: 在图谱列表页添加联立视图入口
  - [x] SubTask 9.4: 创建联立视图页面组件
  - [x] SubTask 9.5: 实现多图谱选择器组件
  - [x] SubTask 9.6: 实现共享知识点识别与合并逻辑
  - [x] SubTask 9.7: 实现联立视图渲染（不同图谱颜色区分）
  - [x] SubTask 9.8: 实现联立视图交互（高亮、筛选、布局切换）
  - [x] SubTask 9.9: 实现联立视图编辑功能（提示影响范围）
  - [x] SubTask 9.10: 添加联立视图布局算法（分组/融合/网络模式）

- [x] Task 10: 数据迁移验证
  - [x] SubTask 10.1: 编写迁移验证脚本
  - [x] SubTask 10.2: 测试数据完整性

- [x] Task 11: 迁移文件整理（2026-02-21）
  - [x] SubTask 11.1: 重写 initial_schema.sql，移除 nodes 表
  - [x] SubTask 11.2: 删除冗余迁移文件（4个）
  - [x] SubTask 11.3: 更新 specs 文档

# Task Dependencies

- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 2]
- [Task 4] depends on [Task 3]
- [Task 5] depends on [Task 3]
- [Task 6] depends on [Task 3, Task 4]
- [Task 7] depends on [Task 1, Task 3]
- [Task 8] depends on [Task 1, Task 3]
- [Task 9] depends on [Task 3, Task 4]
- [Task 10] depends on [Task 1, Task 4, Task 5, Task 6, Task 7, Task 8, Task 9]
- [Task 11] depends on [Task 10]
