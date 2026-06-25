# AI 知识播客脚本生成验证错误修复计划

## 问题概述

调用 `/api/ai/podcast/script` API 时出现验证错误：
```
{ "field": "topic", "message": "Required" }
```

## 问题分析

### 根本原因：字段命名不一致

| 层级 | 当前状态 | 问题 |
|------|---------|------|
| **Schema** (`api/schemas/index.ts`) | `topic: z.string().min(1, "主题不能为空")` (必需) | 定义了 `topic` 为必需字段 |
| **前端 API** (`src/services/api/ai.ts`) | 传递 `{ context, language, graph_id }` | 没有 `topic` 字段 |
| **后端路由** (`api/routes/ai/content.ts`) | 提取 `req.body.topic` 和 `req.body.content` | 期望 `topic` 字段 |
| **后端服务** (`contentGenerationService.ts`) | 接收 `context` 参数 | 实际使用 `context` |
| **接口定义** (`IAiApi.ts`) | `generatePodcastScript(context, language?, graph_id?)` | 定义使用 `context` |

### 不一致点

1. Schema 要求 `topic` 必需，但前端传递 `context`
2. Schema 没有定义 `language` 和 `graph_id` 字段
3. 后端路由提取 `topic`，但服务实际需要 `context`

## 修复方案

### 方案：统一使用 `context` 字段

根据接口定义和实际业务逻辑（传递图谱节点的上下文内容），应使用 `context` 作为主要字段。

### 修改文件清单

#### 1. `api/schemas/index.ts` (第 418-425 行)

**当前代码**:
```typescript
export const podcastScriptSchema = z.object({
  topic: z.string().min(1, "主题不能为空"),
  content: z.string().optional(),
  style: z.enum(["conversational", "lecture", "interview"]).optional(),
  duration_minutes: z.number().min(1).max(60).optional(),
  provider: z.enum(["deepseek", "volcengine", "aliyun"]).optional(),
  model: z.string().optional(),
});
```

**修改为**:
```typescript
export const podcastScriptSchema = z.object({
  context: z.string().min(1, "内容不能为空"),
  language: z.string().optional(),
  graph_id: z.string().uuid("无效的图谱ID").optional(),
  style: z.enum(["conversational", "lecture", "interview"]).optional(),
  duration_minutes: z.number().min(1).max(60).optional(),
  provider: z.enum(["deepseek", "volcengine", "aliyun"]).optional(),
  model: z.string().optional(),
});
```

**变更说明**:
- 将 `topic` 改为 `context`（必需字段）
- 移除 `content` 字段（冗余，`context` 已包含内容）
- 添加 `language` 和 `graph_id` 字段（可选）

#### 2. `api/routes/ai/content.ts` (第 130-146 行)

**当前代码**:
```typescript
router.post(
  "/podcast/script",
  requireAuth,
  validate(podcastScriptSchema),
  async (req: AuthRequest, res: Response) => {
    const { topic, content } = req.body;

    try {
      const script = await aiService.generatePodcastScript(topic, content);
      res.json({ script });
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Podcast Script Generation Error:", error);
      throw new AppError(err.message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);
```

**修改为**:
```typescript
router.post(
  "/podcast/script",
  requireAuth,
  validate(podcastScriptSchema),
  async (req: AuthRequest, res: Response) => {
    const { context, language } = req.body;

    try {
      const script = await aiService.generatePodcastScript(context, language);
      res.json({ script });
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Podcast Script Generation Error:", error);
      throw new AppError(err.message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  },
);
```

**变更说明**:
- 从 `req.body` 提取 `context` 和 `language`
- 调用服务时传递正确的参数

#### 3. `api/services/ai/aiService.ts` (第 141-142 行)

**当前代码**:
```typescript
async generatePodcastScript(context: string, language?: string) {
  return contentGenerationService.generatePodcastScript(context, language);
}
```

**无需修改** - 参数命名已正确。

## 验证步骤

1. 运行类型检查：`npm run check`
2. 运行 lint 检查：`npm run lint`
3. 手动测试：打开播客模态框，验证脚本生成功能

## 影响范围

- **前端**：无需修改，已正确传递 `context` 字段
- **Mobile API**：无需修改，已正确传递 `context` 字段
- **后端**：Schema 和路由需要修改

## 预期结果

修复后，API 调用将成功验证并生成播客脚本。