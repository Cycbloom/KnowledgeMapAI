# Tasks

## Phase 1: 拖拽库切换和横向队列视图 (P0)

- [x] Task 1: 切换到 react-beautiful-dnd
  - [x] SubTask 1.1: 安装 @hello-pangea/dnd 依赖（react-beautiful-dnd 的活跃维护分支）
  - [x] SubTask 1.2: 移除 @dnd-kit 相关代码
  - [x] SubTask 1.3: 创建新的 DraggableTaskCard 组件
  - [x] SubTask 1.4: 创建新的 DroppableQueue 组件

- [x] Task 2: 实现横向队列视图
  - [x] SubTask 2.1: 创建 HorizontalQueueView 组件框架
  - [x] SubTask 2.2: 实现单个横向队列组件（HorizontalQueue）
  - [x] SubTask 2.3: 添加任务卡片之间的箭头连接线
  - [x] SubTask 2.4: 实现横向拖拽排序
  - [x] SubTask 2.5: 实现跨队列拖拽

- [x] Task 3: 优化任务卡片样式
  - [x] SubTask 3.1: 设计固定宽度任务卡片（180px）
  - [x] SubTask 3.2: 添加拖拽抬起和阴影效果
  - [x] SubTask 3.3: 实现放置落位动画
  - [x] SubTask 3.4: 添加空队列占位符

## Phase 2: 数据库和 API 更新 (P1)

- [x] Task 4: 数据库结构调整
  - [x] SubTask 4.1: 创建 queues 表
  - [x] SubTask 4.2: 为现有用户创建默认队列数据
  - [x] SubTask 4.3: 添加 scheduled_tasks.queue_id 字段
  - [x] SubTask 4.4: 迁移现有数据（queue_level -> queue_id）
  - [x] SubTask 4.5: 添加 RLS 策略

- [x] Task 5: API 更新
  - [x] SubTask 5.1: 新增队列 CRUD API（创建、读取、更新、删除）
  - [x] SubTask 5.2: 修改任务 API 支持 queue_id
  - [x] SubTask 5.3: 更新前端 API 服务层
  - [ ] SubTask 5.4: 更新 React Query hooks

## Phase 3: 队列配置 UI (P1)

- [x] Task 6: 队列配置组件
  - [x] SubTask 6.1: 创建 QueueSettings 组件
  - [x] SubTask 6.2: 实现队列名称编辑
  - [x] SubTask 6.3: 实现颜色选择器
  - [x] SubTask 6.4: 实现时间片设置
  - [x] SubTask 6.5: 实现添加/删除队列功能

- [x] Task 7: 队列操作逻辑
  - [x] SubTask 7.1: 实现添加队列逻辑（限制 2-5 个）
  - [x] SubTask 7.2: 实现删除队列逻辑（任务迁移）
  - [x] SubTask 7.3: 添加队列数量限制提示
  - [x] SubTask 7.4: 实现新用户默认 3 队列初始化

## Phase 4: 视图切换和优化 (P2)

- [x] Task 8: 视图切换实现
  - [x] SubTask 8.1: 重构 Scheduler.tsx 支持 Tab 切换
  - [x] SubTask 8.2: 整合横向队列视图
  - [x] SubTask 8.3: 整合看板视图
  - [x] SubTask 8.4: 整合列表视图
  - [x] SubTask 8.5: 整合时间轴视图

- [x] Task 9: 视图状态管理
  - [x] SubTask 9.1: 保存视图偏好到 localStorage
  - [ ] SubTask 9.2: 保存滚动位置
  - [x] SubTask 9.3: 页面刷新后恢复状态

## Phase 5: 测试和验证

- [ ] Task 10: 更新自动化测试
  - [ ] SubTask 10.1: 更新 scheduler-drag 测试用例适配新拖拽库
  - [ ] SubTask 10.2: 添加横向队列视图测试
  - [ ] SubTask 10.3: 添加队列配置测试
  - [ ] SubTask 10.4: 运行完整测试套件

# Task Dependencies

- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1]
- [Task 5] depends on [Task 4]
- [Task 6] depends on [Task 5]
- [Task 7] depends on [Task 6]
- [Task 8] depends on [Task 2, Task 3]
- [Task 9] depends on [Task 8]
- [Task 10] depends on [Task 1, Task 2, Task 4, Task 5, Task 6, Task 8]
