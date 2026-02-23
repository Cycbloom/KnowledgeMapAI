# 向量嵌入(Embedding)异步任务处理计划

## 一、背景分析

### 当前实现情况

1. **知识点创建时的Embedding处理**：
   - `knowledgePointService.create()` 方法在创建单个知识点时会**自动生成embedding**（除非明确传入 `embedding` 参数）
   - `autoGraphService.createKnowledgePointsBatch()` 方法在批量创建知识点时，将 `embedding` 设为 `null`，**不自动生成**

2. **现有的Embedding服务**：
   - `embeddingService.ts` 提供了批量生成embedding的功能
   - 有API端点 `/auto-graph/generate-embeddings` 可以手动触发批量生成

3. **任务系统**：
   - 已有完整的任务系统框架 (`taskService.ts`)
   - 有多个任务处理器：`batchGenerateCardsProcessor`, `recursiveGraphProcessor`, `infiniteExpansionProcessor`

### 问题

- 知识图谱创建时，如果实时生成embedding会消耗大量时间，影响用户体验
- 目前虽然有批量生成embedding的API，但需要手动调用
- 缺少自动化的后台任务来处理embedding生成

## 二、目标

1. 知识图谱创建时**不立即**调用embedding生成（保持实时性）
2. 创建图谱后，在任务系统中**自动提交**一个后台任务来处理embedding
3. 任务系统会自动完成embedding的生成
4. 用户可以在任务中心查看embedding生成任务的进度

## 三、实现方案

### 3.1 创建Embedding任务处理器

**文件**: `api/services/taskProcessors/embeddingGenerationProcessor.ts`

```typescript
// 任务类型: embedding_generation
// payload: { graphId?: string, knowledgePointIds?: string[] }
```

功能：
- 为指定图谱的所有知识点生成embedding
- 或为指定的知识点ID列表生成embedding
- 支持批量处理，每批20个
- 通过SSE推送进度更新

### 3.2 修改知识图谱创建流程

**修改文件**: `api/services/autoGraphService.ts`

在 `processAINodes()` 方法完成后，创建一个embedding生成任务：

```typescript
// 在 processAINodes 方法最后添加
// 创建embedding生成任务
await taskService.createTask(userId, 'embedding_generation', {
  graphId: graphId,
  knowledgePointIds: knowledgePoints.filter(kp => kp).map(kp => kp.id)
}, `图谱嵌入生成 - ${graphId}`);
```

### 3.3 修改知识点服务

**修改文件**: `api/services/knowledgePointService.ts`

在 `create()` 方法中，默认不自动生成embedding，而是由调用方决定：

```typescript
// 修改逻辑：只有明确传入 embedding 参数时才设置
// 不再自动生成embedding（移除自动生成逻辑）
```

### 3.4 注册任务处理器

**修改文件**: `api/services/taskService.ts`

添加导入：
```typescript
import './taskProcessors/embeddingGenerationProcessor.js';
```

### 3.5 API端点调整（可选）

**修改文件**: `api/routes/autoGraph.ts`

可能需要调整现有的 `/generate-embeddings` 端点，使其创建任务而不是直接执行。

## 四、详细任务列表

### 任务1: 创建Embedding任务处理器
- 创建 `api/services/taskProcessors/embeddingGenerationProcessor.ts`
- 实现 `TaskProcessor` 接口
- 支持按图谱ID或知识点ID列表处理
- 实现批量处理和进度更新

### 任务2: 修改知识图谱创建流程
- 修改 `api/services/autoGraphService.ts`
- 在节点创建完成后创建embedding任务

### 任务3: 修改知识点服务
- 修改 `api/services/knowledgePointService.ts`
- 移除自动生成embedding的逻辑
- 保持向后兼容（允许显式传入embedding）

### 任务4: 注册任务处理器
- 修改 `api/services/taskService.ts`
- 添加embedding处理器的导入

### 任务5: 测试验证
- 测试知识图谱创建流程
- 验证任务是否正确创建
- 验证embedding是否正确生成

## 五、数据库变更

无需数据库变更，现有的 `knowledge_points.embedding` 字段和 `tasks` 表已满足需求。

## 六、API变更

| 端点 | 变更 |
|------|------|
| POST /auto-graph/generate | 创建图谱后自动创建embedding任务 |
| GET /tasks | 可查看embedding_generation类型的任务 |
| POST /auto-graph/generate-embeddings | 可选：改为创建任务而非直接执行 |

## 七、影响范围

### 需要修改的文件
1. `api/services/taskProcessors/embeddingGenerationProcessor.ts` (新建)
2. `api/services/autoGraphService.ts` (修改)
3. `api/services/knowledgePointService.ts` (修改)
4. `api/services/taskService.ts` (修改)

### 不需要修改的文件
- 数据库迁移文件
- 前端代码（任务中心已支持显示所有类型任务）
- `embeddingService.ts`（可被任务处理器复用）

## 八、风险评估

1. **向后兼容性**: 知识点服务的修改可能影响其他调用方
   - 解决方案：保持 `embedding` 参数可选，显式传入时使用

2. **任务积压**: 大量图谱创建可能导致任务积压
   - 解决方案：任务系统已有队列机制，按顺序处理

3. **失败处理**: embedding生成可能因API限制失败
   - 解决方案：任务处理器支持重试，失败后可手动重试

## 九、实施顺序

1. 创建embedding任务处理器
2. 注册任务处理器
3. 修改知识点服务（移除自动生成）
4. 修改图谱创建流程（添加任务创建）
5. 测试验证
