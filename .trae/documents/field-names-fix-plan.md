# 字段名全面修复计划

## 背景

搜索发现大量文件仍在使用旧字段名，需要系统性地修复。

## 问题统计

| 旧字段名 | 新字段名 | 出现次数 |
|---------|---------|---------|
| `source_node_id` | `source_knowledge_point_id` | ~80+ |
| `target_node_id` | `target_knowledge_point_id` | ~80+ |
| `node_id` (study_cards) | `knowledge_point_id` | ~30+ |

## 需要修复的文件

### 后端 API (api/)

| 文件 | 问题 |
|------|------|
| `api/services/taskService.ts` | 大量使用 source_node_id/target_node_id |
| `api/services/edgeService.ts` | 内部使用旧字段名（数据库字段） |
| `api/services/backupService.ts` | 导出时使用旧字段名 |
| `api/jobs/taskProcessor.ts` | 使用旧字段名创建边 |
| `api/services/templateService.ts` | 使用旧字段名创建边 |
| `api/routes/learningPath.ts` | 使用旧字段名查询边 |
| `api/routes/data.ts` | 使用旧字段名创建边 |
| `api/services/ragService.ts` | 使用旧字段名查询边 |
| `api/services/aiActionService.ts` | 使用旧字段名查询边 |
| `api/services/graphService.ts` | 使用旧字段名查询边 |
| `api/routes/knowledgePoints.ts` | 使用旧字段名查询边 |
| `api/routes/autoGraph.ts` | 使用旧字段名创建边 |

### 前端 (src/)

| 文件 | 问题 |
|------|------|
| `src/hooks/useQueries.ts` | 使用旧字段名过滤边 |
| `src/hooks/useGraphAIOperations.ts` | 使用 node_id 参数 |
| `src/pages/LearningMode.tsx` | 使用 node_id 参数 |
| `src/pages/GraphEditor.tsx` | 使用 node_id 参数 |
| `src/components/CombinedView/CombinedViewCanvas.tsx` | 使用旧字段名 |
| `src/components/GraphEditor/GraphOutline.tsx` | 使用旧字段名 |
| `src/types/index.ts` | 类型定义中有旧字段名 |
| `src/services/api/nodes.ts` | 类型定义中有旧字段名 |

### 测试文件

| 文件 | 问题 |
|------|------|
| `src/utils/exportUtils.test.ts` | 使用旧字段名 |
| `src/lib/graphUtils.test.ts` | 使用旧字段名 |

## 执行步骤

### Step 1: 更新数据库 Schema（已完成）

`edges` 表已使用 `source_knowledge_point_id` 和 `target_knowledge_point_id`。

### Step 2: 更新类型定义

- 更新 `src/types/index.ts` 中的 Edge 类型（已完成）
- 移除类型定义中的旧字段名

### Step 3: 修复后端服务层

按优先级修复：
1. `api/services/edgeService.ts` - 核心服务
2. `api/services/taskService.ts` - 任务处理
3. `api/services/backupService.ts` - 备份服务
4. `api/services/templateService.ts` - 模板服务
5. `api/services/ragService.ts` - RAG 服务
6. `api/services/aiActionService.ts` - AI 动作服务
7. `api/services/graphService.ts` - 图谱服务

### Step 4: 修复后端路由

1. `api/routes/learningPath.ts`
2. `api/routes/data.ts`
3. `api/routes/knowledgePoints.ts`
4. `api/routes/autoGraph.ts`

### Step 5: 修复后端任务处理器

1. `api/jobs/taskProcessor.ts`

### Step 6: 修复前端代码

1. `src/hooks/useQueries.ts`
2. `src/hooks/useGraphAIOperations.ts`
3. `src/pages/LearningMode.tsx`
4. `src/pages/GraphEditor.tsx`
5. `src/components/CombinedView/CombinedViewCanvas.tsx`
6. `src/components/GraphEditor/GraphOutline.tsx`
7. `src/services/api/nodes.ts`

### Step 7: 修复测试文件

1. `src/utils/exportUtils.test.ts`
2. `src/lib/graphUtils.test.ts`

## 注意事项

1. **数据库字段名**：`edges` 表已使用新字段名，服务层需要适配
2. **API 兼容性**：前端需要同步更新
3. **向后兼容**：备份恢复时需要同时支持新旧字段名
