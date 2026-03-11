# 学习路径自动排程优化计划

## 需求概述

将学习路径的自动排程功能从"为每个学习节点创建独立任务"优化为"创建统一主任务 + 子任务层次结构"。

## 当前实现分析

### 数据结构

| 表名 | 用途 |
|------|------|
| `scheduled_tasks` | 主任务表，支持 `parent_task_id` 字段 |
| `task_subtasks` | 子任务表，包含 `task_id`, `title`, `status`, `position`, `estimated_duration` 等 |
| `learning_path_nodes` | 学习路径节点 |

### 当前自动排程逻辑

1. `autoSchedulePath` 方法遍历所有待排程节点
2. 为每个节点调用 `convertNodeToTask` 创建独立的 `scheduled_tasks` 记录
3. 前端 `handleAutoSchedule` 也是逐个节点创建任务

### 问题

- 创建的任务是扁平结构，缺乏层次关系
- 用户难以管理整个学习路径的任务

---

## 实施方案

### 方案选择

使用 `task_subtasks` 表实现子任务（而非 `parent_task_id`），原因：
1. `task_subtasks` 专为子任务设计，有独立的状态、优先级、时长字段
2. 前端已有完整的 subtasks API 支持
3. 子任务与主任务有清晰的从属关系

---

## 修改步骤

### 步骤 1：数据库修改

**文件**: `supabase/migrations/00000000000000_initial_schema.sql`

1. 在 `task_subtasks` 表添加 `learning_path_node_id` 字段：
```sql
ALTER TABLE task_subtasks 
ADD COLUMN learning_path_node_id UUID REFERENCES learning_path_nodes(id) ON DELETE SET NULL;

CREATE INDEX idx_task_subtasks_learning_path_node ON task_subtasks(learning_path_node_id);
```

2. 添加注释：
```sql
COMMENT ON COLUMN task_subtasks.learning_path_node_id IS '关联的学习路径节点ID';
```

---

### 步骤 2：更新类型定义

**文件**: `shared/types/scheduler.ts`

更新 `TaskSubtask` 接口，添加 `learning_path_node_id` 字段：

```typescript
export interface TaskSubtask {
  id: string;
  task_id: string;
  title: string;
  description?: string;
  status: SubtaskStatus;
  priority: number;
  position: number;
  estimated_duration?: number;
  actual_duration?: number;
  due_date?: string;
  completed_at?: string;
  learning_path_node_id?: string;  // 新增
  created_at: string;
  updated_at: string;
}
```

**文件**: `src/services/api/modules/scheduler/subtasks.ts`

更新接口定义，添加 `learning_path_node_id` 字段。

---

### 步骤 3：后端服务修改

**文件**: `api/services/learningPathService.ts`

#### 3.1 新增方法：`createLearningPathMainTask`

创建学习路径的主任务：

```typescript
async createLearningPathMainTask(
  supabase: SupabaseClient,
  pathId: string,
  userId: string,
  options?: {
    scheduled_start?: string;
    scheduled_end?: string;
  }
): Promise<string>
```

功能：
- 创建一个 `task_type: 'learning'` 的主任务
- 标题格式：`[学习路径] {路径名称}`
- 描述包含路径目标和总时长
- 关联 `learning_path_id`（需要新增字段或使用 context）

#### 3.2 新增方法：`convertNodeToSubtask`

将学习节点转换为主任务的子任务：

```typescript
async convertNodeToSubtask(
  supabase: SupabaseClient,
  parentTaskId: string,
  nodeId: string,
  userId: string,
  position: number
): Promise<string>
```

功能：
- 创建 `task_subtasks` 记录
- 设置 `learning_path_node_id` 关联
- 继承主任务的调度信息

#### 3.3 修改方法：`autoSchedulePath`

重构自动排程逻辑：

```typescript
async autoSchedulePath(
  supabase: SupabaseClient,
  pathId: string,
  userId: string,
  options?: { start_date?: string; daily_minutes?: number; }
): Promise<{
  main_task_id: string;      // 主任务ID
  subtask_ids: string[];     // 子任务ID列表
  total_tasks: number;
  estimated_days: number;
}>
```

