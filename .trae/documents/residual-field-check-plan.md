# 残留字段名检查计划

## 发现的问题

搜索发现以下问题：

### 1. 数据库字段名错误

代码中使用了 `node_id` 作为数据库字段名，但数据库 schema 中 `study_cards` 表使用的是 `knowledge_point_id`：

| 文件 | 问题 |
|------|------|
| `api/routes/learningPath.ts:564-565` | `.select('id, node_id')` 和 `.in('node_id', nodeIds)` |
| `api/services/graphService.ts:353` | `.select('node_id, next_review, ...')` |
| `api/routes/health.ts:43,183-184,277-278,470-471` | 多处使用 `node_id` 作为数据库字段 |

### 2. 其他 `node_id` 用法（需要区分）

以下 `node_id` 是正确的用法：
- **API 参数名**：如 `node_id: z.string()` - 这是请求参数，不是数据库字段
- **变量名**：如 `const node_id = ...` - 这是代码中的变量
- **URL 参数**：如 `?node_id=xxx` - 这是 URL 查询参数
- **类型定义**：如 `node_id: string` - 这是接口属性

### 3. 需要确认的 `node_id`

| 文件 | 用途 | 是否需要修改 |
|------|------|-------------|
| `src/types/index.ts:598` | `LearningPathNodeRef.node_id` | 需要确认数据库 schema |
| `api/routes/learningPath.ts:107,114` | `cards!inner(node_id)` | 需要修改为 `knowledge_point_id` |

## 执行步骤

### Step 1: 修复数据库字段名错误
- 修复 `api/routes/learningPath.ts` 中的 `node_id` → `knowledge_point_id`
- 修复 `api/services/graphService.ts` 中的 `node_id` → `knowledge_point_id`
- 修复 `api/routes/health.ts` 中的 `node_id` → `knowledge_point_id`

### Step 2: 检查 learning_path_nodes 表 schema
- 确认 `learning_path_nodes` 表是否使用 `node_id` 字段
- 如果是，保持不变；如果不是，需要修改

### Step 3: 验证修复
- 运行 TypeScript 检查
- 确保没有遗漏
