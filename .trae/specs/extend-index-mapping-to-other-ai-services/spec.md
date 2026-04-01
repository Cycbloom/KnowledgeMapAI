# 扩展索引映射到其他AI服务的计划

## Why
当前索引映射基础设施只实现了Agent工具的UUID与索引转换。但其他AI服务（如AIActionService、 RAGService、 AutoGraphService、 RelationDiscoveryService等）也可能受益于类似的索引映射机制，以减少AI输入token大小，提高性能和确保数据一致性。

## 数据库分析

### 涉及UUID的表

1. **knowledge_graphs** - 图谱表
2. **knowledge_points** - 知识点表
3. **graph_nodes** - 图谱节点表
4. **graph_relations** - 图谱关系表
5. **study_cards** - 学习卡片表
6. **learning_paths** - 学习路径表
7. **learning_path_nodes** - 学习路径节点表
8. **scheduled_tasks** - 任务表
9. **task_knowledge_points** - 任务知识点关联表

### 当前已实现的映射

- **图谱索引映射** (`graphIndexMap`) - 已实现
- **节点索引映射** (`nodeIndexMap`) - 已实现

- **共享工具函数** - `isIndexValue`, `resolveId`, `buildIndexMap`

## 其他AI服务分析

### 1. AIActionService (`api/services/ai/aiActionService.ts`)
- **涉及ID**: `nodeId`, `graphId`, `actionId`
- **当前状态**: 输入输出都是UUID
- **改进空间**: 可支持索引输入，输出索引版本

- **位置**: `api/services/ai/aiActionService.ts`
- **涉及ID**: `nodeId`, `graphId`, `actionId`
- **当前状态**: 输入输出都是UUID
- **改进空间**: 可支持索引输入，输出索引版本

- **位置**: `api/services/ai/ragService.ts`
- **涉及ID**: `graphId`, `nodeId`, 返回结果中的`id`
- **当前状态**: 输入输出都是UUID
- **改进空间**: 输出结果可包含索引
- **位置**: `api/services/graph/autoGraphService.ts`
- **涉及ID**: `graphId`, `knowledge_point_id`, `graphNodeId`
- **当前状态**: 输出真实UUID
- **改进空间**: 返回结果包含索引映射
- **位置**: `api/services/graph/relationDiscoveryService.ts`
- **涉及ID**: `source_graph_id`, `target_graph_id`
- **当前状态**: 输出真实UUID
- **改进空间**: 输出结果使用索引引用图谱

- **位置**: `src/services/mobile/aiService.ts`
- **涉及ID**: 可能涉及图谱和知识点ID
- **改进空间**: 可复用前端索引映射服务

## 扩展方案

### Phase 1: 增强共享工具模块
**目标**: 扩展 `shared/utils/indexMapping.ts` 支持更多实体类型
**任务**:
1. 添加 `buildTaskIndexMap` 函数 - 任务索引映射
2. 添加 `buildLearningPathIndexMap` 函数 - 学习路径索引映射
3. 添加通用的 `buildEntityIndexMap` 泛型函数
4. 添加 `resolveMultipleIds` 批量转换函数
**文件**: `shared/utils/indexMapping.ts`

**验证**: 已存在

### Phase 2: 扩展后端索引映射服务
**目标**: 扩展 `IndexMappingService` 支持更多实体类型
**任务**:
1. 添加 `buildTaskIndexMap` 方法
2. 添加 `buildLearningPathIndexMap` 方法
3. 添加 `resolveTaskId` 方法
4. 添加 `resolveLearningPathId` 方法
5. 扩展 `IndexContext` 接口
**文件**: `api/services/indexMapping/IndexMappingService.ts`
**验证**: 已存在
### Phase 3: 扩展中间件
**目标**: 提供更多实体的索引上下文
**任务**:
1. 添加 `taskIndexMappingMiddleware` 中间件
2. 扩展 `indexMappingMiddlewareWithNodes` 支持任务
3. 更新 Express Request 类型定义
**文件**: `api/middleware/indexMapping.ts`
**验证**: 已存在
### Phase 4: 扩展前端索引映射服务
**目标**: 扩展前端服务支持更多实体类型
**任务**:
1. 添加 `buildTaskIndexMap` 方法
2. 添加 `buildLearningPathIndexMap` 方法
3. 添加 `resolveTaskId` 方法
4. 添加 `resolveLearningPathId` 方法
**文件**: `src/services/indexMapping.ts`
**验证**: 已存在
### Phase 5: 重构AIActionService
**目标**: 支持索引输入输出
**任务**:
1. 添加 `summarize` 参数支持
2. 输出结果包含索引映射
3. 支持索引输入自动转换
**文件**: `api/services/ai/aiActionService.ts`
**验证**: 需要实施
### Phase 6: 重构RAGService
**目标**: 输出结果添加索引版本
**任务**:
1. 添加 `summarize` 参数支持
2. 输出结果包含索引映射
3. 搜索结果使用索引引用图谱
**文件**: `api/services/ai/ragService.ts`
**验证**: 需要实施
### Phase 7: 重构AutoGraphService
**目标**: 返回结果包含索引映射
**任务**:
1. 返回结果包含节点索引映射
2. 支持 `summarize` 参数
3. 临时ID与最终ID的映射
**文件**: `api/services/graph/autoGraphService.ts`
**验证**: 需要实施
### Phase 8: 重构RelationDiscoveryService
**目标**: 输出结果添加索引
**任务**:
1. 输出结果使用索引引用图谱
2. 添加 `summarize` 参数支持
3. 返回图谱索引映射表（用于标题显示)
**文件**: `api/services/graph/relationDiscoveryService.ts`
**验证**: 需要实施
### Phase 9: 类型检查与验证
**目标**: 确保所有修改正确
**任务**:
1. 运行 `npm run check`
2. 运行 `npm run lint`
3. 修复所有类型错误和lint警告
**文件**: 所有修改的文件
**验证**: 需要实施
### Phase 10: 功能验证
**目标**: 验证所有服务正常工作
**任务**:
1. 验证AIActionService索引转换正确
2. 验证RAGService输出正确
3. 验证AutoGraphService返回正确
4. 验证RelationDiscoveryService输出正确
**验证**: 需要实施

