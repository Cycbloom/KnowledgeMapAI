# 路由层业务逻辑下沉（第六轮）Spec

## Why
前五轮重构已将路由层 DB 调用从 367 次降至 74 次（降幅 80%）。本轮聚焦剩余 **4 个中优先级文件**（≥5 次 DB 调用），它们合计 25 次调用，占剩余总量的 33.8%。

## What Changes
- **新增** `api/services/graph/graphExpansionService.ts` — 图谱扩展/初始化/骨干修复逻辑（从 `graphs/expansion.ts` 提取，8 次 DB 调用）
- **新增** `api/services/story/characterService.ts` — 角色 CRUD + 关系统计（从 `story/characters.ts` 提取，6 次 DB 调用）
- **新增** `api/services/scheduler/calendarService.ts` — 日历导出/订阅/事件查询（从 `calendar.ts` 提取，6 次 DB 调用）
- **新增** `api/services/study/learningPathRouteService.ts` — 学习路径生成/进度/问题生成（从 `learningPath.ts` 提取，5 次 DB 调用）
- **修改** 对应的 4 个路由文件，精简为委托调用

## Impact
- Affected specs: 无破坏性变更，所有 API 接口保持不变
- Affected code:
  - `api/routes/graphs/expansion.ts`（精简直接 DB 调用的路由）
  - `api/routes/story/characters.ts`（精简全部路由）
  - `api/routes/calendar.ts`（精简全部路由）
  - `api/routes/learningPath.ts`（精简全部路由）

## ADDED Requirements

### Requirement: 图谱扩展服务（graphExpansionService）
系统 SHALL 提供 `graphExpansionService` 封装图谱扩展、初始化和骨干修复逻辑。

- `batchInitialize(supabase, userId, graphIds, style, sessionId?)` — 批量初始化图谱：查询图谱 → 检查已有知识点 → 创建异步任务
- `initializeGraph(supabase, userId, graphId, style)` — 单个图谱初始化：查询图谱 → 检查已有知识点 → 自动快照 → 创建异步任务
- `validateBackbone(supabase, userId, graphId, nodes, context?, useAI?)` — 骨干验证：查询图谱 → 调用 backboneValidatorService
- `fixBackboneModules(supabase, userId, graphId)` — 修复骨干模块：查询图谱 → 查询节点 → 匹配 TITLE_TO_BACKBONE_MODULE → 更新 properties

### Requirement: 角色服务（characterService）
系统 SHALL 提供 `characterService` 封装故事角色管理逻辑。

- `list(supabase, graphId)` — 查询角色列表 + 关系统计 + 出场统计
- `create(supabase, graphId, data)` — 创建角色
- `update(supabase, graphId, characterId, data)` — 更新角色
- `delete(supabase, graphId, characterId)` — 删除角色

### Requirement: 日历服务（calendarService）
系统 SHALL 提供 `calendarService` 封装日历导出和事件查询逻辑。

- `exportICS(supabase, userId)` — ICS 导出：查询任务和执行记录 → 生成 ICS 内容
- `subscribeICS(supabase, userId)` — WebCal 订阅：验证用户 → 查询任务和执行记录 → 生成 ICS
- `getEvents(supabase, userId, start?, end?)` — 查询日历事件：查询任务 → 格式化为事件
- `generateICSContent(tasks, executions)` — ICS 内容生成辅助方法

### Requirement: 学习路径路由服务（learningPathRouteService）
系统 SHALL 提供 `learningPathRouteService` 封装学习路径生成和进度查询逻辑。

- `generatePath(supabase, userId, data)` — 生成学习路径：查询图谱节点 → 构建进度图 → AI/规则生成 → 构建完整路径
- `getProgress(supabase, userId, graphId)` — 获取学习进度：查询图谱节点 → 查询学习卡片 → 计算掌握度
- `generateQuestions(supabase, userId, data)` — 生成学习问题：查询图谱 → AI 生成问题 → 检查重复图谱

## MODIFIED Requirements

无额外修改。

## REMOVED Requirements

无。所有 API 行为保持不变。
