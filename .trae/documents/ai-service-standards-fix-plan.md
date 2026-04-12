# AI 服务开发规范修复计划

## 问题分析

### 问题 1: Prompt 管理不规范

**当前问题**：
- `templateGeneratorService.ts` 中硬编码了 prompt（`TEMPLATE_GENERATION_PROMPT`）
- 应该从数据库读取 prompt，支持 system 和 user 两个层级

**项目规范**：
- Prompt 存储在 `prompt_templates` 表中
- 分为三个层级：system（系统级）、user（用户级）、graph（图谱级）
- 优先级：graph > user > system
- JSON 格式要求硬编码在后端 `promptService.ts` 的 `OUTPUT_SCHEMAS` 中

### 问题 2: 缺少 AI 监控

**当前问题**：
- `templateGeneratorService.ts` 中没有记录 token 使用量等监控数据
- 应该使用 `performanceMonitor` 记录 AI 调用性能

**项目规范**：
- 所有 AI 调用都应该使用 `performanceMonitor.recordLog()` 记录
- 记录内容包括：inputTokens、outputTokens、estimatedCost、duration 等
- 数据存储在 `ai_performance_logs` 表中

## 修复计划

### Phase 1: 更新项目文档

#### Task 1: 在项目规则文档中添加 AI 服务开发规范

**文件**: `d:\KnowledgeMap\.trae\rules\project_rules.md`

**添加内容**:

```markdown
## AI 服务开发规范

### Prompt 管理规范

**重要**：所有 AI 服务的 prompt 必须从数据库读取，禁止硬编码。

#### Prompt 层级

项目使用三层 prompt 管理机制：

1. **System 级别**：系统预设的 prompt，所有用户共享
2. **User 级别**：用户自定义的 prompt，覆盖 system 级别
3. **Graph 级别**：特定图谱的 prompt，优先级最高

优先级：Graph > User > System

#### Prompt 存储位置

- 数据库表：`prompt_templates`
- 字段：`code`（唯一标识）、`level`（层级）、`content`（内容）、`variables`（变量）

#### 使用方式

```typescript
import { promptService } from '../services/ai/promptService';

// 从数据库读取 prompt
const systemPrompt = await promptService.getRenderedPrompt(
  supabaseAdmin,
  'prompt_code',  // prompt 唯一标识
  {
    // 变量替换
    variable1: 'value1',
    variable2: 'value2',
  }
);
```

#### JSON 格式要求

JSON 格式要求硬编码在后端 `promptService.ts` 的 `OUTPUT_SCHEMAS` 中，不需要在 prompt 中重复定义。

### AI 监控规范

**重要**：所有 AI 调用必须记录性能数据。

#### 监控内容

每次 AI 调用需要记录：
- `operation`：操作类型（如 auto_graph_init、template_generation）
- `provider`：AI 提供商（如 openai、anthropic）
- `model`：模型名称
- `inputTokens`：输入 token 数
- `outputTokens`：输出 token 数
- `totalTokens`：总 token 数
- `estimatedCost`：预估成本
- `duration`：调用时长（毫秒）
- `success`：是否成功
- `errorMessage`：错误信息（如果失败）

#### 使用方式

```typescript
import { performanceMonitor } from '../services/ai/performanceMonitor';

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
    operation: 'your_operation_name',
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
    operation: 'your_operation_name',
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

#### 参考实现

