# 继续实施 i18n 国际化计划

## 已完成工作

### Batch 1: GraphMap 组件（已完成）
- ✅ AgentAnalysisPanel.tsx
- ✅ AnalysisResultView.tsx
- ✅ AnalysisConfirmPanel.tsx
- ✅ SessionLog.tsx
- ✅ SkillSelector.tsx
- ✅ MergeSuggestionsSection.tsx

## 待完成工作

### Batch 2: Scheduler 组件（7 个文件）

#### 2.1 TimelineView.tsx
需要翻译的文本：
- "时间轴视图"
- "今天"
- "明天"
- "个任务"
- "已过期"
- "未设置截止日期"

#### 2.2 KanbanView.tsx
需要翻译的文本：
- "待办"、"进行中"、"已暂停"、"已完成"、"已取消"
- "个任务"
- "预计:"
- "暂无任务"
- "拖拽任务到此处"

#### 2.3 HorizontalQueueView.tsx
需要翻译的文本：
- "队列"、"时间轴"、"看板"、"列表"
- "紧急队列"、"重要队列"、"待办队列"

#### 2.4 ReviewTaskCard.tsx
需要翻译的文本：
- "已过期"、"今天"、"即将到期"、"计划中"
- "完全忘记" 到 "完全掌握"（6 个等级）
- "下次复习："

#### 2.5 SmartRecommendationBar.tsx
需要翻译的文本：
- "效率高峰"、"效率低谷"
- "智能推荐"
- "暂无待处理任务"

#### 2.6 TaskKnowledgeLink.tsx
需要翻译的文本：
- "关联知识点"
- "添加"
- "搜索知识点..."
- "取消"
- "主要"

### Batch 3: GraphEditor 组件（3 个文件）

#### 3.1 ExportDialog.tsx
需要翻译的文本：
- "导出 PDF 报告"
- "无截图预览"
- "导出选项"
- "取消"
- "生成中..."

#### 3.2 MindMapNode.tsx
需要翻译的文本：
- "未命名"

#### 3.3 MindMapCanvas.tsx
需要翻译的文本：
- "暂无节点"
- "正在加载思维导图..."

### Batch 4: 其他组件（根据搜索结果补充）

需要搜索确认的其他组件：
- Dialog 组件中的硬编码文本
- Toast 通知消息
- 错误提示信息

## 实施步骤

### 步骤 1: 更新 Scheduler 组件
1. 为每个 Scheduler 组件添加 `useTranslation` hook
2. 替换硬编码中文文本为 `t('scheduler.xxx')` 格式
3. 更新语言文件添加 `scheduler` 模块的翻译键

### 步骤 2: 更新 GraphEditor 组件
1. 为 ExportDialog、MindMapNode、MindMapCanvas 添加 i18n
2. 更新语言文件添加 `graphEditor` 模块的翻译键

### 步骤 3: 搜索并处理其他组件
1. 使用 Grep 搜索剩余的中文文本
2. 逐个处理发现的组件

### 步骤 4: 验证
1. 运行 `npm run check` 类型检查
2. 运行 `npm run lint` 代码检查
3. 手动测试语言切换功能

## 翻译键命名规范

```
scheduler.timeline.viewTitle
scheduler.timeline.today
scheduler.timeline.tomorrow
scheduler.timeline.tasks
scheduler.timeline.overdue
scheduler.timeline.noDueDate

scheduler.kanban.todo
scheduler.kanban.inProgress
scheduler.kanban.paused
scheduler.kanban.completed
scheduler.kanban.cancelled
scheduler.kanban.estimated
scheduler.kanban.noTasks
scheduler.kanban.dragHere

scheduler.queue.queue
scheduler.queue.timeline
scheduler.queue.kanban
scheduler.queue.list
scheduler.queue.urgent
scheduler.queue.important
scheduler.queue.todo

scheduler.review.overdue
scheduler.review.today
scheduler.review.upcoming
scheduler.review.planned
scheduler.review.quality.0-5
scheduler.review.nextReview

scheduler.recommendation.peakEfficiency
scheduler.recommendation.lowEfficiency
scheduler.recommendation.title
scheduler.recommendation.noPendingTasks

scheduler.taskLink.linkedKnowledge
scheduler.taskLink.add
scheduler.taskLink.searchPlaceholder
scheduler.taskLink.cancel
scheduler.taskLink.primary

graphEditor.export.title
graphEditor.export.noPreview
graphEditor.export.options
graphEditor.export.cancel
graphEditor.export.generating

graphEditor.mindMap.unnamed
graphEditor.mindMap.noNodes
graphEditor.mindMap.loading
```
