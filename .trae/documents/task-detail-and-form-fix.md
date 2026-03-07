# 任务详情页和编辑表单修复计划

## 问题描述

### 问题1: 任务详情页是侧边面板而非完整页面
- **现状**: TaskDetailPanel 是一个从右侧滑出的侧边面板(modal形式)
- **期望**: 应该是一个完整的独立页面，用户可以导航进入
- **影响**: 用户体验不佳，信息展示空间有限

### 问题2: 编辑任务后表单变成"创建新任务"
- **现状**: 编辑任务并保存后，表单标题变成"创建新任务"
- **期望**: 编辑保存后应该关闭表单或保持编辑模式
- **原因分析**: TaskForm 组件在 `onSubmit` 后没有正确处理编辑状态

## 解决方案

### 方案1: 任务详情页改为完整页面

**实现步骤:**

1. **创建新的路由页面** `/scheduler/task/:taskId`
   - 在 `src/pages/` 创建 `TaskDetailPage.tsx`
   - 使用 React Router 的 `useParams` 获取任务ID
   - 从 API 加载任务详情数据

2. **修改导航逻辑**
   - TaskCard 的"查看详情"按钮改为导航到新页面
   - 使用 `useNavigate` 进行页面跳转
   - 保留返回按钮方便用户返回调度器

3. **增强详情页内容**
   - 基本信息区域（标题、描述、类型、状态）
   - 时间信息区域（总时长、已分配时长、截止日期）
   - 进度信息区域（进度百分比、进度历史图表）
   - 依赖关系区域（前置任务、后置任务）
   - 时间片分配区域（已分配的时间片列表）
   - 操作按钮区域（编辑、删除、开始任务）

4. **保留 TaskDetailPanel 作为快速预览**
   - 可以保留侧边面板作为快速预览功能
   - 或者完全移除，统一使用详情页

### 方案2: 修复编辑表单状态问题

**问题根因分析:**

查看 `Scheduler.tsx` 代码（第121-130行）：
```typescript
const handleUpdateTask = async (data: CreateScheduledTaskData) => {
  if (!editingTask) return;
  try {
    await updateTaskMutation.mutateAsync({ id: editingTask.id, data });
    addMessage({ type: 'success', content: '任务更新成功' });
    setEditingTask(null);  // 只清除了 editingTask，但没有关闭表单！
  } catch (err: any) {
    addMessage({ type: 'error', content: err.message || '更新任务失败' });
  }
};
```

**根本原因:**
- 编辑成功后只调用了 `setEditingTask(null)`
- 表单仍然显示（`showTaskForm` 仍为 `true`）
- TaskForm 组件中 `isEditing = !!task`，当 `editingTask` 变为 `null` 后，`isEditing` 变为 `false`
- 所以表单标题从"编辑任务"变成"创建新任务"

**修复方案:**

在 `handleUpdateTask` 中添加 `setShowTaskForm(false)`：
```typescript
const handleUpdateTask = async (data: CreateScheduledTaskData) => {
  if (!editingTask) return;
  try {
    await updateTaskMutation.mutateAsync({ id: editingTask.id, data });
    addMessage({ type: 'success', content: '任务更新成功' });
    setEditingTask(null);
    setShowTaskForm(false);  // 添加这一行：关闭表单
  } catch (err: any) {
    addMessage({ type: 'error', content: err.message || '更新任务失败' });
  }
};
```

## 实施计划

### Phase 1: 修复编辑表单Bug (优先级高)
1. 检查 Scheduler.tsx 中 `handleTaskSubmit` 的实现
2. 确保编辑成功后清除 `editingTask` 状态
3. 测试编辑流程

### Phase 2: 创建任务详情页面
1. 创建 `TaskDetailPage.tsx` 页面组件
2. 添加路由配置
3. 修改 TaskCard 的导航逻辑
4. 增强详情页内容展示

### Phase 3: 清理和优化
1. 移除或保留 TaskDetailPanel（根据用户偏好）
2. 统一页面样式
3. 测试完整流程

## 文件变更清单

### 需要修改的文件:
- `src/pages/Scheduler.tsx` - 修复编辑状态管理
- `src/components/Scheduler/TaskCard.tsx` - 修改导航逻辑
- `src/components/Scheduler/DraggableTaskCard.tsx` - 修改导航逻辑
- `src/App.tsx` 或路由配置文件 - 添加新路由

### 需要创建的文件:
- `src/pages/TaskDetailPage.tsx` - 新的任务详情页面

### 可能删除的文件:
- `src/components/Scheduler/TaskDetailPanel.tsx` - 如果决定完全移除侧边面板

## 风险和注意事项

1. **路由兼容性**: 确保新路由与现有路由不冲突
2. **状态同步**: 详情页需要从服务器获取最新数据，避免状态不一致
3. **返回导航**: 确保用户可以从详情页正确返回调度器
4. **编辑模式**: 编辑完成后应该返回详情页或调度器，而不是停留在表单
