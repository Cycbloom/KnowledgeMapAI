# 调度系统亮色/暗色模式适配计划

## 问题分析

当前调度系统（Scheduler）的UI只实现了暗色模式，使用了硬编码的暗色样式（如 `bg-slate-900`、`text-slate-400` 等），没有使用 Tailwind CSS 的 `dark:` 前缀来区分亮色和暗色模式。

项目已有完善的主题系统：
- `useTheme` hook 提供主题状态
- 通过在 `document.documentElement` 添加 `light` 或 `dark` 类切换主题
- 其他页面已使用 `dark:` 前缀实现双模式支持

## 需要修改的文件

### 1. CSS 样式文件
**文件**: `src/styles/scheduler.css`
- 添加亮色模式 CSS 变量
- 使用 `.dark` 选择器区分暗色模式样式

### 2. 组件文件
需要添加 `dark:` 前缀的组件：

| 文件 | 主要修改 |
|------|----------|
| `src/components/Scheduler/TaskCard.tsx` | 背景、文字、边框颜色 |
| `src/components/Scheduler/QueueColumn.tsx` | 背景、文字、边框颜色 |
| `src/components/Scheduler/TaskTimer.tsx` | 背景、文字、进度条颜色 |
| `src/components/Scheduler/TaskForm.tsx` | 表单背景、输入框样式 |
| `src/components/Scheduler/TaskDetail.tsx` | 详情面板背景、文字 |
| `src/components/Scheduler/TimelineView.tsx` | 时间轴背景、文字 |
| `src/components/Scheduler/KanbanView.tsx` | 看板背景、文字 |
| `src/components/Scheduler/ListView.tsx` | 列表背景、文字 |
| `src/components/Scheduler/SchedulerViews.tsx` | 视图切换按钮样式 |

### 3. 页面文件
| 文件 | 主要修改 |
|------|----------|
| `src/pages/Scheduler.tsx` | 页面背景、头部样式 |
| `src/pages/CurrentTask.tsx` | 计时器页面背景、按钮样式 |
| `src/pages/SchedulerStats.tsx` | 统计页面背景、图表样式 |

## 实现方案

### CSS 变量设计

```css
:root {
  /* 亮色模式变量 */
  --scheduler-bg: #f8fafc;
  --scheduler-card-bg: rgba(255, 255, 255, 0.9);
  --scheduler-border: rgba(148, 163, 184, 0.3);
  --scheduler-text: #1e293b;
  --scheduler-text-muted: #64748b;
  --scheduler-grid: rgba(148, 163, 184, 0.1);
}

.dark {
  /* 暗色模式变量 */
  --scheduler-bg: #0f172a;
  --scheduler-card-bg: rgba(30, 41, 59, 0.8);
  --scheduler-border: rgba(51, 65, 85, 0.5);
  --scheduler-text: #e2e8f0;
  --scheduler-text-muted: #94a3b8;
  --scheduler-grid: rgba(6, 182, 212, 0.03);
}
```

### Tailwind 类转换规则

| 暗色模式 | 亮色模式 |
|----------|----------|
| `bg-slate-900` | `bg-slate-50 dark:bg-slate-900` |
| `bg-slate-800` | `bg-white dark:bg-slate-800` |
| `text-slate-400` | `text-slate-600 dark:text-slate-400` |
| `text-white` | `text-slate-900 dark:text-white` |
| `border-slate-700` | `border-slate-200 dark:border-slate-700` |

### 科技感效果适配

亮色模式下的科技感效果：
- 保持霓虹发光效果，但降低强度
- 使用更柔和的边框颜色
- 背景使用浅色渐变
- 保持三色队列标识（cyan/emerald/amber）

## 任务列表

1. **更新 CSS 变量** - 在 `scheduler.css` 中添加亮色模式变量
2. **更新 QueueColumn 组件** - 添加亮色模式样式
3. **更新 TaskCard 组件** - 添加亮色模式样式
4. **更新 TaskTimer 组件** - 添加亮色模式样式
5. **更新 TaskForm 组件** - 添加亮色模式样式
6. **更新 Scheduler 页面** - 添加亮色模式样式
7. **更新 CurrentTask 页面** - 添加亮色模式样式
8. **更新 SchedulerStats 页面** - 添加亮色模式样式
9. **更新其他视图组件** - TimelineView, KanbanView, ListView
10. **测试验证** - 确保主题切换正常工作

## 预期效果

- 亮色模式：浅色背景、深色文字、柔和边框、保持科技感
- 暗色模式：保持现有样式
- 主题切换：平滑过渡，无闪烁
