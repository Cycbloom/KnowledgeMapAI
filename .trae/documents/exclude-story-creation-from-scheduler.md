# 排除故事创作图谱的任务调度

## 需求分析

### 用户需求
对于故事创作类型的图谱，不需要任务调度功能。即：
- 创建故事创作图谱时，不自动创建学习任务
- 故事创作图谱不参与任务推荐系统

### 当前状态

#### 图谱模板类型
- 图谱表 `knowledge_graphs` 有 `template_type` 字段
- 故事创作类型的模板为 `story_creation`
- 属于 `creative` 类别

#### 任务自动创建流程
1. 图谱创建时触发 `graph_created` 事件
2. `GraphTaskEventHandler.handleGraphCreated()` 监听事件
3. 调用 `graphTaskService.createOrUpdateTaskForGraph()` 创建任务
4. 任务类型为 `graph_learning`

#### 相关文件
- `api/services/scheduler/graphTaskEventHandler.ts` - 事件处理器
- `api/services/scheduler/graphTaskService.ts` - 图谱任务服务
- `api/services/scheduler/taskRecommendationService.ts` - 任务推荐服务

## 修复方案

### 方案选择
在图谱创建任务时，检查图谱的 `template_type`，如果是 `story_creation` 类型，则跳过任务创建。

**优点**：
- 修改范围小，只涉及任务创建逻辑
- 不影响其他类型图谱的任务调度
- 易于扩展到其他不需要任务调度的图谱类型

### 实施步骤

#### 1. 修改 `handleGraphCreated` 方法
**文件**：`api/services/scheduler/graphTaskEventHandler.ts`
**位置**：第59-76行

**修改内容**：
- 在创建任务前，查询图谱的 `template_type`
- 如果是 `story_creation` 类型，记录日志并跳过任务创建

**具体实现**：
```typescript
private async handleGraphCreated(event: AppEvent<GraphCreatedPayload>): Promise<void> {
  const { graphId, userId } = event.payload;

  logger.info("[GraphTaskEventHandler] Graph created, checking if task creation is needed:", {
    graphId,
    userId,
  });

  try {
    // 查询图谱的模板类型
    const { data: graph, error } = await getSupabaseAdmin()
      .from("knowledge_graphs")
      .select("template_type, title")
      .eq("id", graphId)
      .single();

    if (error) {
      logger.error("[GraphTaskEventHandler] Failed to fetch graph info:", error);
      return;
    }

    // 故事创作类型的图谱不需要任务调度
    if (graph?.template_type === "story_creation") {
      logger.info("[GraphTaskEventHandler] Skipping task creation for story_creation graph:", {
        graphId,
        title: graph.title,
      });
      return;
    }

    // 其他类型的图谱创建任务
    await graphTaskService.createOrUpdateTaskForGraph(
      getSupabaseAdmin(),
      userId,
      graphId,
    );
  } catch (error) {
    logger.error("[GraphTaskEventHandler] Failed to create task for new graph:", error);
  }
}
```

#### 2. 修改 `createOrUpdateTaskForGraph` 方法（可选防御性检查）
**文件**：`api/services/scheduler/graphTaskService.ts`
**位置**：第96-198行

**修改内容**：
- 在方法开始时，检查图谱的 `template_type`
- 如果是 `story_creation` 类型，记录警告并返回

**具体实现**：
```typescript
async createOrUpdateTaskForGraph(
  supabase: SupabaseClient,
  userId: string,
  graphId: string,
): Promise<{ taskId: string; isNew: boolean }> {
  logger.info("[GraphTaskService] createOrUpdateTaskForGraph called:", {
    userId,
    graphId,
  });

  const { data: graph, error: graphError } = await supabase
    .from("knowledge_graphs")
    .select("id, title, task_id, template_type")
    .eq("id", graphId)
    .single();

  if (graphError || !graph) {
    logger.error("[GraphTaskService] Error fetching graph:", graphError);
    throw new Error(
      `Graph not found: ${graphError?.message || "Unknown error"}`,
    );
  }

  // 故事创作类型的图谱不应该创建任务
  if (graph.template_type === "story_creation") {
    logger.warn("[GraphTaskService] Story creation graph should not have task, skipping:", {
      graphId,
      title: graph.title,
    });
    return { taskId: "", isNew: false };
  }

  // ... 原有逻辑
}
```

#### 3. 更新任务推荐过滤逻辑（已完成）
在之前的修复中，`taskRecommendationService.getTaskRecommendations()` 已经添加了对软删除图谱的过滤。对于故事创作图谱：
- 如果已经存在故事创作图谱的任务（历史数据），它们会被正常推荐
- 新创建的故事创作图谱不会有任务，因此不会出现在推荐中

**可选优化**：
如果需要彻底排除故事创作图谱的任务，可以在推荐查询中添加额外过滤：
```typescript
// 在 getTaskRecommendations 方法中
const validTasks = tasks.filter(task => {
  // ... 现有的图谱删除检查

  // 排除故事创作图谱的任务
  if (task.task_type === 'graph_learning') {
    const graphData = task.knowledge_graphs;
    if (graphData) {
      const graph = Array.isArray(graphData) ? graphData[0] : graphData;
      // 需要在 JOIN 查询中添加 template_type 字段
      if (graph.template_type === 'story_creation') {
        return false;
      }
    }
  }

  return true;
});
```

## 风险评估

### 低风险
- 修改范围明确，只涉及任务创建逻辑
- 不影响现有故事创作图谱的数据
- 不影响其他类型图谱的任务调度

### 潜在问题
1. **历史数据**：已存在的故事创作图谱任务不会被自动删除
   - **缓解措施**：可以手动删除或保留，不影响新功能

2. **扩展性**：未来可能有其他类型的图谱也不需要任务调度
   - **缓解措施**：可以将不需要任务调度的模板类型定义为常量数组

## 验证步骤

### 手动测试
1. 创建一个故事创作类型的图谱
2. 验证没有自动创建学习任务
3. 验证图谱列表中该图谱没有关联的任务ID

### 单元测试
```typescript
describe('GraphTaskEventHandler', () => {
  it('should not create task for story_creation graph', async () => {
    // 1. 创建 story_creation 类型的图谱
    // 2. 触发 graph_created 事件
    // 3. 验证没有创建任务
  });

  it('should create task for other graph types', async () => {
    // 1. 创建其他类型的图谱
    // 2. 触发 graph_created 事件
    // 3. 验证创建了任务
  });
});
```

## 后续优化建议

1. **配置化**：将不需要任务调度的图谱类型定义为配置项
   ```typescript
   const EXCLUDED_TEMPLATE_TYPES = ['story_creation'];
   ```

2. **数据清理**：提供脚本清理已存在的故事创作图谱任务

3. **UI提示**：在图谱创建界面提示用户哪些类型的图谱不会创建学习任务

## 相关文件

### 需要修改的文件
- `api/services/scheduler/graphTaskEventHandler.ts` - 主要修改
- `api/services/scheduler/graphTaskService.ts` - 可选防御性检查

### 相关文件（无需修改）
- `api/services/scheduler/taskRecommendationService.ts` - 任务推荐服务
- `shared/types/graph.ts` - 图谱类型定义
- `supabase/migrations/02_knowledge_graph.sql` - 数据库结构
