# 项目机制改进实施计划

## 实施目标

根据项目机制贯彻情况检查报告，系统性地改进项目中的机制贯彻情况，确保所有机制都得到正确实施。

## 实施原则

1. **渐进式改进**：分阶段实施，每个阶段完成后验证
2. **优先级驱动**：先解决高优先级问题，再处理中优先级问题
3. **向后兼容**：修改时保持向后兼容，不破坏现有功能
4. **充分测试**：每次修改后都要运行测试验证
5. **文档同步**：修改后更新相关文档

## Phase 1: 类型安全改进（高优先级）

### Task 1.1: 修复 any 类型

**目标**：将所有 `any` 类型替换为具体类型

**步骤**：

1. **运行类型检查获取所有错误**
   ```bash
   npm run check 2>&1 | grep "error TS"
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
   
   **策略 1：使用具体类型**
   ```typescript
   // 错误
   function process(data: any) { ... }
   
   // 正确
   interface ProcessData {
     id: string;
     name: string;
     value: number;
   }
   function process(data: ProcessData) { ... }
   ```
   
   **策略 2：使用泛型**
   ```typescript
   // 错误
   function getFirst(items: any[]): any { ... }
   
   // 正确
   function getFirst<T>(items: T[]): T | undefined { ... }
   ```
   
   **策略 3：使用 unknown + 类型守卫**
   ```typescript
   // 错误
   function parse(data: any) {
     return data.value;
   }
   
   // 正确
   function parse(data: unknown) {
     if (typeof data === 'object' && data !== null && 'value' in data) {
       return data.value;
     }
     throw new Error('Invalid data');
   }
   ```
   
   **策略 4：使用 Record**
   ```typescript
   // 错误
   const map: any = {};
   
   // 正确
   const map: Record<string, string> = {};
   ```

4. **验证修复**
   ```bash
   npm run check
   npm run lint
   npm test
   ```

### Task 1.2: 修复非空断言

**目标**：将所有非空断言替换为安全的方式

**步骤**：

1. **搜索所有非空断言**
   ```bash
   grep -r "!\\." api/ --include="*.ts"
   ```

2. **修复策略**
   
   **策略 1：使用可选链**
   ```typescript
   // 错误
   const value = obj!.property!.nested;
   
   // 正确
   const value = obj?.property?.nested;
   ```
   
   **策略 2：使用空值合并**
   ```typescript
   // 错误
   const value = obj!.property!;
   
   // 正确
   const value = obj?.property ?? defaultValue;
   ```
   
   **策略 3：使用类型守卫**
   ```typescript
   // 错误
   const item = items[0]!;
   
   // 正确
   const item = items[0];
   if (!item) {
     throw new AppError(ErrorCodes.NOT_FOUND);
   }
   ```

3. **验证修复**
   ```bash
   npm run check
   npm run lint
   npm test
   ```

## Phase 2: Prompt 管理改进（高优先级）

### Task 2.1: 识别所有硬编码 prompt

**步骤**：

1. **搜索硬编码 prompt**
   ```bash
   grep -r "You are\|你是\|作为.*助手" api/ --include="*.ts"
   ```

2. **整理 prompt 列表**
   - 记录每个 prompt 的位置、内容、用途
   - 为每个 prompt 分配唯一的 code

### Task 2.2: 创建数据库记录

**步骤**：

1. **为每个 prompt 创建数据库记录**
   ```sql
   INSERT INTO prompt_templates (code, name, description, scope, template_content, variables, is_active)
   VALUES (
     'unique_code',
     'Prompt Name',
     'Prompt Description',
     'system',
     'Prompt content with {{variables}}',
     '{"variable": "type"}'::jsonb,
     true
   );
   ```

2. **在 seed 文件中添加**
   - 编辑 `supabase/migrations/00000000000001_initial_seed.sql`
   - 添加所有新的 prompt INSERT 语句

### Task 2.3: 修改代码使用 promptService

**步骤**：

1. **修改每个硬编码 prompt 的文件**
   ```typescript
   // 错误
   const prompt = "You are an expert...";
   
   // 正确
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

3. **测试验证**
   ```bash
   npm run check
   npm test
   npx playwright test
   ```

## Phase 3: AI 监控改进（高优先级）

### Task 3.1: 识别所有 AI 调用

**步骤**：

1. **搜索 AI 调用**
   ```bash
   grep -r "chat.completions.create\|messages.*create\|embeddings.create" api/ --include="*.ts"
   ```

2. **整理 AI 调用列表**
   - 记录每个 AI 调用的位置、类型、用途

### Task 3.2: 添加 AI 监控

**步骤**：

1. **为每个 AI 调用添加监控**
   ```typescript
   const startTime = Date.now();
   let success = true;
   let errorMessage: string | undefined;
   
   try {
     const completion = await client.chat.completions.create({
       messages: [
         { role: 'system', content: systemPrompt },
         { role: 'user', content: userPrompt },
       ],
       model,
       response_format: { type: 'json_object' },
     });
     
     // 记录监控数据
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
     success = false;
     errorMessage = error.message;
     
     // 记录失败日志
     await performanceMonitor.recordLog({
       operation: 'operation_name',
       provider: 'openai',
       model: model,
       inputTokens: 0,
       outputTokens: 0,
       duration: Date.now() - startTime,
       success: false,
       errorMessage,
     });
     
     throw error;
   }
   ```

2. **按优先级添加**
   - 核心 AI 服务
   - AI 提供商
   - 其他 AI 相关服务

3. **测试验证**
   ```bash
   npm run check
   npm test
   # 测试监控数据是否正确记录
   ```

## Phase 4: 缓存改进（中优先级）

### Task 4.1: 识别频繁查询的数据

**步骤**：

