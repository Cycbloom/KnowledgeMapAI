# 修复分支功能计划

## 问题概述

分支功能存在 3 个问题：
1. **创建分支时属性丢失**：`createBranch` 只复制了 `user_id` 和 `title`，丢失了 `description`、`domain`、`settings`、`reference_books`、`external_links`、`learning_guide`、`podcast_script`、`template_type` 等关键属性
2. **无法删除分支**：`BranchManagePanel` 中只有「查看」和「合并」按钮，没有「删除」操作
3. **删除原图谱时分支未级联删除**：`deleteGraph`、`deleteGraphs`、`permanentDeleteGraph`、`permanentDeleteGraphs` 都没有处理分支的级联删除

## 修复步骤

### Step 1: 修复 `createBranch` 属性复制（后端）

**文件**: `api/services/graph/graphVersionService.ts`

将 `createBranch` 方法中的查询和插入逻辑改为复制所有需要继承的属性：

- 修改 `select('user_id, title')` 为 `select('user_id, title, description, domain, settings, reference_books, external_links, learning_guide, podcast_script, template_type')`
- 修改 `insert` 语句，将查询到的所有属性写入新图谱
- `is_public` 和 `is_favorite` 不复制（分支默认不公开、不收藏）
- `embedding` 不复制（分支内容可能不同，嵌入应独立计算）

### Step 2: 添加分支级联删除逻辑（后端）

**文件**: `api/services/graph/graphService.ts`

在以下 4 个方法中添加分支级联删除逻辑：

1. **`deleteGraph`**（软删除）：删除原图谱前，先查询其所有分支，将分支也软删除
2. **`deleteGraphs`**（批量软删除）：同上，对每个图谱检查并级联删除分支
3. **`permanentDeleteGraph`**（永久删除）：永久删除原图谱前，先永久删除其所有分支
4. **`permanentDeleteGraphs`**（批量永久删除）：同上

级联删除的实现方式：
- 查询 `knowledge_graphs` 中 `parent_graph_id = graphId AND is_branch = true AND deleted_at IS NULL`（软删除时）或 `parent_graph_id = graphId AND is_branch = true`（永久删除时）
- 对查到的分支执行相同的删除操作（软删除或永久删除）
- 发布相应的 `graph_deleted` 事件

### Step 3: 添加分支删除 UI（前端）

**文件**: `src/components/GraphEditor/panels/BranchManagePanel.tsx`

- 在 `BranchItem` 组件中添加「删除」按钮（红色，使用 `Trash2` 图标）
- 点击后弹出确认对话框
- 确认后调用已有的 `api.graphs.delete()` API（分支本质是图谱，复用现有删除接口）
- 删除成功后刷新分支列表

**文件**: `src/hooks/mutations/useGraphVersionMutations.ts`

- 添加 `useDeleteBranch` hook，调用 `api.graphs.delete()`，成功后失效 `graphBranches` 查询键并发布 `graph_list_changed` 事件

### Step 4: 添加分支删除 API 路由（后端，可选）

分支本质是 `is_branch=true` 的图谱，删除可以直接复用现有的 `DELETE /graphs/:id` 端点。但为了语义清晰，可以在版本控制路由中添加一个 `DELETE /graphs/:id/branches/:branchId` 端点，内部调用 `graphService.deleteGraph`。

**决策**：直接复用现有删除 API，前端调用 `api.graphs.delete(branchId)` 即可，无需新增路由。

## 修改文件清单

| 文件 | 修改内容 |
|------|---------|
| `api/services/graph/graphVersionService.ts` | `createBranch` 方法复制完整属性 |
| `api/services/graph/graphService.ts` | 4 个删除方法添加分支级联删除 |
| `src/components/GraphEditor/panels/BranchManagePanel.tsx` | 添加删除按钮和确认对话框 |
| `src/hooks/mutations/useGraphVersionMutations.ts` | 添加 `useDeleteBranch` hook |

## 不需要修改的文件

- `api/routes/graphs/versions.ts` — 无需新增删除路由，复用现有图谱删除 API
- `src/services/api/graphVersions.ts` — 无需新增 API 方法
- 数据库迁移 — 无 schema 变更
