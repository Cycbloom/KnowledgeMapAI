# 修复 intelligent-suggestions API 验证错误

## 问题分析

### 错误现象
请求 `GET /api/graphs/intelligent-suggestions` 返回验证错误：
```json
{
    "success": false,
    "code": "VALIDATION_ERROR",
    "error": "输入验证失败",
    "details": [
        {
            "field": "id",
            "message": "无效的ID格式"
        }
    ]
}
```

### 根本原因
在 [graphs.ts](file:///d:/KnowledgeMap/api/routes/graphs.ts) 中，路由定义的顺序导致了问题：

1. **第 332 行**：`router.get("/:id", ...)` - 带有 `validate({ params: uuidParamsSchema })` 验证
2. **第 1139 行**：`router.get("/intelligent-suggestions", ...)` - 智能建议路由

Express 路由按定义顺序匹配，当请求 `/graphs/intelligent-suggestions` 时：
1. Express 首先遇到 `/:id` 路由
2. 将 `intelligent-suggestions` 作为 `id` 参数匹配
3. 执行 `uuidParamsSchema` 验证，要求 `id` 必须是有效的 UUID 格式
4. 验证失败，返回 "无效的ID格式" 错误

### 验证 schema
在 [schemas/index.ts:26-28](file:///d:/KnowledgeMap/api/schemas/index.ts#L26-L28)：
```typescript
export const uuidParamsSchema = z.object({
  id: z.string().uuid("无效的ID格式"),
});
```

## 解决方案

将 `/intelligent-suggestions` 路由移动到 `/:id` 路由**之前**定义。

Express 路由匹配遵循"先到先得"原则，具体的路由路径应该在参数化路由（如 `/:id`）之前定义。

## 实施步骤

### 步骤 1：移动路由定义
将第 1139-1162 行的 `intelligent-suggestions` 路由移动到第 332 行的 `/:id` 路由之前。

需要移动的代码块：
```typescript
router.get(
  "/intelligent-suggestions",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    // ... 实现代码
  },
);
```

### 步骤 2：验证修复
1. 启动开发服务器
2. 测试 `GET /api/graphs/intelligent-suggestions` 端点
3. 确认返回正确的智能建议数据，而非验证错误

## 受影响文件
- `api/routes/graphs.ts` - 需要调整路由顺序

## 注意事项
- 此类路由顺序问题在 Express 中很常见
- 原则：具体路径路由 > 参数化路由（`/:id`）
- 类似的其他固定路径路由（如 `/trash`、`/map`、`/tags`）已经正确放置在 `/:id` 之前
