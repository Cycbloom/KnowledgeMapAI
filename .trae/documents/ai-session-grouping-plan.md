# AI 服务会话分组方案

## 问题分析

当前系统中，图谱初始化和节点展开被记录为多个独立的 AI 请求：
- `auto_graph_init` - 图谱初始化
- `auto_graph_expand` - 节点展开
- `recursive_graph_init` - 递归图谱初始化
- `recursive_graph_expand_depth2` - 第二层节点展开
- `recursive_graph_expand_depth3` - 第三层节点展开

但实际上，这些操作往往是同一场对话中的多个步骤，应该被视为一个"会话"或"请求组"。

## 解决方案

### 1. 数据库修改

在 `ai_performance_logs` 表中添加 `session_id` 字段：

```sql
ALTER TABLE ai_performance_logs 
ADD COLUMN IF NOT EXISTS session_id UUID;

CREATE INDEX IF NOT EXISTS idx_ai_performance_logs_session_id 
ON ai_performance_logs(session_id);
```

### 2. 类型定义修改

更新 `shared/types/performance.ts` 中的 `AIPerformanceLog` 接口：

```typescript
export interface AIPerformanceLog {
  id: string;
  timestamp: number;
  operation: string;
  sessionId?: string;  // 新增：会话ID
  // ... 其他字段
}
```

### 3. 性能监控服务修改

更新 `api/services/ai/performanceMonitor.ts`：

- `recordLog` 方法支持 `sessionId` 参数
- 新增 `getLogsBySession` 方法获取同一会话的所有日志
- 新增 `getSessionStats` 方法统计会话级别的性能数据

### 4. API 路由修改

#### 4.1 图谱初始化路由 (`/init`)

- 生成 `sessionId`
- 将 `sessionId` 返回给前端
- 所有后续的节点展开请求携带此 `sessionId`

#### 4.2 节点展开路由 (`/expand`)

- 接收可选的 `sessionId` 参数
- 如果提供了 `sessionId`，使用它；否则生成新的

#### 4.3 递归图谱处理器 (`RecursiveGraphProcessor`)

- 在任务开始时生成 `sessionId`
- 所有 AI 调用使用同一个 `sessionId`

### 5. 前端修改

#### 5.1 图谱 AI 操作 Hook

更新 `src/hooks/graphAI/useGraphAIOperations.ts`：

- 初始化时保存 `sessionId`
- 展开节点时传递 `sessionId`

### 6. 统计和展示

#### 6.1 新增会话级别统计 API

```typescript
GET /api/ai-performance/sessions
GET /api/ai-performance/sessions/:sessionId
GET /api/ai-performance/sessions/:sessionId/stats
```

#### 6.2 更新监控面板

- 按会话分组显示 AI 调用
- 显示每个会话的总 Token、总成本、总时长

## 实现步骤

### 步骤 1：数据库迁移
- 修改 `supabase/migrations/10_ai_and_prompts.sql` 添加 `session_id` 列

### 步骤 2：类型定义更新
- 更新 `shared/types/performance.ts`

### 步骤 3：后端服务修改
- 修改 `api/services/ai/performanceMonitor.ts`
- 修改 `api/routes/autoGraph.ts`
- 修改 `api/services/taskProcessors/recursiveGraphProcessor.ts`
- 修改 `api/services/taskProcessors/utils.ts`

### 步骤 4：前端修改
- 修改 `src/hooks/graphAI/useGraphAIOperations.ts`
- 修改 `src/hooks/graphAI/useCombinedGraphAIOperations.ts`

### 步骤 5：新增 API 端点
- 添加会话统计 API

### 步骤 6：测试验证
- 运行类型检查
- 运行 lint
- 手动测试图谱初始化和节点展开

## 文件清单

需要修改的文件：

1. `supabase/migrations/10_ai_and_prompts.sql` - 数据库 Schema
2. `shared/types/performance.ts` - 类型定义
3. `api/services/ai/performanceMonitor.ts` - 性能监控服务
4. `api/routes/autoGraph.ts` - API 路由
5. `api/services/taskProcessors/recursiveGraphProcessor.ts` - 递归处理器
6. `api/services/taskProcessors/utils.ts` - 工具函数
7. `src/hooks/graphAI/useGraphAIOperations.ts` - 前端 Hook
8. `src/hooks/graphAI/useCombinedGraphAIOperations.ts` - 组合 Hook

## 预期效果

1. 同一图谱初始化流程中的所有 AI 调用共享同一个 `sessionId`
2. 监控面板可以按会话分组查看 AI 调用
3. 可以统计每个会话的总成本、总 Token、总时长
4. 向后兼容：不提供 `sessionId` 的请求仍然正常工作
