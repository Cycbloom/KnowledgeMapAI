# Tasks

- [x] Task 1: 修复暂停任务消失问题
  - [x] SubTask 1.1: 修改 HorizontalQueue.tsx 中的 visibleTasks 逻辑，添加 paused 状态任务
  - [x] SubTask 1.2: 为暂停状态任务添加视觉区分样式

- [x] Task 2: 禁止拖动进行中任务
  - [x] SubTask 2.1: 修改 DraggableTaskCard.tsx，为进行中任务设置 isDragDisabled
  - [x] SubTask 2.2: 添加拖动禁用时的提示消息

- [x] Task 3: 创建当前任务展示区组件
  - [x] SubTask 3.1: 创建 ActiveTaskPanel.tsx 组件
  - [x] SubTask 3.2: 在 Scheduler.tsx 中集成当前任务展示区

- [x] Task 4: 实现番茄钟同步
  - [x] SubTask 4.1: 修改 useFocusStore，添加任务关联字段
  - [x] SubTask 4.2: 修改开始任务逻辑，同步启动番茄钟
  - [x] SubTask 4.3: 修改暂停任务逻辑，同步暂停番茄钟
  - [x] SubTask 4.4: 修改完成任务逻辑，同步停止番茄钟

- [x] Task 5: 运行测试和验证
  - [x] SubTask 5.1: 运行 npm run check 类型检查
  - [x] SubTask 5.2: 运行 npm run lint 代码检查

# Task Dependencies

- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 3]
- [Task 5] depends on [Task 1, Task 2, Task 3, Task 4]
