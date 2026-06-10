# 修复任务调度器"查看详情"按钮无法点击问题

## 问题总结

任务调度器的智能推荐卡片中，点击"查看详情"按钮无反应。

## 根因分析

**不是路由问题**——路由 `/scheduler/task/:taskId` 在 App.tsx 中已正确配置。

**真正原因：数据源不一致导致静默失败**

调用链路：
1. `SmartRecommendationBar.tsx:149` — 点击"查看详情"，调用 `onViewTask(taskId)`
2. `Scheduler.tsx:622-625` — 回调中先用 `findTaskById(taskId)` 在本地队列 (`allTasks`) 中查找
3. **关键**：如果找不到（推荐 API 返回的任务不在当前加载的队列中），`if (task)` 为 false，导航不执行且无任何提示

```tsx
// Scheduler.tsx 第 622-625 行 —— 问题代码
onViewTask={(taskId) => {
  const task = findTaskById(taskId);   // 可能在 allTasks 中找不到
  if (task) handleViewTaskDetail(task); // 找不到就什么都不做！
}}
```

## 修复方案

修改 `Scheduler.tsx` 第 622-625 行，改为直接用 taskId 导航，不依赖本地队列查找：

```tsx
// 修复后
onViewTask={(taskId) => {
  navigate(`/scheduler/task/${taskId}`);
}}
```

### 修改文件

**`d:\KnowledgeMap\src\pages\Scheduler.tsx`** 第 622-625 行

将 `onViewTask` 回调从条件查找+导航 改为 直接导航。

## 验证步骤

1. 启动开发服务器
2. 进入任务调度器页面
3. 确认智能推荐卡片显示正常
4. 点击"查看详情"按钮，应正确跳转到 `/scheduler/task/{id}` 详情页
