# 补充服务层计划

## 背景

当前项目有 18 个数据库表，但服务层覆盖不完整。需要补充以下服务层：

### 数据库表 vs 服务层对照

| 数据库表 | 现有服务层 | 状态 |
|---------|-----------|------|
| users | - | 通过 Supabase Auth 管理 |
| knowledge_graphs | graphService.ts | ✅ 已覆盖 |
| knowledge_points | knowledgePointService.ts | ✅ 已覆盖 |
| graph_nodes | graphNodeService.ts | ✅ 已覆盖 |
| edges | edgeService.ts | ✅ 已覆盖 |
| study_cards | studyService.ts | ✅ 已覆盖 |
| study_progress | - | ❌ 需要补充 |
| tasks | taskService.ts | ✅ 已覆盖 |
| templates | templateService.ts | ✅ 已覆盖 |
| prompt_templates | promptService.ts | ✅ 已覆盖 |
| ai_actions | aiActionService.ts | ✅ 已覆盖 |
| app_settings | settingsService.ts | ✅ 已覆盖 |
| focus_sessions | - | ❌ 需要补充 |
| achievements | achievementService.ts | ✅ 已覆盖 |
| user_achievements | achievementService.ts | ✅ 已覆盖 |
| daily_tasks | achievementService.ts | ✅ 已覆盖 |
| graph_relations | - | ❌ 需要补充 |
| backup_snapshots | backupService.ts | ✅ 已覆盖 |

### 需要补充的服务层

1. **focusService.ts** - 专注会话服务
   - `createSession()` - 创建专注会话
   - `getStats()` - 获取专注统计
   - `getSessions()` - 获取会话列表

2. **studyProgressService.ts** - 学习进度服务
   - `getProgress()` - 获取学习进度
   - `updateProgress()` - 更新学习进度

3. **graphRelationService.ts** - 图谱关系服务
   - `createRelation()` - 创建图谱关系
   - `getRelations()` - 获取图谱关系
   - `deleteRelation()` - 删除图谱关系

## 执行步骤

### Step 1: 创建 focusService.ts

封装 `focus_sessions` 表操作：
- `createSession(supabase, userId, data)` - 创建专注会话
- `getStats(supabase, userId, options)` - 获取专注统计
- `getSessions(supabase, userId, options)` - 获取会话列表
- `getTodayStats(supabase, userId)` - 获取今日统计

### Step 2: 创建 studyProgressService.ts

封装 `study_progress` 表操作：
- `getProgress(supabase, userId, graphId)` - 获取学习进度
- `updateProgress(supabase, userId, graphId, data)` - 更新学习进度
- `recalculateProgress(supabase, userId, graphId)` - 重新计算进度

### Step 3: 创建 graphRelationService.ts

封装 `graph_relations` 表操作：
- `createRelation(supabase, data)` - 创建图谱关系
- `getRelations(supabase, graphId)` - 获取图谱关系
- `deleteRelation(supabase, relationId)` - 删除图谱关系
- `getPrerequisites(supabase, graphId)` - 获取前置图谱
- `getExtensions(supabase, graphId)` - 获取扩展图谱

### Step 4: 重构相关路由

- `api/routes/focus.ts` - 调用 focusService
- `api/routes/graphRelations.ts` - 调用 graphRelationService
- `api/routes/study.ts` - 补充 studyProgressService 调用

## 注意事项

1. 保持与现有服务层一致的代码风格
2. 使用 SupabaseClient 作为参数，而非直接导入
3. 返回类型化的结果
4. 添加适当的缓存策略
