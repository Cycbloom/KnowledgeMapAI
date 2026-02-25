# Tasks

## Phase 1: 修复目标位置计算

- [x] Task 1: 修复同队列排序目标位置计算
  - [x] SubTask 1.1: 在 handleDragEnd 中处理 targetIndex === -1 的情况
  - [x] SubTask 1.2: 当拖拽到空白区域时，默认移动到队列末尾
  - [x] SubTask 1.3: 测试拖拽到其他任务和空白区域两种情况

## Phase 2: 修复状态管理问题

- [x] Task 2: 修复移回原队列后无法拖动的问题
  - [x] SubTask 2.1: 检查 localQueues 状态清除逻辑
  - [x] SubTask 2.2: 确保所有 ref 在操作完成后正确重置
  - [x] SubTask 2.3: 添加强制数据刷新机制

## Phase 3: 清理和验证

- [x] Task 3: 清理调试日志
  - [x] SubTask 3.1: 移除 console.log 调试语句
  - [x] SubTask 3.2: 运行类型检查

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 2]