1. **分析数据库查询**
   - 知识点查询
   - 图谱节点查询
   - 用户设置查询
   - 模板查询
   - 关系类型查询

2. **确定缓存策略**
   - TTL 设置
   - 缓存键设计
   - 失效策略

### Task 4.2: 添加缓存

**步骤**：

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
   // 数据更新后失效缓存
   await cacheService.invalidateGraphCache(userId, graphId);
   ```

3. **按优先级添加**
   - 知识点查询
   - 图谱节点查询
   - 用户设置查询
   - 模板查询

4. **测试验证**
   ```bash
   npm run check
   npm test
   # 测试缓存是否生效
   ```

## Phase 5: 重试机制改进（中优先级）

### Task 5.1: 识别需要重试的调用

**步骤**：

1. **识别 AI 调用**
   ```bash
   grep -r "chat.completions.create\|messages.*create" api/ --include="*.ts"
   ```

2. **识别外部 API 调用**
   ```bash
   grep -r "fetch\|axios\|request" api/ --include="*.ts"
   ```

### Task 5.2: 添加重试机制

**步骤**：

1. **使用 withTimeoutAndRetry 包装**
   ```typescript
   const result = await withTimeoutAndRetry(
     () => callAI(),
     {
       timeout: LONG_TIMEOUT, // 3分钟
       maxRetries: 3,
       initialDelay: 1000,
       maxDelay: 10000,
       onRetry: (attempt, error) => {
         logger.warn(`Retry ${attempt}: ${error.message}`);
       }
     }
   );
   ```

2. **按优先级添加**
   - 核心 AI 服务
   - AI 提供商
   - 外部 API 调用

3. **测试验证**
   ```bash
   npm run check
   npm test
   # 测试重试逻辑是否正确
   ```

## Phase 6: 错误处理改进（中优先级）

### Task 6.1: 识别所有 throw new Error

**步骤**：

1. **搜索所有 throw new Error**
   ```bash
   grep -r "throw new Error" api/ --include="*.ts"
   ```

2. **整理错误列表**
   - 记录每个错误的位置、内容、用途

### Task 6.2: 替换为 AppError

**步骤**：

1. **替换为 AppError**
   ```typescript
   // 错误
   throw new Error('Something went wrong');
   
   // 正确
   throw new AppError(ErrorCodes.INTERNAL_ERROR, {
     context: { details: 'Something went wrong' }
   });
   ```

2. **按优先级替换**
   - 核心服务
   - Agent 服务
   - 其他服务

3. **测试验证**
   ```bash
   npm run check
   npm test
   # 测试错误处理是否正确
   ```

## 实施时间表

### 第一阶段（1-2 周）

**Week 1**：
- Day 1-2: Task 1.1 - 修复 any 类型（优先级 1-2）
- Day 3-4: Task 1.1 - 修复 any 类型（优先级 3-4）
- Day 5: Task 1.2 - 修复非空断言

**Week 2**：
- Day 1-2: Task 2.1-2.2 - Prompt 管理改进
- Day 3-4: Task 2.3 - 修改代码使用 promptService
- Day 5: 测试验证

### 第二阶段（1-2 周）

**Week 3**：
- Day 1-2: Task 3.1-3.2 - AI 监控改进
- Day 3-4: Task 4.1-4.2 - 缓存改进
- Day 5: 测试验证

**Week 4**：
- Day 1-2: Task 5.1-5.2 - 重试机制改进
- Day 3-4: Task 6.1-6.2 - 错误处理改进
- Day 5: 最终测试验证

## 验证清单

每个阶段完成后，需要验证：

- [ ] 运行 `npm run check` 无类型错误
- [ ] 运行 `npm run lint` 无代码风格错误
- [ ] 运行 `npm test` 所有单元测试通过
- [ ] 运行 `npx playwright test` 所有 E2E 测试通过
- [ ] 测试监控数据是否正确记录
- [ ] 测试缓存是否生效
- [ ] 测试重试逻辑是否正确
- [ ] 测试错误处理是否正确

## 风险控制

### 风险 1：修改影响现有功能

**缓解措施**：
- 渐进式修改，每次只修改少量文件
- 修改后立即运行测试
- 保持向后兼容

### 风险 2：类型修复引入新错误

**缓解措施**：
- 使用 TypeScript 严格模式检查
- 逐个文件修复，不批量修改
- 修复后立即验证

### 风险 3：Prompt 迁移失败

**缓解措施**：
- 保留原有硬编码 prompt 作为 fallback
- 测试所有 AI 功能
- 逐步迁移，不一次性全部修改

### 风险 4：性能监控影响性能

**缓解措施**：
- 使用异步记录监控数据
- 不阻塞主流程
- 监控数据写入数据库失败不影响主流程

## 成功标准

改进完成后，项目应达到以下标准：

1. **类型安全**：
   - 0 个 `any` 类型
   - 0 个非空断言
   - 所有类型检查通过

2. **Prompt 管理**：
   - 0 个硬编码 prompt
   - 所有 prompt 从数据库读取
   - 支持用户自定义 prompt

3. **AI 监控**：
   - 所有 AI 调用都有性能监控
   - 监控数据完整准确
   - 可以追踪成本和性能

4. **缓存优化**：
   - 频繁查询的数据都有缓存
   - 缓存命中率 > 80%
   - 响应速度提升 > 50%

5. **重试机制**：
   - 所有不稳定调用都有重试
   - 成功率 > 95%
   - 用户体验改善

6. **错误处理**：
   - 所有错误都使用 AppError
   - 错误代码完整
   - 错误信息清晰

## 总结

本实施计划提供了详细的改进步骤和时间表，通过分阶段实施，可以系统性地改进项目中的机制贯彻情况，显著提高代码质量、性能和可维护性。