参考 `api/routes/autoGraph.ts` 中的 `withAutoGraphTracking` 函数实现。
```

### Phase 2: 修复 templateGeneratorService.ts

#### Task 2: 移除硬编码的 prompt

**文件**: `api/services/ai/templateGeneratorService.ts`

**修改内容**:
1. 删除 `TEMPLATE_GENERATION_PROMPT` 常量
2. 修改 `buildSystemPrompt()` 方法，使用 `promptService.getRenderedPrompt()` 从数据库读取 prompt
3. 保留 JSON 格式验证逻辑（`validateNode`, `validateEdge`, `validateTemplate`）

#### Task 3: 添加 AI 监控

**文件**: `api/services/ai/templateGeneratorService.ts`

**修改内容**:
1. 导入 `performanceMonitor`
2. 在 `callAI()` 方法中添加监控记录
3. 记录 token 使用量、成本、时长等数据

### Phase 3: 添加数据库 Prompt 模板

#### Task 4: 添加模板生成 prompt

**文件**: `supabase/migrations/00000000000001_initial_seed.sql`

**添加内容**:
```sql
-- 模板生成 prompt（system 级别）
INSERT INTO prompt_templates (code, name, description, level, content, variables, is_active) VALUES
  ('template_generation', '模板生成 Prompt', 'AI 生成知识图谱模板的系统 prompt', 'system', 
   'You are an expert knowledge graph template designer. Your task is to generate 3 different template schemes for the given topic.

## Requirements

For each template scheme, provide:
1. **Unique Structure**: Each template should have a different organizational approach
2. **Node Hierarchy**: Clear parent-child relationships with appropriate levels (root, core, sub, normal, leaf)
3. **Edge Relationships**: Meaningful connections between nodes
4. **Content Suggestions**: Brief description of what each node should contain
5. **Layout Recommendation**: Suggest the best layout type (radial, tree, network, hierarchical)
6. **Difficulty Assessment**: Rate the complexity (easy, medium, hard)
7. **Tags**: Auto-generate relevant tags for categorization

## Template Types to Consider

1. **Hierarchical/Tree Structure**: Top-down organization with clear levels
2. **Network/Mesh Structure**: Interconnected concepts with multiple relationships
3. **Process/Flow Structure**: Sequential or cyclical knowledge flow
4. **Quadrant/Matrix Structure**: Organized by two dimensions
5. **Timeline Structure**: Chronological or evolutionary progression

## Guidelines

1. Generate exactly 3 different template schemes
2. Each template should have 5-15 nodes as examples
3. Use meaningful node titles (not generic like "Node 1")
4. Ensure all edge references point to valid node IDs
5. Consider the topic''s nature when choosing structures
6. Provide clear reasoning for each template choice
7. Respond in Chinese for all descriptions and content

{{#if category}}
## Category Guidance
{{categoryGuidance}}
{{/if}}

{{#if preferredLayout}}
## Preferred Layout
{{layoutGuidance}}
{{/if}}',
   '{"category": "string", "preferredLayout": "string", "categoryGuidance": "string", "layoutGuidance": "string"}'::jsonb,
   true
  );

-- 模板应用 prompt（system 级别）
INSERT INTO prompt_templates (code, name, description, level, content, variables, is_active) VALUES
  ('template_application', '模板应用 Prompt', 'AI 基于模板生成图谱内容的系统 prompt', 'system',
   'You are an expert knowledge graph content generator. Your task is to generate detailed content for a knowledge graph based on the provided template structure.

## Requirements

For each node in the template:
1. **Detailed Content**: Generate comprehensive content based on the node''s title and suggested content
2. **Style Consistency**: Maintain the selected style throughout (academic, practical, beginner, or custom)
3. **Context Awareness**: Consider the topic and context when generating content
4. **Language**: Respond in Chinese

## Style Guidelines

- **Academic**: Use professional terminology, theoretical frameworks, and scholarly language
- **Practical**: Use plain language, real-world examples, and actionable insights
- **Beginner**: Use simple language, step-by-step explanations, and foundational concepts
- **Custom**: Follow the user''s custom instructions

## Output Format

Generate content for each node while maintaining the template structure.',
   '{"style": "string", "topic": "string", "context": "string"}'::jsonb,
   true
  );
```

### Phase 4: 更新 JSON 格式定义

#### Task 5: 在 promptService.ts 中添加 JSON 格式定义

**文件**: `api/services/ai/promptService.ts`

**添加内容**:
在 `OUTPUT_SCHEMAS` 中添加模板生成的 JSON 格式定义：

```typescript
template_generation: {
  type: 'object',
  properties: {
    templates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          nodes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                description: { type: 'string' },
                level: { type: 'string', enum: ['root', 'core', 'sub', 'normal', 'leaf'] },
                parentId: { type: 'string', nullable: true },
                suggestedContent: { type: 'string' },
                color: { type: 'string' },
              },
              required: ['id', 'title', 'level'],
            },
          },
          edges: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                source: { type: 'string' },
                target: { type: 'string' },
                relationship_type: { type: 'string' },
                description: { type: 'string' },
              },
              required: ['source', 'target'],
            },
          },
          layoutSuggestion: { type: 'string', enum: ['radial', 'tree', 'network', 'hierarchical'] },
          estimatedNodes: { type: 'number' },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
          tags: { type: 'array', items: { type: 'string' } },
          reasoning: { type: 'string' },
        },
        required: ['id', 'name', 'nodes', 'edges', 'layoutSuggestion', 'difficulty', 'tags'],
      },
    },
  },
  required: ['templates'],
},
```

### Phase 5: 测试和验证

#### Task 6: 本地测试

1. 运行 `npx supabase db reset` 重置本地数据库
2. 验证 prompt 模板正确插入
3. 测试模板生成功能，确认 prompt 从数据库读取
4. 检查 AI 监控数据是否正确记录

#### Task 7: 代码质量检查

1. 运行 `npm run lint` 检查代码风格
2. 运行 `npm run check` 检查类型错误
3. 修复所有问题

## 预期结果

1. **Prompt 管理规范化**：所有 prompt 从数据库读取，支持 system 和 user 两个层级
2. **AI 监控完善**：所有 AI 调用都有性能监控数据
3. **文档完善**：项目规则文档中添加了 AI 服务开发规范
4. **代码质量**：通过 lint 和类型检查

## 依赖关系

- Task 2-3 依赖 Task 1（文档更新）
- Task 4-5 可以并行执行
- Task 6-7 依赖 Task 2-5（所有代码修改完成）
