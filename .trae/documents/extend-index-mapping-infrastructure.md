# 扩展索引映射基础设施到其他AI服务

## 背景

当前索引映射基础设施已成功应用于Agent工具系统，实现了图谱ID的索引转换。用户希望将此基础设施扩展到其他AI服务，实现类似操作系统页表的全局虚拟地址转换架构。

## 数据库分析

### 涉及UUID的表

| 表名 | 主键 | 外键 | AI相关 |
|------|------|------|--------|
| knowledge_graphs | id | user_id | ✓ |
| knowledge_points | id | owner_id | ✓ |
| graph_nodes | id | graph_id, knowledge_point_id | ✓ |
| edges | id | graph_id, source_knowledge_point_id, target_knowledge_point_id | ✓ |
| graph_relations | id | source_graph_id, target_graph_id | ✓ |
| study_cards | id | knowledge_point_id, graph_id, source_graph_id | ✓ |
| learning_paths | id | source_graph_id | ✓ |
| learning_path_nodes | id | knowledge_point_id | ✓ |
| scheduled_tasks | id | knowledge_point_id | ✓ |
| task_knowledge_points | id | task_id, knowledge_point_id | ✓ |

### 需要索引映射的实体类型

1. **Graph (图谱)** - 已实现
2. **Node (知识点)** - 已实现
3. **Task (任务)** - 新增
4. **LearningPath (学习路径)** - 新增

## 当前实现分析

### 已完成
- `shared/utils/indexMapping.ts` - 共享工具函数
- `api/services/indexMapping/IndexMappingService.ts` - 后端服务
- `api/middleware/indexMapping.ts` - Express中间件
- `src/services/indexMapping.ts` - 前端服务
- Agent工具文件已重构使用共享工具

### 待扩展的服务

| 服务 | 位置 | 涉及ID | 改进空间 |
|------|------|--------|--------|
| AIActionService | api/services/ai/aiActionService.ts | nodeId, graphId, actionId | 支持索引输入输出 |
| RAGService | api/services/ai/ragService.ts | graphId, nodeId | 输出结果添加索引 |
| AutoGraphService | api/services/graph/autoGraphService.ts | graphId, knowledge_point_id | 返回结果包含索引映射 |
| RelationDiscoveryService | api/services/graph/relationDiscoveryService.ts | source_graph_id, target_graph_id | 输出结果添加索引 |
| StudyService | api/services/study/*.ts | graphId, knowledge_point_id | 特定场景使用 |

## 实施计划

### Phase 1: 增强共享工具模块

**目标**: 扩展 `shared/utils/indexMapping.ts` 支持更多实体类型

**任务**:
1. 添加 `buildTaskIndexMap` 函数
2. 添加 `buildLearningPathIndexMap` 函数
3. 添加通用的 `buildEntityIndexMap` 泛型函数
4. 添加 `resolveMultipleIds` 批量转换函数

**文件**: `shared/utils/indexMapping.ts`

### Phase 2: 扩展后端索引映射服务

**目标**: 扩展 `IndexMappingService` 支持更多实体类型

**任务**:
1. 添加 `buildTaskIndexMap` 方法
2. 添加 `buildLearningPathIndexMap` 方法
3. 添加 `resolveTaskId` 方法
4. 添加 `resolveLearningPathId` 方法
5. 扩展 `IndexContext` 接口

**文件**: `api/services/indexMapping/IndexMappingService.ts`

### Phase 3: 扩展中间件

**目标**: 提供更多实体的索引上下文

**任务**:
1. 添加 `taskIndexMappingMiddleware` 中间件
2. 扩展 `indexMappingMiddlewareWithNodes` 支持任务
3. 更新 Express Request 类型定义

**文件**: `api/middleware/indexMapping.ts`

### Phase 4: 扩展前端索引映射服务

**目标**: 扩展前端服务支持更多实体类型

**任务**:
1. 添加 `buildTaskIndexMap` 方法
2. 添加 `buildLearningPathIndexMap` 方法
3. 添加 `resolveTaskId` 方法
4. 添加 `resolveLearningPathId` 方法

**文件**: `src/services/indexMapping.ts`

### Phase 5: 重构AIActionService

**目标**: 支持索引输入输出

**任务**:
1. 添加 `summarize` 参数支持
2. 输出结果包含索引映射
3. 支持索引输入自动转换

**文件**: `api/services/ai/aiActionService.ts`

### Phase 6: 重构RAGService

**目标**: 输出结果添加索引版本

**任务**:
1. 添加 `summarize` 参数支持
2. 输出结果包含索引映射
3. 搜索结果使用索引引用

**文件**: `api/services/ai/ragService.ts`

### Phase 7: 重构AutoGraphService

**目标**: 返回结果包含索引映射

**任务**:
1. 返回结果包含节点索引映射
2. 支持 `summarize` 参数
3. 临时ID与最终ID的映射

**文件**: `api/services/graph/autoGraphService.ts`

### Phase 8: 重构RelationDiscoveryService

**目标**: 输出结果添加索引

**任务**:
1. 输出结果使用索引引用图谱
2. 添加 `summarize` 参数支持
3. 返回图谱索引映射表

**文件**: `api/services/graph/relationDiscoveryService.ts`

### Phase 9: 验证与测试

**目标**: 确保所有更改正确工作

**任务**:
1. 运行 `npm run check` 验证TypeScript类型
2. 运行 `npm run lint` 验证代码风格
3. 修复所有类型错误和lint警告
4. 验证各服务正常工作

## 预期收益

1. **Token节省**: 索引比UUID短约90%，大幅减少AI输入token
2. **代码复用**: 所有AI服务使用统一的转换逻辑
3. **一致性**: 前后端使用相同的映射机制
4. **可维护性**: 修改映射逻辑只需修改一处
5. **扩展性**: 新增实体类型只需扩展共享工具

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 索引与UUID不同步 | 缓存TTL设置为5分钟，支持手动清除 |
| 多实体类型复杂性 | 使用泛型和统一接口 |
| 性能影响 | 缓存机制，批量转换 |
| 向后兼容 | 保留UUID输出选项，索引作为可选 |

## 依赖关系

```
Phase 1 (共享工具)
    ↓
Phase 2 (后端服务) ←── Phase 4 (前端服务)
    ↓
Phase 3 (中间件)
    ↓
Phase 5-8 (服务重构) - 可并行
    ↓
Phase 9 (验证测试)
```

## 实施优先级

### 高优先级（立即实施）
1. Phase 1: 增强共享工具模块
2. Phase 2: 扩展后端索引映射服务
3. Phase 3: 扩展中间件
4. Phase 4: 扩展前端索引映射服务

### 中优先级（后续实施）
5. Phase 5: 重构AIActionService
6. Phase 6: 重构RAGService
7. Phase 7: 重构AutoGraphService
8. Phase 8: 重构RelationDiscoveryService

### 低优先级（按需实施）
9. Phase 9: 验证与测试
