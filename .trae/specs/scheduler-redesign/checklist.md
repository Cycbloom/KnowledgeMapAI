# Checklist

## Phase 1: 拖拽库切换和横向队列视图

### react-beautiful-dnd 集成
- [x] @hello-pangea/dnd 依赖已安装（react-beautiful-dnd 的活跃维护分支）
- [x] @dnd-kit 相关代码已移除
- [x] DraggableTaskCard 组件正常工作
- [x] DroppableQueue 组件正常工作

### 横向队列视图
- [x] HorizontalQueueView 组件已创建
- [x] HorizontalQueue 组件正常工作
- [x] 任务卡片横向排列
- [x] 箭头连接线显示正确
- [x] 横向拖拽排序正常
- [x] 跨队列拖拽正常

### 任务卡片样式
- [x] 固定宽度（180px）正确
- [x] 拖拽抬起效果正常
- [x] 拖拽阴影效果正常
- [x] 放置落位动画正常
- [x] 空队列占位符显示正确

## Phase 2: 数据库和 API 更新

### 数据库结构
- [x] queues 表已创建
- [x] 现有用户默认队列数据已创建
- [x] scheduled_tasks.queue_id 字段已添加
- [x] 数据迁移完成（queue_level -> queue_id）
- [x] RLS 策略已添加

### API 更新
- [x] 队列 CRUD API 正常工作
- [x] 任务 API 支持 queue_id
- [x] 前端 API 服务层已更新
- [x] React Query hooks 已更新

## Phase 3: 队列配置 UI

### 队列配置组件
- [x] QueueSettings 组件已创建
- [x] 队列名称编辑正常
- [x] 颜色选择器正常工作
- [x] 时间片设置正常
- [x] 添加/删除队列功能正常

### 队列操作逻辑
- [x] 添加队列限制（最多 5 个）正常
- [x] 删除队列限制（最少 2 个）正常
- [x] 删除队列时任务迁移正常
- [x] 新用户默认 3 队列初始化正常

## Phase 4: 视图切换和优化

### 视图切换
- [x] Scheduler.tsx 支持 Tab 切换
- [x] 横向队列视图集成正常
- [x] 看板视图集成正常
- [x] 列表视图集成正常
- [x] 时间轴视图集成正常

### 视图状态管理
- [x] 视图偏好保存到 localStorage
- [ ] 滚动位置保存正常
- [x] 页面刷新后状态恢复正常

## Phase 5: 测试和验证

- [ ] scheduler-drag 测试用例已更新
- [ ] 横向队列视图测试通过
- [ ] 队列配置测试通过
- [ ] 所有测试套件通过
- [ ] 跨浏览器测试通过（Chrome、Firefox、Safari）
- [ ] 响应式布局测试通过
