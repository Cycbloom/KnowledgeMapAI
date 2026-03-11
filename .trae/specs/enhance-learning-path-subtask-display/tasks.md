# Tasks - 学习路径自动排程子任务显示优化

## 阶段一：后端API增强

- [x] Task 1: 增强任务列表API返回子任务统计
  - [x] 修改 `api/routes/scheduler/tasks.ts` 的任务列表接口
  - [x] 添加 `subtask_count`、`subtask_completed`、`has_subtasks` 字段
  - [x] 使用子查询或JOIN获取子任务统计信息
  - [x] 确保性能不受影响（使用数据库聚合函数）

- [x] Task 2: 增强任务详情API返回完整子任务列表
  - [x] 修改 `api/routes/scheduler/tasks.ts` 的任务详情接口
  - [x] 确保返回完整的子任务列表（包含 learning_path_node_id）
  - [x] 添加子任务关联的知识点信息

## 阶段二：前端类型定义更新

- [x] Task 3: 更新任务类型定义
  - [x] 修改 `shared/types/scheduler.ts` 中的 ScheduledTask 接口
  - [x] 添加 `subtask_count?: number` 字段
  - [x] 添加 `subtask_completed?: number` 字段
  - [x] 添加 `has_subtasks?: boolean` 字段

## 阶段三：任务卡片组件增强

- [x] Task 4: TaskCard组件添加子任务进度显示
  - [x] 在任务卡片底部添加子任务进度条
  - [x] 显示 "X/Y 完成" 格式的文字
  - [x] 添加进度条动画效果
  - [x] 仅在有子任务时显示

- [x] Task 5: TaskCard组件添加子任务预览功能
  - [x] 添加展开/收起按钮
  - [x] 展开时显示子任务列表（最多显示5个）
  - [x] 每个子任务显示标题、状态、预计时长
  - [x] 支持直接切换子任务完成状态

- [x] Task 6: 添加学习路径任务视觉标识
  - [x] 为 `task_type: "learning"` 的任务添加特殊图标
  - [x] 显示关联的学习路径名称（从 context 中解析）
  - [x] 添加点击跳转到学习路径的功能

## 阶段四：子任务交互功能

- [x] Task 7: 实现子任务快速完成功能
  - [x] 在子任务预览列表中添加完成按钮
  - [x] 调用子任务更新API
  - [x] 更新本地状态和进度
  - [x] 添加完成动画效果

- [x] Task 8: 实现子任务与学习路径节点同步
  - [x] 当子任务完成时，同步更新学习路径节点状态
  - [x] 在后端 `api/routes/scheduler/subtasks.ts` 添加同步逻辑
  - [x] 调用 `learningPathService.syncProgressWithTask` 方法

## 阶段五：测试与验证

- [x] Task 9: 类型检查与代码检查
  - [x] 运行 `npm run check` 确保类型正确
  - [x] 运行 `npm run lint` 确保代码规范

- [x] Task 10: 功能测试
  - [x] 测试任务卡片显示子任务进度
  - [x] 测试展开/收起子任务列表
  - [x] 测试快速完成子任务
  - [x] 测试学习路径任务标识显示
  - [x] 测试子任务与学习节点同步

---

# Task Dependencies

- Task 3 依赖 Task 1, Task 2
- Task 4, Task 5, Task 6 依赖 Task 3
- Task 7 依赖 Task 4, Task 5
- Task 8 依赖 Task 7
- Task 9, Task 10 依赖 Task 1-8
