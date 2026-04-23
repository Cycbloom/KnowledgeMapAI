# AI请求性能监控完善计划

## 问题分析

经过全面调研，发现项目中有多处AI调用缺少性能监控。以下是详细分析：

### 已有性能监控的文件 ✅

| 文件 | 监控方式 | 状态 |
|------|----------|------|
| `api/services/ai/aiService.ts` | `withPerformanceTracking` | ✅ 所有方法都有监控 |
| `api/routes/autoGraph.ts` | `withAutoGraphTracking` | ✅ `/init`, `/expand`, `/optimize-prompt`, `/apply-template` |
| `api/services/ai/templateGeneratorService.ts` | `performanceMonitor.recordLog` | ✅ 有监控 |
| `api/services/ai/ragService.ts` | `withAIMonitoring` | ✅ `generateSuggestedQuestions` |

### 缺少性能监控的文件 ❌

| 文件 | 缺少监控的方法 | 严重程度 |
|------|----------------|----------|
| `api/services/taskProcessors/recursiveGraphProcessor.ts` | 所有AI调用 | 🔴 高 |
| `api/services/taskProcessors/infiniteExpansionProcessor.ts` | 所有AI调用 | 🔴 高 |
| `api/services/taskProcessors/utils.ts` | `generateNodesForGraph`, `expandNodeForGraph` | 🔴 高 |
| `api/routes/ai/content.ts` | `/annotate-terms`, `/generate-content`, `/generate-content-stream` | 🟡 中 |
| `api/routes/ai/document.ts` | `/text-to-graph`, `/document-to-graph` | 🟡 中 |
| `api/routes/ai/chat.ts` | `/chat`, `/tutor-chat` | 🟡 中 |
| `api/services/ai/aiActionService.ts` | `executeAction` | 🟡 中 |
| `api/services/graph/relationDiscoveryService.ts` | `discoverRelations`, `getIntelligentSuggestions`, `analyzeCrossDomainInsights`, `generateLearningPathSuggestions`, `analyzeKnowledgeGaps` | 🟡 中 |
| `api/routes/prompts.ts` | `/optimize` | 🟢 低 |
| `api/routes/learningPaths.ts` | `/generate` | 🟢 低 |
| `api/services/ai/ragService.ts` | `chat`, `streamChat`, `analyzeKnowledgeGaps` | 🟡 中 |

## 实施方案

### 第一步：扩展元数据类型定义

**文件**: `shared/types/performance.ts`

```typescript
metadata?: {
  // 现有字段
  graphId?: string;
  nodeId?: string;
  userId?: string;
  topic?: string;
  templateType?: string;
  text?: string;
  graph1?: string;
  graph2?: string;
  title?: string;
  nodeTitle?: string;
  
  // 新增字段 - 有意义的名称
  graphTitle?: string;        // 图谱标题
  userName?: string;          // 用户名
  graphDescription?: string;  // 图谱描述
  nodeLevel?: string;         // 节点层级
  style?: string;             // 生成风格
  depth?: number;             // 生成深度
  actionName?: string;        // AI动作名称
  documentName?: string;      // 文档名称
  learningStyle?: string;     // 学习风格
  targetGoal?: string;        // 目标
};
```

### 第二步：创建统一的性能监控辅助函数

**文件**: `api/services/ai/performanceMonitor.ts`

添加辅助函数用于获取图谱和用户信息：

```typescript
interface EnrichedMetadata {
  graphId?: string;
  graphTitle?: string;
  graphDescription?: string;
  userId?: string;
  userName?: string;
  nodeId?: string;
  nodeTitle?: string;
  nodeLevel?: string;
  topic?: string;
  style?: string;
  depth?: number;
}

export async function enrichMetadata(
  supabase: SupabaseClient,
  baseMetadata: {
    graphId?: string;
    nodeId?: string;
    userId?: string;
    topic?: string;
    nodeTitle?: string;
  }
): Promise<EnrichedMetadata> {
  const [graphInfo, userInfo] = await Promise.all([
    baseMetadata.graphId ? getGraphInfo(supabase, baseMetadata.graphId) : null,
    baseMetadata.userId ? getUserInfo(supabase, baseMetadata.userId) : null,
  ]);

  return {
    ...baseMetadata,
    graphTitle: graphInfo?.title,
    graphDescription: graphInfo?.description,
    userName: userInfo?.name,
  };
}

async function getGraphInfo(supabase: SupabaseClient, graphId: string) {
  const { data } = await supabase
    .from('knowledge_graphs')
    .select('id, title, description')
    .eq('id', graphId)
    .maybeSingle();
  return data;
}

async function getUserInfo(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('id', userId)
    .maybeSingle();
  return data;
}
```

### 第三步：修改缺少性能监控的文件

#### 3.1 `api/services/taskProcessors/recursiveGraphProcessor.ts`

**修改内容**：
1. 导入 `withPerformanceTracking` 或直接使用 `performanceMonitor`
2. 为初始化AI调用添加监控
3. 为节点展开AI调用添加监控
4. 添加图谱标题、用户名、主题等元数据

#### 3.2 `api/services/taskProcessors/infiniteExpansionProcessor.ts`

