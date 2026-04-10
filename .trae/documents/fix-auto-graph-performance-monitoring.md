# AI知识图谱生成器性能监控缺失问题修复计划

## 问题描述

首页的AI知识图谱生成器（AutoGraphGenerator）在使用AI生成图谱时，其AI请求**未被性能监控系统捕获和记录**。这导致在性能监控面板中看不到对应的AI请求数据（如Token使用量、响应时间、成本等）。

## 问题根源分析

通过代码分析发现：

### 当前情况
1. ✅ **已正确监控的功能**：
   - AI聊天 (`aiService.ts` 中的 `chatWithTutor`)
   - 学习卡片生成 (`aiService.ts` 中的 `generateLearningCards`)
   - 知识图谱扩展 (`aiService.ts` 中的 `expandKnowledgeGraph`)
   - 图像生成图谱 (`aiService.ts` 中的 `generateGraphFromImage`)

   这些功能都使用了 `withPerformanceTracking()` 包装器来记录性能数据

2. ❌ **未监控的功能**：
   - **图谱初始化** (`api/routes/autoGraph.ts` 第145-156行)
   - **节点展开** (`api/routes/autoGraph.ts` 第263-274行)
   - **提示词优化** (`api/routes/autoGraph.ts` 第345-353行)

   这些功能**直接调用AI Provider API**，绕过了性能监控系统

### 技术原因
`autoGraph.ts` 路由文件中的三个核心AI操作（init、expand、optimize-prompt）都是直接调用 `provider.client.chat.completions.create()`，而没有像其他AI服务一样使用 `withPerformanceTracking()` 函数进行包装。

## 影响范围

### 功能影响
- 性能监控面板无法显示AI知识图谱生成器的统计数据
- 无法追踪该功能的Token消耗和成本
- 无法监控该功能的成功率和响应时间
- 不利于系统优化和成本控制

### 数据影响
缺失以下关键指标的监控：
- 请求次数
- 输入/输出Token数量
- 响应时间（延迟）
- 成功/失败率
- 预估费用

## 修复方案

### 方案概述
为 `autoGraph.ts` 中的所有AI请求添加性能监控支持，使其与其他AI服务保持一致的监控标准。

### 具体实施步骤

#### 步骤1：导入依赖和工具函数
**文件**: `api/routes/autoGraph.ts`

添加必要的导入：
```typescript
import { performanceMonitor } from "../services/ai/performanceMonitor";
```

#### 步骤2：创建性能跟踪辅助函数
**文件**: `api/routes/autoGraph.ts`

在文件顶部（router定义之前）添加一个本地版本的 `withPerformanceTracking` 包装函数：

```typescript
async function withAutoGraphTracking<T>(
  operation: string,
  providerType: AIProviderType,
  model: string,
  fn: () => Promise<{ result: T; usage?: { prompt_tokens?: number; completion_tokens?: number } }>,
  metadata?: { graphId?: string; userId?: string }
): Promise<T> {
  const startTime = Date.now();
  let success = true;
  let errorMessage: string | undefined;
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    const { result, usage } = await fn();
    inputTokens = usage?.prompt_tokens || 0;
    outputTokens = usage?.completion_tokens || 0;
    return result;
  } catch (error: unknown) {
    success = false;
    const err = error as Error;
    errorMessage = err.message;
    throw error;
  } finally {
    const duration = Date.now() - startTime;
    performanceMonitor.recordLog({
      operation,
      provider: providerType,
      model,
      inputTokens,
      outputTokens,
      duration,
      success,
      errorMessage,
      metadata,
    });
  }
}
```

#### 步骤3：修改 /init 路由
**位置**: 第145-156行

将直接的API调用替换为带监控的版本：

```typescript
// 修改前（第145-156行）
const completion = await provider.client.chat.completions.create({...});

// 修改后
const completion = await withAutoGraphTracking(
  "auto_graph_init",
  provider.type,
  model || provider.model,
  async () => {
    const result = await provider.client.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `主题：${topic}${processedSources.length > 0 ? `\n\n参考来源：\n${processedSources.join("\n\n---\n\n")}` : ""}`,
        },
      ],
      model: model || provider.model,
      response_format: { type: "json_object" },
      max_tokens: 4000,
    });
    return { 
      result, 
      usage: result.usage 
    };
  },
  { graphId: graph_id, userId: req.user.id }
);
```

