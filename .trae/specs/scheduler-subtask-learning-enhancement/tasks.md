# Tasks

- [x] Task 1: 后端 — 扩展智能推荐 API 返回子任务信息
  - [x] 修改 `taskRecommendationService.getSmartRecommendation` 方法：在返回 recommendedTask 时，查询该任务的子任务列表
  - [x] 计算并附加 `nextSubtask`（第一个 pending 子任务）和 `subtaskProgress`（total/completed）字段
  - [x] 确保对无子任务的任务兼容（nextSubtask=null, subtaskProgress=null）

- [x] Task 2: 前端类型与 API 层适配
  - [x] 在 SmartRecommendationBar 接口中扩展 task 类型，添加 nextSubtask 和 subtaskProgress 字段
  - [x] 确认前端 API 调用层无需改动（复用现有 getSmartRecommendation）

- [x] Task 3: SmartRecommendationBar UI 增强
  - [x] 当推荐任务有子任务时，在主任务标题下方展示当前推荐子任务标题 + 学习状态 badge
  - [x] 添加子任务进度展示（如 "子任务 3/8"）
  - [x] "开始任务"按钮文案动态调整（有子任务 → "开始学习"）
  - [x] 无子任务时保持原有 UI 不变

- [x] Task 4: Scheduler 页面启动逻辑增强
  - [x] 修改 handleStartTask：启动主任务后，自动将第一个 pending 子任务标记为 in_progress
  - [x] 新增当前活跃子任务状态追踪（activeSubtask state）
  - [x] 将 activeSubtask 传递给 ActiveTaskPanel

- [x] Task 5: ActiveTaskPanel 子任务展示增强
  - [x] 新增 props：activeSubtaskId, onSubtaskComplete
  - [x] 在主任务信息下方渲染当前活跃子任务区域（标题、学习状态 badge、掌握度进度条）
  - [x] 添加"完成此子任务"按钮，点击后完成当前子任务并激活下一个
  - [x] 添加可折叠的子任务列表概览

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 2]
- [Task 4] depends on [Task 2]
- [Task 5] depends on [Task 4]
