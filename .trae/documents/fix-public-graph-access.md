# 修复公开图谱访问问题计划

## 问题分析

### 现象
用户 A 设置图谱为公开访问，复制分享链接 `/graph/{graphId}` 给用户 B。用户 B 打开链接后显示"暂无节点"。

### 根本原因

经过代码分析，发现问题出在**前端路由保护**：

1. **前端路由配置** ([App.tsx:127-162](file:///d:/KnowledgeMap/src/App.tsx#L127-L162))
   - `/graph/:id` 路由被包裹在 `<ProtectedRoute>` 组件中
   - `ProtectedRoute` 检查 `token`，如果没有 token 就重定向到 `/login`
   - **这意味着未登录用户无法访问公开图谱！**

2. **后端 RLS 策略是正确的** ([schema.sql:1221-1231](file:///d:/KnowledgeMap/supabase/migrations/00000000000000_initial_schema.sql#L1221-L1231))
   ```sql
   CREATE POLICY "Users can view graph_nodes of accessible graphs" ON graph_nodes FOR SELECT USING (
     EXISTS (
       SELECT 1 FROM knowledge_graphs 
       WHERE knowledge_graphs.id = graph_nodes.graph_id 
       AND (
         knowledge_graphs.user_id = auth.uid() 
         OR knowledge_graphs.is_public = true  -- 公开图谱允许匿名访问
         OR public.is_graph_collaborator(knowledge_graphs.id, auth.uid())
       )
     )
   );
   ```

3. **后端 API 支持匿名访问** ([graphs.ts:460-479](file:///d:/KnowledgeMap/api/routes/graphs.ts#L460-L479))
   - `/:id/nodes` 路由使用 `optionalAuth` 中间件
   - 未登录用户可以使用 `supabaseAnon` 客户端访问公开图谱

### 问题链路

```
用户 B（未登录）访问 /graph/{graphId}
    ↓
ProtectedRoute 检查 token
    ↓
token 不存在 → 重定向到 /login
    ↓
用户无法看到公开图谱内容
```

## 解决方案

### 方案：修改前端路由，允许匿名访问公开图谱

需要修改以下内容：

#### 1. 修改 App.tsx 路由配置
- 将 `/graph/:id` 路由移出 `ProtectedRoute`
- 在 GraphEditor 组件内部处理认证状态

#### 2. 修改 GraphEditor.tsx
- 检测用户是否登录
- 如果未登录，尝试获取图谱数据（公开图谱应该可以访问）
- 如果图谱不公开且用户未登录，显示提示或重定向到登录

#### 3. 修改 API 客户端
- 确保未登录用户也能发起 API 请求（不带 Authorization header）

#### 4. 修改 GraphToolbar 等组件
- 未登录用户隐藏编辑相关功能
- 显示"只读模式"提示

## 实施步骤

### Step 1: 修改路由配置
- 文件: `src/App.tsx`
- 将 `/graph/:id` 路由移到 `ProtectedRoute` 外部
- 添加新的路由结构支持公开访问

### Step 2: 修改 GraphEditor 组件
- 文件: `src/pages/GraphEditor.tsx`
- 添加公开访问状态检测
- 未登录用户显示只读模式
- 处理图谱不存在或无权限的情况

### Step 3: 修改 useGraph hook
- 文件: `src/hooks/queries/useGraph.ts`
- 支持无 token 情况下的数据获取

### Step 4: 修改工具栏组件
- 文件: `src/components/GraphEditor/toolbar/GraphToolbar.tsx`
- 根据登录状态显示/隐藏编辑功能

### Step 5: 添加公开访问提示 UI
- 显示"只读模式"或"公开图谱"标识
- 提供"登录以编辑"按钮

### Step 6: 测试验证
- 创建测试用例验证公开图谱访问
- 测试未登录用户访问私有图谱的行为
- 测试已登录用户访问公开图谱的行为
