# 修复任务调度器推荐软删除图谱的问题

## 问题分析

### 当前状态
任务调度器在推荐任务时，会将关联了已软删除图谱的任务也包含在推荐列表中。

### 根本原因
1. **数据结构**：
   - 图谱学习任务的 `task_type` 为 `'graph_learning'`
   - 任务通过 `context->>'graph_id'` 字段关联图谱
   - 图谱表 `knowledge_graphs` 使用 `deleted_at` 字段实现软删除

2. **查询缺陷**：
   - `taskRecommendationService.getTaskRecommendations()` 方法（第385-477行）只检查任务本身是否被软删除
   - 没有检查关联的图谱是否被软删除
   - 导致已删除图谱的学习任务仍被推荐

### 影响范围
- `api/services/scheduler/taskRecommendationService.ts` 中的以下方法：
  - `getTaskRecommendations()` - 获取任务推荐列表
  - `getSmartRecommendation()` - 获取智能推荐（内部调用 `getTaskRecommendations`）

## 修复方案

### 方案选择
采用 **JOIN 查询过滤** 方案，在查询任务时通过 JOIN 关联图谱表，过滤掉已删除的图谱。

**优点**：
- 一次数据库查询完成过滤，性能最优
- 逻辑清晰，易于维护
- 与现有代码风格一致

### 实施步骤

#### 1. 修改 `getTaskRecommendations` 方法
**文件**：`api/services/scheduler/taskRecommendationService.ts`
**位置**：第385-477行

**修改内容**：
- 将简单的 `select("*")` 改为包含图谱表关联的查询
- 对于图谱学习任务，通过 LEFT JOIN 关联 `knowledge_graphs` 表
- 添加过滤条件：排除 `knowledge_graphs.deleted_at IS NOT NULL` 的任务

**具体实现**：
```typescript
// 原查询（第392-398行）
const { data: tasks, error } = await client
  .from("user_tasks")
  .select("*")
  .eq("user_id", userId)
  .in("status", ["pending", "paused"])
  .is("deleted_at", null)
  .order("priority", { ascending: false });

// 修改为
const { data: tasks, error } = await client
  .from("user_tasks")
  .select(`
    *,
    knowledge_graphs!left(
      id,
      deleted_at
    )
  `)
  .eq("user_id", userId)
  .in("status", ["pending", "paused"])
  .is("deleted_at", null)
  .order("priority", { ascending: false });

// 查询后过滤
const validTasks = tasks?.filter(task => {
  // 非图谱学习任务，直接保留
  if (task.task_type !== 'graph_learning') {
    return true;
  }

  // 图谱学习任务，检查图谱是否被删除
  const graphData = task.knowledge_graphs;
  if (!graphData || (Array.isArray(graphData) && graphData.length === 0)) {
    // 没有关联图谱，可能是数据不一致，但仍然保留
    return true;
  }

  // 检查图谱是否被软删除
  const graph = Array.isArray(graphData) ? graphData[0] : graphData;
  return !graph.deleted_at;
}) || [];
```

#### 2. 更新类型定义
由于查询结果包含了关联的图谱数据，需要更新类型定义：

```typescript
interface TaskWithGraph {
  id: string;
  user_id: string;
  title: string;
  // ... 其他任务字段
  task_type: string;
  knowledge_graphs?: {
    id: string;
    deleted_at: string | null;
  } | Array<{
    id: string;
    deleted_at: string | null;
  }> | null;
}
```

#### 3. 测试验证
创建测试用例验证修复效果：
1. 创建图谱学习任务
2. 软删除关联的图谱
3. 调用推荐接口，确认该任务不在推荐列表中

## 风险评估

### 低风险
- 修改范围明确，只涉及查询逻辑
- 不影响其他类型的任务
- 不改变数据库结构

### 潜在问题
1. **性能影响**：JOIN 查询可能略微降低性能
   - **缓解措施**：已有索引 `idx_user_tasks_context_graph_id`，性能影响可忽略

2. **数据一致性**：可能存在任务关联的图谱不存在的情况
   - **缓解措施**：代码中已处理这种情况，不会导致错误

## 验证步骤

### 单元测试
```typescript
describe('TaskRecommendationService', () => {
  it('should exclude tasks with soft-deleted graphs', async () => {
    // 1. 创建图谱
    // 2. 创建图谱学习任务
    // 3. 软删除图谱
    // 4. 调用 getTaskRecommendations
    // 5. 验证任务不在推荐列表中
  });

  it('should include tasks with active graphs', async () => {
    // 1. 创建图谱
    // 2. 创建图谱学习任务
    // 3. 调用 getTaskRecommendations
    // 4. 验证任务在推荐列表中
  });

  it('should include non-graph-learning tasks', async () => {
    // 1. 创建普通任务
    // 2. 调用 getTaskRecommendations
    // 3. 验证任务在推荐列表中
  });
});
```

### 手动测试
1. 启动本地开发环境
2. 创建图谱并生成学习任务
3. 软删除图谱
4. 访问 `/scheduler/recommendations` 接口
5. 验证返回的任务列表中不包含该任务

## 相关文件

### 需要修改的文件
- `api/services/scheduler/taskRecommendationService.ts` - 核心修复文件

### 相关文件（无需修改）
- `api/routes/scheduler/recommendations.ts` - API 路由
- `supabase/migrations/07_scheduler_tasks.sql` - 数据库结构
- `api/services/scheduler/graphTaskService.ts` - 图谱任务服务

## 后续优化建议

1. **数据清理**：创建定时任务，自动软删除关联了已删除图谱的任务
2. **级联删除**：考虑在图谱软删除时，同时软删除关联的任务
3. **监控告警**：添加日志记录，监控推荐系统中被过滤的任务数量
