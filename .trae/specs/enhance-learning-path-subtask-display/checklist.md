# Checklist - 学习路径自动排程子任务显示优化

## 后端API增强
- [x] 任务列表API返回 subtask_count 字段
- [x] 任务列表API返回 subtask_completed 字段
- [x] 任务列表API返回 has_subtasks 字段
- [x] 任务详情API返回完整子任务列表
- [x] 子任务包含 learning_path_node_id 信息

## 前端类型定义
- [x] ScheduledTask 接口包含 subtask_count 字段
- [x] ScheduledTask 接口包含 subtask_completed 字段
- [x] ScheduledTask 接口包含 has_subtasks 字段

## 任务卡片显示
- [x] 任务卡片显示子任务进度条
- [x] 任务卡片显示 "X/Y 完成" 文字
- [x] 无子任务时不显示进度信息
- [x] 进度条有平滑动画效果

## 子任务预览功能
- [x] 任务卡片有展开/收起按钮
- [x] 展开时显示子任务列表
- [x] 子任务显示标题、状态、预计时长
- [x] 支持直接切换子任务完成状态
- [x] 子任务列表支持滚动

## 学习路径任务标识
- [x] 学习任务显示书本图标
- [x] 显示关联的学习路径名称
- [x] 点击可跳转到学习路径

## 子任务交互
- [x] 子任务完成按钮正常工作
- [x] 完成后状态立即更新
- [x] 进度条平滑更新
- [x] 子任务完成同步更新学习节点状态

## 代码质量
- [x] TypeScript 类型检查通过 (npm run check)
- [x] ESLint 代码检查通过 (npm run lint)
- [x] 无控制台错误或警告
