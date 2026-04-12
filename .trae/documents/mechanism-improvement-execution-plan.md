# 项目机制改进执行计划

## 执行概述

根据项目机制合规检查报告，本计划将系统性地改进项目中的机制贯彻情况，共分 6 个阶段执行。

## 执行前准备

### 环境检查
```bash
npm run check    # 确认当前类型错误数量
npm run lint     # 确认当前代码风格问题
```

### 备份当前状态
```bash
git add .
git commit -m "chore: 开始机制改进前的备份"
```

---

## Phase 1: 类型安全改进（高优先级）

### Task 1.1: 修复 any 类型（58 个文件）

**执行步骤**：

1. **运行类型检查获取错误列表**
   ```bash
   npm run check 2>&1 | grep "error TS" > type-errors.txt
   ```

2. **按优先级修复文件**

   **优先级 1：核心 AI 服务**
   - `api/services/ai/aiService.ts`
   - `api/services/ai/ragService.ts`
   - `api/services/ai/searchService.ts`
   - `api/services/ai/aiActionService.ts`
   - `api/services/ai/providers/*.ts`

   **优先级 2：核心图谱服务**
   - `api/services/graph/graphService.ts`
   - `api/services/graph/graphNodeService.ts`
   - `api/services/graph/edgeService.ts`
   - `api/services/graph/knowledgePointService.ts`

   **优先级 3：路由层**
   - `api/routes/autoGraph.ts`
   - `api/routes/graphs.ts`
   - `api/routes/templates.ts`
   - `api/routes/nodes.ts`

   **优先级 4：其他服务**
   - `api/services/taskService.ts`
   - `api/services/scheduler/*.ts`
   - `api/services/study/*.ts`

3. **修复策略**
   - 使用具体接口替换 `any`
   - 使用泛型 `<T>` 替换 `any`
   - 使用 `unknown` + 类型守卫
   - 使用 `Record<string, unknown>` 替换对象 `any`

4. **验证**
   ```bash
   npm run check
   npm run lint
   ```

### Task 1.2: 修复非空断言（19 个文件）

**执行步骤**：

1. **搜索所有非空断言**
   ```bash
   grep -rn "!\\." api/ --include="*.ts" > non-null-assertions.txt
   ```

2. **修复策略**
   - 替换为可选链：`obj?.property`
   - 替换为空值合并：`value ?? defaultValue`
   - 添加类型守卫：`if (value) { ... }`

3. **验证**
   ```bash
   npm run check
   npm run lint
   ```

---

## Phase 2: Prompt 管理改进（高优先级）

### Task 2.1: 识别所有硬编码 prompt（13 个文件）

**执行步骤**：

1. **搜索硬编码 prompt**
   ```bash
   grep -rn "You are\|你是\|作为.*助手" api/ --include="*.ts" > hardcoded-prompts.txt
   ```

2. **整理 prompt 列表**
   - 记录每个 prompt 的位置、内容、用途
   - 为每个 prompt 分配唯一的 code

### Task 2.2: 创建数据库记录

**执行步骤**：

1. **在 seed 文件添加 prompt 模板**
   - 编辑 `supabase/migrations/00000000000001_initial_seed.sql`
   - 添加 INSERT 语句

2. **prompt 模板示例**
   ```sql
   INSERT INTO prompt_templates (code, name, description, scope, template_content, variables, is_active)
   VALUES (
     'rag_query',
     'RAG 查询 Prompt',
     '用于 RAG 检索增强生成的系统提示',
     'system',
     '你是一个专业的知识图谱助手...',
     '{"context": "string", "question": "string"}'::jsonb,
     true
   );
   ```

### Task 2.3: 修改代码使用 promptService

**执行步骤**：

1. **修改每个硬编码 prompt 的文件**
   ```typescript
   // 修改前
   const prompt = "You are an expert...";

   // 修改后
   const prompt = await promptService.getRenderedPrompt(
     supabaseAdmin,
     'prompt_code',
     { variable: 'value' }
   );
   ```

2. **按优先级修改**
   - 核心 AI 服务
   - Agent 服务
   - 其他 AI 相关服务

3. **验证**
   ```bash
   npm run check
   npx playwright test
   ```

---

## Phase 3: AI 监控改进（高优先级）

### Task 3.1: 识别所有 AI 调用

**执行步骤**：