**修改内容**：
1. 为无限扩展AI调用添加监控
2. 添加图谱标题、用户名、深度等元数据

#### 3.3 `api/services/taskProcessors/utils.ts`

**修改内容**：
1. 为 `generateNodesForGraph` 添加监控
2. 为 `expandNodeForGraph` 添加监控

#### 3.4 `api/routes/ai/content.ts`

**修改内容**：
1. `/annotate-terms` - 添加监控，元数据包含图谱ID、内容摘要
2. `/generate-content` - 添加监控，元数据包含主题、层级
3. `/generate-content-stream` - 流式响应需要特殊处理

#### 3.5 `api/routes/ai/document.ts`

**修改内容**：
1. `/text-to-graph` - 添加监控，元数据包含文本长度
2. `/document-to-graph` - 添加监控，元数据包含文档名称、页数

#### 3.6 `api/routes/ai/chat.ts`

**修改内容**：
1. `/chat` - 流式响应，记录总token和时长
2. `/tutor-chat` - 流式响应，记录总token和时长

#### 3.7 `api/services/ai/aiActionService.ts`

**修改内容**：
1. `executeAction` - 添加监控，元数据包含动作名称、节点信息

#### 3.8 `api/services/graph/relationDiscoveryService.ts`

**修改内容**：
1. `discoverRelations` - 添加监控
2. `getIntelligentSuggestions` - 添加监控
3. `analyzeCrossDomainInsights` - 添加监控
4. `generateLearningPathSuggestions` - 添加监控
5. `analyzeKnowledgeGaps` - 添加监控

#### 3.9 `api/routes/prompts.ts`

**修改内容**：
1. `/optimize` - 添加监控

#### 3.10 `api/routes/learningPaths.ts`

**修改内容**：
1. `/generate` - 添加监控

#### 3.11 `api/services/ai/ragService.ts`

**修改内容**：
1. `chat` - 添加监控
2. `streamChat` - 流式响应特殊处理
3. `analyzeKnowledgeGaps` - 添加监控

### 第四步：改进现有监控的元数据

#### 4.1 `api/routes/autoGraph.ts`

**修改内容**：
- `/init` - 添加图谱标题、用户名、主题
- `/expand` - 添加图谱标题、用户名、节点标题

## 文件修改清单

| 文件 | 修改类型 | 优先级 |
|------|----------|--------|
| `shared/types/performance.ts` | 扩展类型定义 | 高 |
| `api/services/ai/performanceMonitor.ts` | 添加辅助函数 | 高 |
| `api/services/taskProcessors/recursiveGraphProcessor.ts` | 添加性能监控 | 高 |
| `api/services/taskProcessors/infiniteExpansionProcessor.ts` | 添加性能监控 | 高 |
| `api/services/taskProcessors/utils.ts` | 添加性能监控 | 高 |
| `api/routes/ai/content.ts` | 添加性能监控 | 中 |
| `api/routes/ai/document.ts` | 添加性能监控 | 中 |
| `api/routes/ai/chat.ts` | 添加性能监控 | 中 |
| `api/services/ai/aiActionService.ts` | 添加性能监控 | 中 |
| `api/services/graph/relationDiscoveryService.ts` | 添加性能监控 | 中 |
| `api/routes/prompts.ts` | 添加性能监控 | 低 |
| `api/routes/learningPaths.ts` | 添加性能监控 | 低 |
| `api/services/ai/ragService.ts` | 添加性能监控 | 中 |
| `api/routes/autoGraph.ts` | 改进元数据 | 中 |

## 预期效果

### 性能监控日志示例

#### 图谱初始化
```json
{
  "operation": "auto_graph_init",
  "model": "gpt-4o",
  "provider": "openai",
  "inputTokens": 1500,
  "outputTokens": 800,
  "cachedInputTokens": 500,
  "cacheHitRate": 33.33,
  "duration": 3500,
  "metadata": {
    "graphId": "uuid-xxx",
    "graphTitle": "机器学习基础",
    "userId": "uuid-yyy",
    "userName": "张三",
    "topic": "机器学习",
    "style": "academic"
  }
}
```

#### 节点展开
```json
{
  "operation": "auto_graph_expand",
  "model": "gpt-4o",
  "provider": "openai",
  "inputTokens": 800,
  "outputTokens": 500,
  "cachedInputTokens": 200,
  "cacheHitRate": 25.0,
  "duration": 2000,
  "metadata": {
    "graphId": "uuid-xxx",
    "graphTitle": "机器学习基础",
    "userId": "uuid-yyy",
    "userName": "张三",
    "nodeId": "uuid-zzz",
    "nodeTitle": "监督学习",
    "nodeLevel": "core"
  }
}
```

## 注意事项

1. **流式响应处理**：对于流式API（如 `/chat`、`/tutor-chat`），需要在流结束后记录总时长，token统计可能不可用
2. **性能影响**：获取图谱和用户信息会增加额外的数据库查询，但影响很小
3. **向后兼容**：新的元数据字段都是可选的，不会影响现有代码
4. **缓存命中统计**：现有的 `cachedInputTokens` 和 `cacheHitRate` 字段已经支持缓存命中统计
