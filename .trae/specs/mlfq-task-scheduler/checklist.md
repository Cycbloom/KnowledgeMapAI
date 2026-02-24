# Checklist

## 数据库设计
- [ ] `scheduled_tasks` 表创建成功，包含必要字段（id, user_id, title, description, queue_level, position, estimated_duration, actual_duration, deadline, status, tags, knowledge_point_id, created_at, updated_at, deleted_at）
- [ ] `task_executions` 表创建成功，包含必要字段（id, task_id, user_id, started_at, ended_at, duration, queue_level, status）
- [ ] `task_tags` 表创建成功，包含必要字段（id, user_id, name, color, created_at）
- [ ] `task_settings` 表创建成功，包含必要字段（id, user_id, q0_time_slice, q1_time_slice, q2_time_slice, break_duration, sound_enabled, notification_enabled）
- [ ] 数据库索引和约束正确设置

## 后端服务
- [ ] `schedulerService.ts` 实现三层反馈队列调度算法
- [ ] 任务创建接口正常工作，新任务自动进入Q0队列
- [ ] 任务时间片用尽后自动降级到下一级队列
- [ ] 任务CRUD操作正常工作
- [ ] 任务执行记录正确保存
- [ ] 任务统计查询接口返回正确数据

## API路由
- [ ] POST /api/scheduler/tasks - 创建任务
- [ ] GET /api/scheduler/tasks - 获取任务列表
- [ ] PUT /api/scheduler/tasks/:id - 更新任务
- [ ] DELETE /api/scheduler/tasks/:id - 删除任务
- [ ] POST /api/scheduler/tasks/:id/start - 开始任务
- [ ] POST /api/scheduler/tasks/:id/pause - 暂停任务
- [ ] POST /api/scheduler/tasks/:id/complete - 完成任务
- [ ] PUT /api/scheduler/tasks/:id/move - 移动任务到其他队列
- [ ] PUT /api/scheduler/tasks/reorder - 重新排序任务
- [ ] GET /api/scheduler/stats - 获取统计数据
- [ ] GET /api/scheduler/history - 获取执行历史

## 前端组件
- [ ] TaskCard 组件正确显示任务信息
- [ ] QueueColumn 组件正确显示队列中的任务列表
- [ ] TaskTimer 组件正确显示倒计时
- [ ] TaskForm 组件支持任务创建和编辑
- [ ] TaskDetail 组件正确显示任务详情

## 页面功能
- [ ] 任务调度主页面正确显示三列队列视图
- [ ] 拖拽排序功能正常工作
- [ ] 任务自动调度逻辑正确执行
- [ ] 当前任务视图正确显示正在执行的任务
- [ ] 番茄钟计时器正确计时
- [ ] 休息提醒功能正常工作
- [ ] 任务完成确认流程正常工作
- [ ] 执行历史页面正确显示历史记录
- [ ] 统计仪表盘正确显示统计数据
- [ ] 热力图正确显示时间分布
- [ ] 效率分析图表正确显示

## 科技感UI
- [ ] 科技感主题CSS变量正确设置
- [ ] 简约线条设计风格正确实现
- [ ] 动态流动效果动画正确显示
- [ ] 数据可视化仪表盘样式正确
- [ ] 时间轴视图正确实现
- [ ] 看板视图正确实现
- [ ] 列表视图正确实现

## 提醒功能
- [ ] 浏览器通知正常发送
- [ ] 声音提示正常播放
- [ ] 截止日期提醒正常工作
- [ ] 休息提醒正常工作

## 系统集成
- [ ] 知识图谱关联功能正常工作
- [ ] 学习卡片关联功能正常工作
- [ ] 成就系统集成正常工作
- [ ] 路由配置正确
