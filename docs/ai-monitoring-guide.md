# AI服务性能监控规范

## 📋 概述

本项目已建立**统一的AI性能监控系统**，用于追踪所有AI Provider API调用的详细指标，包括Token使用、成本、缓存命中率等。

## ✅ 核心组件

### 1. 统一监控工具
**文件**: `api/services/ai/aiMonitor.ts`

提供两个核心函数：

```typescript
// 用于Chat Completions等标准AI调用
export async function withAIMonitoring<T>(
  options: AIMonitoringOptions,
  fn: () => Promise<MonitoringResult<T>>
): Promise<T>

// 用于Embedding等特殊调用
export async function withEmbeddingMonitoring<T>(
  options: Omit<AIMonitoringOptions, 'model'> & { model?: string },
  fn: () => Promise<{ result: T; tokenCount?: number }>
): Promise<T>
```

### 2. 性能监控器
**文件**: `api/services/ai/performanceMonitor.ts`

负责存储、查询和统计所有AI请求的性能数据。

### 3. 定价服务
**文件**: `api/services/ai/pricingService.ts`

支持**三档定价体系**（基于DeepSeek官方定价）：
- 🟢 输入（缓存命中）: ¥0.2/百万tokens
- 🔵 输入（未命中缓存）: ¥2.0/百万tokens
- 🟣 输出: ¥3.0/百万tokens

---

## 📖 使用指南

### 场景1：标准的Chat Completion调用

**适用于**: 对话生成、内容创作、文本分析等所有使用 `chat.completions.create` 的场景

```typescript
import { withAIMonitoring } from './aiMonitor';

async function myAIService(input: string) {
  const provider = await getAIProviderForTask('text');
  
  const result = await withAIMonitoring(
    {
      operation: 'my_custom_operation',        // 操作标识
      provider: provider.providerType,          // 提供商类型
      model: provider.model,                    // 模型名称
      metadata: {                              // 可选元数据
        userId: 'user-123',
        graphId: 'graph-456',
      },
    },
    async () => {
      const response = await provider.client.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: input },
        ],
        model: provider.model,
      });
      
      // 必须返回 result 和 usage
      return {
        result: response.choices[0].message.content,
        usage: response.usage,  // 包含 prompt_tokens, completion_tokens 等
      };
    }
  );
  
  return result;
}
```

### 场景2：Embedding向量生成

**适用于**: 文本向量化、语义搜索等使用 `embeddings.create` 的场景

```typescript
import { withEmbeddingMonitoring } from './aiMonitor';

async function generateEmbedding(text: string) {
  const provider = await getAIProviderForTask('embedding');
  
  const embedding = await withEmbeddingMonitoring(
    {
      operation: 'generate_embedding',           // 操作标识
      provider: provider.providerType,
      model: provider.embeddingModel || provider.model,
      metadata: {
        batchCount: 1,
      },
    },
    async () => {
      const response = await provider.client.embeddings.create({
        model: provider.embeddingModel || provider.model,
        input: text,
      });
      
      return {
        result: response.data[0].embedding,
        tokenCount: text.length,  // embedding按文本长度估算
      };
    }
  );
  
  return embedding;
}
```

### 场景3：批量操作

**适用于**: 批量生成卡片、批量处理文本等场景

```typescript
async function processBatch(items: string[]) {
  const results = await Promise.all(
    items.map(async (item) => {
      return await withAIMonitoring(
        {
          operation: 'batch_process_item',
          provider: currentProvider.providerType,
          model: currentProvider.model,
          metadata: {
            batchCount: items.length,
            batchIndex: items.indexOf(item),
          },
        },
        async () => {
          const response = await currentProvider.client.chat.completions.create({
            messages: [{ role: 'user', content: item }],
            model: currentProvider.model,
          });
          
          return {
            result: response.choices[0].message.content,
            usage: response.usage,
          };
        }
      );
    })
  );
  
  return results;
}
```

---

## 🎯 操作命名规范

为了便于分析和统计，请遵循以下命名规范：

| 前缀 | 适用场景 | 示例 |
|------|---------|------|
| `chat_` | 所有对话类操作 | `chat_tutor`, `chat_rag` |
| `generate_` | 内容生成 | `generate_cards`, `generate_script` |
| `expand_` | 知识扩展 | `expand_knowledge`, `expand_graph` |
| `extract_` | 信息提取 | `extract_concepts`, `extract_keywords` |
| `analyze_` | 分析任务 | `analyze_connections`, `analyze_sentiment` |
| `auto_graph_` | 自动图谱 | `auto_graph_init`, `auto_graph_expand` |
| `rag_` | RAG相关 | `rag_search`, `rag_suggest_questions` |
| `embedding_` | 向量生成 | `generate_embedding`, `embedding_batch` |

---

## 📊 监控数据结构

每次AI调用会自动记录以下信息：

### 基础指标
```typescript
{
  id: string;              // 唯一ID
  timestamp: number;       // 时间戳
  operation: string;       // 操作名称
  model: string;           // 模型名称
  provider: AIProviderType;// 提供商
  success: boolean;        // 是否成功
  duration: number;        // 耗时(ms)
  errorMessage?: string;   // 错误信息
}
```

### Token详情（三档）
```typescript
{
  inputTokens: number;         // 总输入Token
  outputTokens: number;        // 总输出Token
  totalTokens: number;         // 总Token数
  
  cachedInputTokens?: number;     // 缓存命中的输入Token
  uncachedInputTokens?: number;   // 未命中缓存的输入Token
  reasoningTokens?: number;       // 推理Token（Reasoner模型）
  cacheHitRate?: number;          // 缓存命中率(%)
}
```

