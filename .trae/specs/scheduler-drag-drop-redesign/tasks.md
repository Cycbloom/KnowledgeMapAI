# Tasks

## Phase 1: 分析现有代码问题

- [x] Task 1: 分析当前拖拽实现的问题
  - [x] SubTask 1.1: 检查 DndContext 和 SortableContext 的配置
  - [x] SubTask 1.2: 分析 handleDragStart、handleDragOver、handleDragEnd 的事件流
  - [x] SubTask 1.3: 确认 useSortable hook 的使用是否正确

## Phase 2: 重构 Scheduler.tsx

- [x] Task 2: 重构 Scheduler.tsx 的拖拽逻辑
  - [x] SubTask 2.1: 修改 handleDragEnd 正确处理同队列排序
  - [x] SubTask 2.2: 修改 handleDragEnd 正确处理跨队列移动
  - [x] SubTask 2.3: 添加 handleDragCancel 处理取消操作
  - [x] SubTask 2.4: 优化 handleDragOver 提供实时视觉反馈
  - [x] SubTask 2.5: 使用 currentQueueRef 和 overIndex 正确计算插入位置

## Phase 3: 重构 QueueColumn.tsx

- [x] Task 3: 重构 QueueColumn.tsx 的拖拽支持
  - [x] SubTask 3.1: 确保 useDroppable 正确配置用于跨队列检测
  - [x] SubTask 3.2: 确保 SortableContext 正确包装任务列表
  - [x] SubTask 3.3: 添加拖拽悬停时的视觉样式
  - [x] SubTask 3.4: 处理空队列的拖放区域

## Phase 4: 重构 TaskCard.tsx

- [x] Task 4: 重构 TaskCard.tsx 的拖拽功能
  - [x] SubTask 4.1: 正确配置 useSortable hook
  - [x] SubTask 4.2: 处理 CSS.Transform 实现平滑拖拽动画
  - [x] SubTask 4.3: 添加拖拽状态样式（透明度、阴影、缩放）
  - [x] SubTask 4.4: 确保拖拽时 z-index 正确

## Phase 5: 测试与验证

- [x] Task 5: 测试拖拽功能
  - [x] SubTask 5.1: 测试同队列内任务排序
  - [x] SubTask 5.2: 测试跨队列任务移动
  - [x] SubTask 5.3: 测试拖拽到空队列
  - [x] SubTask 5.4: 测试拖拽取消（Escape 键）
  - [x] SubTask 5.5: 验证 API 请求正确发送
  - [x] SubTask 5.6: 运行类型检查 npm run check

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 1]
- [Task 5] depends on [Task 2, Task 3, Task 4]
