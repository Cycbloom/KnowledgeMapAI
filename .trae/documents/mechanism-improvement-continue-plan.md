# 机制改进继续执行计划

## 当前进度

### ✅ Phase 1: 类型安全改进（已完成）

**已修复文件：**
- `api/supabase.ts` - 重构 Supabase 客户端初始化
- `api/services/ai/ragService.ts` - 添加接口定义，替换 any 类型
- `api/services/taskService.ts` - 定义 TaskPayload 和 TaskResult 接口
- `api/jobs/taskProcessor.ts` - 修复类型问题
- `api/services/ai/performanceMonitor.ts` - 修复 Promise 链式调用
- `api/routes/autoGraph.ts` - 替换非空断言为安全检查
- `api/routes/graphs.ts` - 替换非空断言为安全检查

**验证结果：**
- ✅ `npm run check` 通过
- ✅ `npm run lint` 通过

---

## Phase 2: Prompt 管理改进

### 发现的问题

通过搜索发现 **38 处硬编码 prompt**，分布在以下文件：

| 文件 | 数量 |
|------|------|
| `api/services/ai/aiService.ts` | 8 |
| `api/services/agent/AgentService.ts` | 10 |
| `api/services/graph/relationDiscoveryService.ts` | 4 |
| `api/routes/graphs.ts` | 4 |
| `api/routes/domains.ts` | 3 |
| `api/services/ai/ragService.ts` | 3 |
| `api/routes/autoGraph.ts` | 2 |
| 其他文件 | 4 |

### 执行步骤

**Task 2.1: 将硬编码 prompt 迁移到 DEFAULT_PROMPTS**

1. 在 `api/services/ai/promptService.ts` 的 `DEFAULT_PROMPTS` 中添加新的 prompt 模板
2. 使用变量占位符（如 `{{topic}}`、`{{context}}`）替代硬编码值

**Task 2.2: 修改代码使用 promptService.getRenderedPrompt**

修改示例：
```typescript
// 修改前
const systemPrompt = `你是知识图谱专家。用户想学习「${domain}」领域。`;

// 修改后
const systemPrompt = await promptService.getRenderedPrompt(
  supabase,
  'domain_analysis',
  { domain }
);
```

**Task 2.3: 添加 fallback 机制**

保留原有硬编码 prompt 作为 fallback，确保数据库读取失败时系统仍能正常工作。

---

## Phase 3: AI 监控改进

### 发现的问题

只有 3 个文件使用了 `performanceMonitor.recordLog`，大部分 AI 调用缺少监控。

### 执行步骤

**Task 3.1: 为核心 AI 服务添加监控**

修改 `api/services/ai/aiService.ts`：
```typescript
const startTime = Date.now();
try {
  const completion = await client.chat.completions.create({...});
  
  await performanceMonitor.recordLog({
    operation: 'generate_cards',
    provider: 'openai',
    model,
    inputTokens: completion.usage?.prompt_tokens || 0,
    outputTokens: completion.usage?.completion_tokens || 0,
    duration: Date.now() - startTime,
    success: true,
  });
  
  return completion;
} catch (error) {
  await performanceMonitor.recordLog({
    operation: 'generate_cards',
    provider: 'openai',
    model,
    inputTokens: 0,
    outputTokens: 0,
    duration: Date.now() - startTime,
    success: false,
    errorMessage: error instanceof Error ? error.message : 'Unknown error',
  });
  throw error;
}
```

---

## Phase 4-6: 后续阶段（中优先级）

### Phase 4: 缓存改进
- 为知识点查询添加缓存
- 为图谱节点查询添加缓存
- 为用户设置查询添加缓存

### Phase 5: 重试机制改进
- 为 AI 调用添加 `withTimeoutAndRetry`
- 为外部 API 调用添加重试

### Phase 6: 错误处理改进
- 将 `throw new Error` 替换为 `throw new AppError`
- 添加适当的错误代码

---

## 本次执行范围

建议本次执行 **Phase 2** 的核心部分：

1. 将 `aiService.ts` 中的硬编码 prompt 迁移到 `DEFAULT_PROMPTS`
2. 修改 `aiService.ts` 使用 `promptService.getRenderedPrompt`
3. 为 AI 调用添加监控（Phase 3 的部分工作）

**预计修改文件：**
- `api/services/ai/promptService.ts` - 添加新的 prompt 模板
- `api/services/ai/aiService.ts` - 使用 promptService + 添加监控

---

## 验证清单

- [ ] `npm run check` 无类型错误
- [ ] `npm run lint` 无代码风格错误
- [ ] 功能测试正常