新逻辑：
1. 获取学习路径和所有待排程节点
2. 计算总时长和排程日期范围
3. **创建一个主任务**（代表整个学习路径）
4. **遍历节点，为每个节点创建子任务**
5. 返回主任务ID和子任务ID列表

---

### 步骤 4：前端 API 更新

**文件**: `src/services/api/learningPaths.ts`

添加自动排程 API：

```typescript
autoSchedule: (pathId: string, options?: { 
  start_date?: string; 
  daily_minutes?: number; 
}) => request(`/learning-paths/${pathId}/auto-schedule`, {
  method: 'POST',
  body: JSON.stringify(options)
})
```

**文件**: `src/services/api/modules/scheduler/subtasks.ts`

更新 `createSubtask` 方法支持 `learning_path_node_id`。

---

### 步骤 5：前端页面修改

**文件**: `src/pages/LearningPathDetail.tsx`

#### 5.1 修改 `handleAutoSchedule`

```typescript
const handleAutoSchedule = async () => {
  if (!pathDetail) return;
  
  setIsUpdating(true);
  try {
    const result = await learningPathsApi.autoSchedule(pathId, {
      start_date: new Date().toISOString(),
      daily_minutes: pathDetail.daily_minutes_target || 30
    });
    
    addMessage({
      type: "success",
      content: `已创建主任务，包含 ${result.subtask_ids.length} 个学习节点`
    });
    
    // 可选：跳转到任务详情页
    // navigate(`/scheduler?task=${result.main_task_id}`);
  } catch (error) {
    handleError(error, {
      context: "AutoSchedule",
      fallbackMessage: "自动排程失败"
    });
  } finally {
    setIsUpdating(false);
  }
};
```

#### 5.2 修改 `handleConvertToTask`

保留单节点转任务功能，但改为创建子任务模式（可选）：
- 如果已有主任务，创建子任务
- 如果没有主任务，先创建主任务再创建子任务

---

### 步骤 6：后端路由添加

**文件**: `api/routes/learningPath.ts`

添加自动排程路由：

```typescript
router.post('/:id/auto-schedule', authenticate, async (req, res) => {
  // 调用 learningPathService.autoSchedulePath
});
```

---

### 步骤 7：数据同步逻辑

当子任务完成时，需要同步更新：
1. 学习节点状态
2. 主任务进度

**文件**: `api/services/learningPathService.ts`

添加或修改 `syncSubtaskProgress` 方法：

```typescript
async syncSubtaskProgress(
  supabase: SupabaseClient,
  subtaskId: string,
  userId: string
): Promise<void>
```

---

## 文件修改清单

| 文件 | 修改类型 | 说明 |
|------|---------|------|
| `supabase/migrations/00000000000000_initial_schema.sql` | 修改 | 添加 `learning_path_node_id` 字段 |
| `shared/types/scheduler.ts` | 修改 | 更新 `TaskSubtask` 类型 |
| `src/services/api/modules/scheduler/subtasks.ts` | 修改 | 更新接口定义 |
| `api/services/learningPathService.ts` | 修改 | 重构自动排程逻辑 |
| `api/routes/learningPath.ts` | 修改 | 添加自动排程路由 |
| `src/services/api/learningPaths.ts` | 修改 | 添加自动排程 API |
| `src/pages/LearningPathDetail.tsx` | 修改 | 更新前端调用逻辑 |

---

## 测试计划

1. **单元测试**：测试新的 `createLearningPathMainTask` 和 `convertNodeToSubtask` 方法
2. **集成测试**：测试完整的自动排程流程
3. **E2E 测试**：测试前端用户操作流程

---

## 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 数据库迁移 | 低 | 新增字段，不影响现有数据 |
| 向后兼容 | 中 | 保留 `convertNodeToTask` 方法，支持旧逻辑 |
| 前端兼容 | 低 | subtasks API 已存在，无需大改 |

---

## 预期效果

1. 自动排程后，用户看到一个主任务（学习路径名称）
2. 展开主任务可看到所有学习节点作为子任务
3. 完成子任务自动更新学习进度
4. 主任务进度 = 已完成子任务数 / 总子任务数
