# 用户任务与系统任务分离 Spec

## Why

当前 `scheduled_tasks` 表同时存储用户手动创建的任务和系统自动生成的任务（如自动扩展图谱、AI处理任务等），导致：
1. 用户任务列表被系统任务"污染"
2. 系统后台任务与用户可见任务混在一起，难以管理
3. 两类任务的生命周期、权限、展示逻辑完全不同

需要将这两类任务分离到不同的表中，实现清晰的架构分离。

## What Changes

- **创建新表 `system_tasks`**：专门存储系统自动生成的后台任务
- **修改 `scheduled_tasks` 表**：仅存储用户手动创建的任务
- **修改相关服务**：`autoTaskGenerator`、`smartTaskLinker` 等使用新表
- **更新前端组件**：任务列表仅显示用户任务，系统任务在单独的管理界面

## Impact

- **Affected specs**: 任务调度系统、图谱自动扩展、AI任务处理
- **Affected code**:
  - `supabase/migrations/07_scheduler_tasks.sql` - 数据库结构
  - `api/services/scheduler/autoTaskGenerator.ts` - 自动任务生成
  - `api/services/scheduler/smartTaskLinker.ts` - 智能任务链接
  - `api/routes/scheduler/tasks.ts` - 任务 API
  - `src/components/Scheduler/*` - 前端组件

---

## ADDED Requirements

### Requirement: 系统任务表

系统应提供独立的 `system_tasks` 表来存储后台自动任务。

#### 表结构

```sql
CREATE TABLE IF NOT EXISTS system_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL,  -- 'graph_expansion', 'ai_generation', 'knowledge_sync', 'review_generation'
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
  priority INTEGER DEFAULT 5,
  input_data JSONB DEFAULT '{}',
  output_data JSONB DEFAULT '{}',
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 任务类型定义

| 类型 | 说明 | 示例 |
|------|------|------|
| `graph_expansion` | 图谱自动扩展 | 自动扩展知识图谱节点 |
| `ai_generation` | AI内容生成 | 自动生成学习卡片、题目 |
| `knowledge_sync` | 知识点同步 | 同步知识点状态 |
| `review_generation` | 复习任务生成 | 根据遗忘曲线生成复习任务 |

#### Scenario: 系统任务创建

- **WHEN** 系统需要执行后台任务（如扩展图谱）
- **THEN** 创建 `system_tasks` 记录
- **AND** 不影响用户的 `scheduled_tasks` 列表

---

### Requirement: 系统任务服务

系统应提供 `SystemTaskService` 来管理系统任务。

#### 方法

```typescript
class SystemTaskService {
  // 创建系统任务
  async createTask(
    supabase: SupabaseClient,
    userId: string,
    taskType: SystemTaskType,
    input: Record<string, any>
  ): Promise<SystemTask>;

  // 获取待处理的系统任务
  async getPendingTasks(
    supabase: SupabaseClient,
    userId: string
  ): Promise<SystemTask[]>;

  // 开始执行任务
  async startTask(
    supabase: SupabaseClient,
    taskId: string
  ): Promise<void>;

  // 完成任务
  async completeTask(
    supabase: SupabaseClient,
    taskId: string,
    output: Record<string, any>
  ): Promise<void>;

  // 任务失败
  async failTask(
    supabase: SupabaseClient,
    taskId: string,
    error: string
  ): Promise<void>;

  // 重试任务
  async retryTask(
    supabase: SupabaseClient,
    taskId: string
  ): Promise<void>;
}
```

#### Scenario: 图谱扩展任务流程

- **GIVEN** 用户创建了一个新的知识图谱
- **WHEN** 系统检测到需要扩展图谱
- **THEN** 创建 `graph_expansion` 类型的系统任务
- **AND** 后台处理器执行扩展逻辑
- **AND** 完成后更新任务状态

---

### Requirement: 任务来源区分

`scheduled_tasks` 表应明确标记任务来源。

#### 字段修改

```sql
ALTER TABLE scheduled_tasks ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'user';
-- source: 'user' | 'import' | 'template'
```

#### Scenario: 用户创建任务

- **WHEN** 用户手动创建任务
- **THEN** `source` 字段设置为 `user`
- **AND** 任务显示在用户任务列表中

---

### Requirement: 前端任务列表过滤

前端任务列表应仅显示用户任务，不显示系统任务。

#### 过滤规则

1. **队列视图**：仅显示 `scheduled_tasks` 中的用户任务
2. **看板视图**：仅显示 `scheduled_tasks` 中的用户任务
3. **时间轴视图**：仅显示 `scheduled_tasks` 中的用户任务
4. **列表视图**：仅显示 `scheduled_tasks` 中的用户任务

#### Scenario: 用户查看任务列表

- **WHEN** 用户打开任务调度器
- **THEN** 仅显示用户手动创建的任务
- **AND** 系统后台任务在单独的管理界面可见（如果需要）

---

## MODIFIED Requirements

### Requirement: 自动任务生成器

原有的 `autoTaskGenerator` 服务需要修改为使用 `system_tasks` 表。

**原逻辑**：在 `scheduled_tasks` 表中创建任务，标记 `context.auto_generated = true`

**新逻辑**：
1. 学习任务、复习任务 → 仍在 `scheduled_tasks` 中创建，但标记 `source = 'system_recommendation'`
2. 图谱扩展、AI生成等后台任务 → 在 `system_tasks` 中创建

### Requirement: 智能任务链接器

`smartTaskLinker` 服务需要区分用户任务和系统任务。

**修改**：
- 为图谱创建的学习任务 → `scheduled_tasks` 表，用户可见
- 后台同步任务 → `system_tasks` 表，用户不可见

---

## REMOVED Requirements

### Requirement: context.auto_generated 字段

**Reason**: 不再通过 JSON 字段区分任务来源，改用专门的表和字段

**Migration**: 
- 现有 `context.auto_generated = true` 的任务，如果是学习/复习任务，保留在 `scheduled_tasks` 中
- 如果是后台处理任务，迁移到 `system_tasks` 表（本次不需要迁移，用户会重置数据库）
