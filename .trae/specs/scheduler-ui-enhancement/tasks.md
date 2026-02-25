# Tasks

## Phase 1: 修复当前问题

- [x] Task 1: 修复拖拽排序 API 验证错误
  - [x] SubTask 1.1: 检查后端服务器是否重启
  - [x] SubTask 1.2: 验证路由顺序修复是否生效
  - [x] SubTask 1.3: 测试同队列排序功能

- [x] Task 2: 清理调试日志
  - [x] SubTask 2.1: 移除 Scheduler.tsx 中的 console.log
  - [x] SubTask 2.2: 移除 scheduler.ts API 文件中的 console.log

## Phase 2: 拖拽动画优化

- [x] Task 3: 添加拖拽占位符效果
  - [x] SubTask 3.1: 在 TaskCard 中添加拖拽时的占位符样式
  - [x] SubTask 3.2: 使用 DragOverlay 显示拖拽中的卡片
  - [x] SubTask 3.3: 添加插入位置指示器

- [x] Task 4: 优化拖拽动画
  - [x] SubTask 4.1: 添加卡片移动动画（framer-motion layout）
  - [x] SubTask 4.2: 添加队列高亮动画
  - [x] SubTask 4.3: 优化拖拽手柄视觉反馈

## Phase 3: 任务卡片 UI 优化

- [x] Task 5: 重构任务卡片布局
  - [x] SubTask 5.1: 将操作按钮移到卡片底部专用区域
  - [x] SubTask 5.2: 确保按钮不遮挡描述文字
  - [x] SubTask 5.3: 优化卡片内容布局和间距

- [x] Task 6: 增强卡片视觉效果
  - [x] SubTask 6.1: 优化不同队列的颜色标识
  - [x] SubTask 6.2: 添加状态徽章样式
  - [x] SubTask 6.3: 添加优先级视觉指示

## Phase 4: 多视图切换（可选，根据需求优先级）

- [ ] Task 7: 恢复视图切换功能
  - [ ] SubTask 7.1: 添加视图切换按钮组
  - [ ] SubTask 7.2: 实现看板视图（当前视图）
  - [ ] SubTask 7.3: 实现时间轴视图
  - [ ] SubTask 7.4: 实现列表视图

## Phase 5: 链表排序结构（可选，需要数据库迁移）

- [ ] Task 8: 设计链表排序数据结构
  - [ ] SubTask 8.1: 添加 prev_id 和 next_id 字段到数据库
  - [ ] SubTask 8.2: 更新 API 服务层
  - [ ] SubTask 8.3: 更新前端逻辑

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 2]
- [Task 4] depends on [Task 3]
- [Task 5] can run in parallel with [Task 3]
- [Task 6] depends on [Task 5]
- [Task 7] depends on [Task 4]
- [Task 8] depends on [Task 7] (可选)