### 成本明细
```typescript
{
  estimatedCost: number;       // 总预估成本(¥)
  costBreakdown?: {
    cachedInputCost: number;   // 缓存命中成本
    uncachedInputCost: number; // 未命中缓存成本
    outputCost: number;        // 输出成本
    totalCost: number;         // 总成本
    savedByCache: number;      // 缓存节省金额
  };
}
```

---

## 🔧 开发新AI服务时的Checklist

当你添加新的AI功能时，**必须**完成以下步骤：

### ✅ 必须项

1. **导入监控工具**
   ```typescript
   import { withAIMonitoring } from './aiMonitor';
   // 或
   import { withEmbeddingMonitoring } from './aiMonitor';
   ```

2. **包装API调用**
   ```typescript
   // ❌ 错误：直接调用API（不会被监控！）
   const response = await provider.client.chat.completions.create({...});
   
   // ✅ 正确：使用监控包装
   const response = await withAIMonitoring(
     { operation: 'your_operation_name', ... },
     async () => ({ result: await apiCall(), usage: response.usage })
   );
   ```

3. **返回usage对象**
   - Chat Completions: 返回 `response.usage`
   - Embeddings: 返回 `{ tokenCount: text.length }`

4. **选择合适的operation名称**
   - 遵循命名规范
   - 使用有意义的名称
   - 避免过于笼统的名称如 `ai_call`, `request`

5. **添加必要的metadata**
   ```typescript
   metadata: {
     userId: req.user.id,        // 用户ID（如果有认证）
     graphId: graphId,            // 图谱ID（如果涉及图谱）
     nodeId: nodeId,              // 节点ID（如果涉及节点）
     batchCount: items.length,    // 批次大小（如果是批量操作）
   }
   ```

### 💡 推荐项

6. **错误处理**
   - 监控工具会自动捕获异常并记录
   - 异常会被重新抛出，不影响原有逻辑
   - 无需额外的try-catch

7. **测试验证**
   - 启动开发服务器后执行新功能
   - 打开性能监控面板
   - 查看是否出现新的operation记录
   - 检查Token数据和成本计算是否正确

8. **文档更新**
   - 在本文件的"已监控功能清单"中添加新功能
   - 如果是新类型的操作，更新命名规范表

---

## 📈 已监控功能清单

### AIService (api/services/ai/aiService.ts)
- [x] `chat` - AI对话
- [x] `tutorChat` - 导师对话
- [x] `generateCards` - 学习卡片生成
- [x] `generateLearningMaterial` - 学习材料生成
- [x] `expandKnowledge` - 知识扩展
- [x] `extractConcepts` - 概念提取
- [x] `suggestNextTopic` - 下一个主题建议
- [x] `generatePodcastScript` - 播客脚本生成
- [x] `analyzeCrossGraphConnections` - 跨图谱连接分析
- [x] `generateTaskDetails` - 任务详情生成
- [x] `generateEmbedding` - 单个文本向量化 ✨新增
- [x] `generateEmbeddingsBatch` - 批量向量化 ✨新增

### RAGService (api/services/ai/ragService.ts)
- [x] `semanticSearch` - 语义搜索
- [x] `buildContext` - 构建上下文
- [x] `chat` - RAG对话
- [x] `streamChat` - 流式RAG对话
- [x] `generateSuggestedQuestions` - 建议问题生成 ✨新增

### AutoGraph (api/routes/autoGraph.ts)
- [x] `/init` - 图谱初始化 (auto_graph_init) ✨新增
- [x] `/expand` - 节点展开 (auto_graph_expand) ✨新增
- [x] `/optimize-prompt` - 提示词优化 (auto_graph_optimize_prompt) ✨新增

---

## ⚠️ 常见错误与解决方案

### 错误1：忘记返回usage对象
```typescript
// ❌ 错误
return { result: response };

// ✅ 正确
return { result: response, usage: response.usage };
```

### 错误2：使用错误的监控函数
```typescript
// ❌ 错误：Embedding调用使用了withAIMonitoring
await withAIMonitoring(...)

// ✅ 正确：Embedding应该使用withEmbeddingMonitoring
await withEmbeddingMonitoring(...)
```

### 错误3：operation名称重复或冲突
```typescript
// ❌ 错误：多个不同功能使用相同名称
{ operation: 'generate' }

// ✅ 正确：使用具体的功能名称
{ operation: 'generate_cards' }
{ operation: 'generate_summary' }
```

### 错误4：遗漏providerType
```typescript
// ❌ 错误
{ provider: 'deepseek' }  // 字符串字面量

// ✅ 正确
{ provider: provider.providerType }  // 使用实际的providerType属性
```

---

## 🚀 未来扩展建议

### 1. 添加新的AI Provider
当需要支持新的AI提供商时：
1. 在 `api/services/ai/providers/` 创建新的Provider类
2. 在 `pricingService.ts` 中添加价格配置
3. 新Provider的所有API调用都应使用 `withAIMonitoring` 包装

### 2. 自定义监控指标
如果需要记录特殊的业务指标：
```typescript
metadata: {
  ...standardMetadata,
  customMetric: value,  // 自定义指标
}
```

### 3. 监控告警
可以在 `performanceMonitor.recordLog()` 后添加逻辑：
- 单次请求成本超过阈值时发送告警
- 连续失败次数过多时触发通知
- Token使用量接近配额时预警

---

## 📞 技术支持

如有疑问，请参考：
- 统一监控工具: `api/services/ai/aiMonitor.ts`
- 性能监控器: `api/services/ai/performanceMonitor.ts`
- 定价服务: `api/services/ai/pricingService.ts`
- 类型定义: `shared/types/performance.ts`
- 前端展示: `src/components/Console/PerformanceTab.tsx`

---

**最后更新**: 2026-04-10  
**维护者**: AI服务团队  
**版本**: v2.0 (统一监控机制)