#### 步骤4：修改 /expand 路由
**位置**: 第263-274行

同样应用性能监控包装：

```typescript
// 修改前（第263-274行）
const completion = await provider.client.chat.completions.create({...});

// 修改后
const completion = await withAutoGraphTracking(
  "auto_graph_expand",
  provider.type,
  model || provider.model,
  async () => {
    const result = await provider.client.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `请为「${node_title}」生成子节点。...`,
        },
      ],
      model: model || provider.model,
      response_format: { type: "json_object" },
      max_tokens: 3000,
    });
    return { 
      result, 
      usage: result.usage 
    };
  },
  { graphId: graph_id, userId: req.user.id }
);
```

#### 步骤5：修改 /optimize-prompt 路由
**位置**: 第345-353行

对提示词优化也添加监控：

```typescript
// 修改前（第345-353行）
const completion = await provider.client.chat.completions.create({...});

// 修改后
const completion = await withAutoGraphTracking(
  "auto_graph_optimize_prompt",
  provider.type,
  provider.model,
  async () => {
    const result = await provider.client.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      model: provider.model,
      response_format: { type: "json_object" },
      max_tokens: 1000,
    });
    return { 
      result, 
      usage: result.usage 
    };
  },
  { userId: req.user.id }
);
```

#### 步骤6：验证修复效果

##### 6.1 类型检查
运行类型检查确保代码无错误：
```bash
npm run check
```

##### 6.2 手动测试
1. 启动开发服务器
2. 访问首页的AI知识图谱生成器
3. 执行一次完整的图谱生成流程（初始化 + 展开节点）
4. 访问性能监控面板（通常在 `/api/ai/performance` 或管理后台）
5. 确认能看到以下新增的操作类型：
   - `auto_graph_init`
   - `auto_graph_expand`
   - `auto_graph_optimize_prompt`

##### 6.3 自动化测试
运行相关测试确保不影响现有功能：
```bash
npx playwright test --grep="图谱"
npx playwright test --grep="AI"
```

## 预期结果

修复完成后，性能监控系统将能够完整记录AI知识图谱生成器的所有AI请求，包括：

### 新增监控指标
1. **auto_graph_init**
   - 图谱初始化请求次数
   - Token消耗（输入/输出）
   - 平均响应时间
   - 成功率
   - 预估成本

2. **auto_graph_expand**
   - 节点展开请求次数
   - 每次展开的Token使用量
   - 展开操作的延迟
   - 失败率统计

3. **auto_graph_optimize_prompt**
   - 提示词优化请求
   - 相关资源消耗

### 监控面板展示
在性能监控面板中，用户可以看到：
- 完整的操作类型列表（包含上述三种新类型）
- 按操作分类的统计数据
- 按模型分类的成本分析
- 时间趋势图表
- 详细的请求日志

## 风险评估

### 低风险
- ✅ 修改仅涉及添加监控逻辑，不改变业务逻辑
- ✅ 使用try-catch-finally确保异常不会影响原有功能
- ✅ 与现有AI服务的监控实现保持一致

### 注意事项
- ⚠️ 需要确保 `provider.type` 的类型正确（应为 `AIProviderType`）
- ⚠️ 需要确认 `result.usage` 的结构符合预期
- ⚠️ 测试时注意检查内存使用（日志存储上限1000条）

## 后续优化建议

### 短期（本次修复）
- [x] 为三个核心AI操作添加性能监控
- [ ] 验证监控数据的准确性
- [ ] 更新相关文档（如有）

### 中期（可选增强）
- [ ] 在前端展示时增加"AI图谱生成"相关的统计卡片
- [ ] 添加按用户维度的使用统计
- [ ] 设置成本预警阈值（如单日超过$X）

### 长期（架构优化）
- [ ] 考虑将监控逻辑提取为中间件或装饰器模式
- [ ] 统一所有AI服务的监控入口
- [ ] 支持导出监控报告（CSV/PDF）

## 测试清单

- [ ] 类型检查通过（`npm run check`）
- [ ] Lint检查通过（`npm run lint`）
- [ ] 图谱初始化功能正常工作
- [ ] 节点展开功能正常工作
- [ ] 提示词优化功能正常工作
- [ ] 性能监控面板显示新的操作类型
- [ ] 监控数据准确（Token数、时间、成本）
- [ ] 异常情况下监控仍能正常记录
- [ ] 现有测试用例全部通过