1. **搜索 AI 调用**
   ```bash
   grep -rn "chat.completions.create\|messages.*create\|embeddings.create" api/ --include="*.ts" > ai-calls.txt
   ```

### Task 3.2: 添加 AI 监控

**执行步骤**：

1. **为每个 AI 调用添加监控**
   ```typescript
   const startTime = Date.now();

   try {
     const completion = await client.chat.completions.create({...});

     await performanceMonitor.recordLog({
       operation: 'operation_name',
       provider: 'openai',
       model: model,
       inputTokens: completion.usage?.prompt_tokens || 0,
       outputTokens: completion.usage?.completion_tokens || 0,
       duration: Date.now() - startTime,
       success: true,
     });

     return completion;
   } catch (error) {
     await performanceMonitor.recordLog({
       operation: 'operation_name',
       provider: 'openai',
       model: model,
       inputTokens: 0,
       outputTokens: 0,
       duration: Date.now() - startTime,
       success: false,
       errorMessage: error instanceof Error ? error.message : 'Unknown error',
     });
     throw error;
   }
   ```

2. **按优先级添加**
   - 核心 AI 服务
   - AI 提供商
   - 其他 AI 相关服务

3. **验证**
   ```bash
   npm run check
   # 测试监控数据是否正确记录
   ```

---

## Phase 4: 缓存改进（中优先级）

### Task 4.1: 识别频繁查询的数据

**执行步骤**：

1. **分析数据库查询**
   - 知识点查询
   - 图谱节点查询
   - 用户设置查询
   - 模板查询
   - 关系类型查询

### Task 4.2: 添加缓存

**执行步骤**：

1. **使用 getOrSet 添加缓存**
   ```typescript
   const data = await cacheService.getOrSet(
     CacheKeys.GRAPH_NODES(userId, graphId),
     () => fetchNodesFromDatabase(userId, graphId),
     300 // TTL 5分钟
   );
   ```

2. **添加缓存失效逻辑**
   ```typescript
   await cacheService.invalidateGraphCache(userId, graphId);
   ```

3. **验证**
   ```bash
   npm run check
   # 测试缓存是否生效
   ```

---

## Phase 5: 重试机制改进（中优先级）

### Task 5.1: 识别需要重试的调用

**执行步骤**：

1. **识别 AI 调用和外部 API 调用**
   ```bash
   grep -rn "chat.completions.create\|fetch\|axios" api/ --include="*.ts" > retry-needed.txt
   ```

### Task 5.2: 添加重试机制

**执行步骤**：

1. **使用 withTimeoutAndRetry 包装**
   ```typescript
   const result = await withTimeoutAndRetry(
     () => callAI(),
     {
       timeout: LONG_TIMEOUT,
       maxRetries: 3,
       initialDelay: 1000,
       maxDelay: 10000,
     }
   );
   ```

2. **按优先级添加**
   - 核心 AI 服务
   - AI 提供商
   - 外部 API 调用

3. **验证**
   ```bash
   npm run check
   # 测试重试逻辑
   ```

---

## Phase 6: 错误处理改进（中优先级）

### Task 6.1: 识别所有 throw new Error（159 处）

**执行步骤**：

1. **搜索所有 throw new Error**
   ```bash
   grep -rn "throw new Error" api/ --include="*.ts" > throw-errors.txt
   ```

### Task 6.2: 替换为 AppError

**执行步骤**：

1. **替换为 AppError**
   ```typescript
   // 修改前
   throw new Error('Something went wrong');

   // 修改后
   throw new AppError(ErrorCodes.INTERNAL_ERROR, {
     context: { details: 'Something went wrong' }
   });
   ```

2. **按优先级替换**
   - 核心服务
   - Agent 服务
   - 其他服务

3. **验证**
   ```bash
   npm run check
   npx playwright test
   ```

---

## 验证清单

每个阶段完成后验证：

- [ ] `npm run check` 无类型错误
- [ ] `npm run lint` 无代码风格错误
- [ ] `npx playwright test` 所有 E2E 测试通过
- [ ] 功能测试正常

## 成功标准

1. **类型安全**：0 个 `any` 类型，0 个非空断言
2. **Prompt 管理**：0 个硬编码 prompt
3. **AI 监控**：所有 AI 调用都有性能监控
4. **缓存优化**：频繁查询的数据都有缓存
5. **重试机制**：所有不稳定调用都有重试
6. **错误处理**：所有错误都使用 AppError
