# Checklist

- [x] 后端 getSmartRecommendation 返回值包含 nextSubtask 和 subtaskProgress 字段
- [x] 无子任务的任务推荐时 nextSubtask=null, subtaskProgress=null（兼容）
- [x] SmartRecommendationBar 展示当前推荐子任务标题和学习状态 badge
- [x] SmartRecommendationBar 展示子任务整体进度（如 3/8）
- [x] 有子任务时"开始任务"按钮文案变为"开始学习"
- [x] 无子任务时 SmartRecommendationBar UI 保持不变
- [x] handleStartTask 启动主任务后自动激活第一个 pending 子任务
- [x] Scheduler 页面追踪当前活跃子任务状态
- [x] ActiveTaskPanel 展示当前活跃子任务信息（标题、学习状态、掌握度）
- [x] "完成此子任务"按钮能正确完成当前子任务并激活下一个
- [x] 所有子任务完成后行为正确处理
- [x] 类型检查通过（tsc --noEmit）
- [x] 代码检查通过（npm run lint）
