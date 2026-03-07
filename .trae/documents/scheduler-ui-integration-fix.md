# 任务调度器 UI 集成修复计划

## 问题分析

### 问题 1：任务详情页面无入口
- **现状**：`TaskDetailPanel` 组件已创建，但未被任何地方使用
- **原因**：`TaskCard` 组件没有提供查看详情的入口
- **影响**：用户无法查看任务的完整信息（依赖关系、进度时间线、关联资源等）

### 问题 2：设置按钮功能不完整
- **现状**：设置按钮只显示时间片信息，没有实际的设置功能
- **原因**：未集成 `TimeSlotSettings` 组件
- **影响**：用户无法设置可用时间段

## 实施步骤

### Step 1：集成任务详情面板到 Scheduler 页面

**修改文件**：`src/pages/Scheduler.tsx`

1. 导入 `TaskDetailPanel` 组件
2. 添加状态管理：
   ```tsx
   const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
   const [taskDetail, setTaskDetail] = useState<TaskDetail | null>(null);
   ```
3. 添加获取任务详情的函数（调用 `schedulerApi.getTaskDetail`）
4. 在页面底部渲染 `TaskDetailPanel` 组件

### Step 2：修改 TaskCard 添加查看详情功能

**修改文件**：`src/components/Scheduler/TaskCard.tsx`

1. 添加 `onViewDetail` 回调 prop
2. 点击卡片主体时触发 `onViewDetail`（不是点击按钮区域）
3. 或者添加一个专门的"详情"图标按钮

### Step 3：集成 TimeSlotSettings 到设置面板

**修改文件**：`src/pages/Scheduler.tsx`

1. 导入 `TimeSlotSettings` 组件
2. 将现有的简单设置面板替换为 `TimeSlotSettings`
3. 或者改为弹窗/侧边栏形式展示

### Step 4：更新 HorizontalQueueView 传递回调

**修改文件**：`src/components/Scheduler/HorizontalQueueView.tsx`

1. 添加 `onViewTaskDetail` 回调 prop
2. 将回调传递给 `TaskCard` 组件

## 详细代码变更

### 1. Scheduler.tsx 变更

```tsx
// 新增导入
import { TaskDetailPanel } from '../components/Scheduler/TaskDetailPanel';
import { TimeSlotSettings } from '../components/Scheduler/TimeSlotSettings';
import { schedulerApi, TaskDetail } from '../services/api/scheduler';

// 新增状态
const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
const [taskDetail, setTaskDetail] = useState<TaskDetail | null>(null);
const [isLoadingDetail, setIsLoadingDetail] = useState(false);

// 新增函数
const handleViewTaskDetail = async (task: ScheduledTask) => {
  setSelectedTaskId(task.id);
  setIsLoadingDetail(true);
  try {
    const response = await schedulerApi.getTaskDetail(task.id);
    if (response.success) {
      setTaskDetail(response.data);
    }
  } catch (error) {
    console.error('Failed to load task detail:', error);
  } finally {
    setIsLoadingDetail(false);
  }
};

// 修改设置面板内容
{showSettings && (
  <motion.div ...>
    <TimeSlotSettings onClose={() => setShowSettings(false)} />
  </motion.div>
)}

// 添加 TaskDetailPanel
{selectedTaskId && taskDetail && (
  <TaskDetailPanel
    task={taskDetail}
    isOpen={!!selectedTaskId}
    onClose={() => {
      setSelectedTaskId(null);
      setTaskDetail(null);
    }}
    onEdit={() => {
      const task = allTasks.find(t => t.id === selectedTaskId);
      if (task) openEditTaskForm(task);
    }}
    onStart={() => {
      const task = allTasks.find(t => t.id === selectedTaskId);
      if (task) handleStartTask(task);
    }}
    onComplete={() => {
      const task = allTasks.find(t => t.id === selectedTaskId);
      if (task) handleCompleteTask(task);
    }}
  />
)}
```

### 2. TaskCard.tsx 变更

```tsx
interface TaskCardProps {
  // ... 现有 props
  onViewDetail?: () => void;  // 新增
}

// 在卡片主体添加点击事件
<div className="p-3 pl-4 cursor-pointer" onClick={onViewDetail}>
  // ... 内容
</div>

// 或者添加一个详情按钮
{onViewDetail && (
  <button
    onClick={(e) => { e.stopPropagation(); onViewDetail(); }}
    className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all hover:scale-110"
    title="详情"
  >
    <Info size={14} />
  </button>
)}
```

### 3. HorizontalQueueView.tsx 变更

```tsx
interface HorizontalQueueViewProps {
  // ... 现有 props
  onViewTaskDetail?: (task: ScheduledTask) => void;  // 新增
}

// 传递给 TaskCard
<TaskCard
  // ... 现有 props
  onViewDetail={() => onViewTaskDetail?.(task)}
/>
```

## 验证清单

- [ ] 点击任务卡片可以打开任务详情面板
- [ ] 任务详情面板正确显示所有信息模块
- [ ] 点击设置按钮可以打开时间设置面板
- [ ] 时间设置面板可以添加/删除时间段
- [ ] 关闭详情面板后可以正常重新打开
- [ ] 类型检查通过
- [ ] Lint 检查通过
