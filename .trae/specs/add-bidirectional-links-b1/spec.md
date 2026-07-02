# B1 双向链接 / 反向链接 Spec

## Why

KnowledgeMap 当前缺少节点间的双向关联能力：用户在节点内容中无法引用其他节点，也无法查看"哪些节点引用了当前节点"。这割裂了知识图谱（结构化边）与节点内容（自由文本）两套关联体系，导致用户必须在图谱编辑器和节点编辑器之间反复切换才能建立关联。

B1 通过引入 Obsidian 风格的 `[[节点名]]` 双链语法，让节点内容中的引用自动同步为图谱边（`relationship_type='relates_to'`），并提供反向链接面板让用户反向发现引用来源，实现"双链即图谱边"的统一关联模型。

## What Changes

### Schema 变更（supabase/migrations/04_graph_structure.sql）
- **不新建表**：复用现有 `edges` 表承载双链关系
- **新增索引**：`idx_edges_backlinks` on `(target_knowledge_point_id, relationship_type, deleted_at)` 加速反向链接查询
- **新增索引**：`idx_edges_outlinks` on `(source_knowledge_point_id, relationship_type, deleted_at)` 加速正向链接查询
- 复用现有 `UNIQUE(graph_id, source_knowledge_point_id, target_knowledge_point_id, relationship_type)` 约束避免重复边

### 后端 API 新增
- 新增 `api/routes/backlinks.ts` 路由文件
- 新增 `api/services/graph/backlinkService.ts` 服务（反向链接查询、节点搜索、双链同步）
- 新增 `IBacklinksApi` 契约与 `backlinksApi` 实现
- 新增 `mobileBacklinksApi` 移动层对应实现

### 前端组件新增
- `src/components/GraphEditor/sidebar/BacklinksPanel.tsx`：反向链接面板（NodeEditSidebar 新增 Tab）
- `src/components/GraphEditor/sidebar/NodeLinkSelector.tsx`：`[[` 触发的节点选择器浮层
- `src/utils/wikiLinkRemarkPlugin.ts`：remark 插件，将 `[[节点名]]` 渲染为可点击链接
- `src/hooks/useBacklinks.ts`：反向链接查询 hook

### Shared 层新增
- `shared/utils/wikiLink.ts`：双链解析工具（`extractWikiLinks`、`resolveWikiLink`），复用并重构 `markdownParser.ts` 中已有的 `[[]]` 解析逻辑

### 现有文件修改
- `src/components/GraphEditor/sidebar/NodeEditSidebar.tsx`：内容编辑器监听 `[[` 触发选择器；预览模式接入双链渲染；新增"反向链接" Tab
- `src/services/api/contracts/IApi.ts`：注册 `backlinks: IBacklinksApi`
- `src/services/api/contracts/index.ts`：导出 `IBacklinksApi`
- `src/services/api/index.ts`：导出 `backlinksApi` 实例
- `src/services/api/createApiClient.ts`：注册 `backlinks` 字段
- `api/services/graph/knowledgePointService.ts`：节点保存时调用双链同步
- `src/i18n/locales/zh-CN/graphEditor.json` 与 `en-US/graphEditor.json`：新增双链相关文案

### 运行时实时解析方案
- 内容编辑器监听 textarea 的 `selectionStart` 与输入事件
- 检测到 `[[` 时弹出 `NodeLinkSelector` 浮层（基于光标位置定位）
- 用户搜索并选中目标节点后，在光标处插入 `[[节点标题]]`
- 预览模式渲染时，通过自定义 remark 插件将 `[[节点标题]]` 转换为 `<a class="wiki-link" data-title="...">节点标题</a>`
- 点击链接时调用 `backlinksApi.search(title)` 解析目标节点并跳转

### 双链与 edges 同步方案
- 节点保存时，后端 `backlinkService.syncBacklinks(knowledgePointId, graphId, content)` 被调用
- 解析 content 中的所有 `[[标题]]`，按标题查找目标 `knowledge_point`（优先同图谱，其次全局）
- 对比当前 `edges` 表中 `source=当前KP, relationship_type='relates_to', graph_id=当前graph` 的记录
- 新增的双链 → 调用 `edgeService.create()` 创建 edge
- 消失的双链 → 软删除对应 edge
- 保留用户手动创建的 `relates_to` 边（通过 `custom_label='manual'` 区分，**BREAKING**：现有手动 relates_to 边需要回填此标记，否则会被误删）

### `[[` 触发的节点选择器方案
- 浮层定位：基于 textarea 的 `selectionStart` 计算光标坐标（mirror div 技术）
- 搜索输入：200ms 防抖后调用 `backlinksApi.search(query, { graphId, limit: 10 })`
- 选项展示：节点标题 + 所在图谱名（跨图谱时显示）
- 键盘导航：上下方向键选择、Enter 选中、Esc 关闭
- 选中后行为：在光标位置插入 `[[节点标题]]` 并移动光标到 `]]` 之后

### 反向链接面板 UI 方案
- 位置：`NodeEditSidebar` 顶部新增 Tab 切换（"内容" / "反向链接" / "版本"）
- 反向链接列表项：
  - 节点标题（可点击跳转）
  - 所在图谱名（点击切换到对应图谱）
  - 引用上下文（`[[节点名]]` 前后各 30 字符）
  - 引用时间
- 空状态：使用 `EmptyState` 组件显示"暂无反向链接"
- 加载态：使用 `Skeleton` 骨架屏
- 点击反向链接：跳转到引用节点（如在不同图谱，先切换图谱）

### 性能考虑
1. **大节点内容解析性能**：
   - 双链解析使用单次正则扫描（`/\[\[([^\]]+)\]\]/g`），复杂度 O(n)
   - 内容 > 50KB 时显示警告但仍能解析
   - 解析在节点保存时异步执行（不阻塞保存响应）
2. **反向链接查询性能**：
   - 依赖新增的 `idx_edges_backlinks` 索引
   - 单次查询限制 50 条结果
   - 使用 RPC 函数 `get_backlinks` 一次性返回带 join 数据的结果（避免 N+1）
3. **节点搜索性能**：
   - 使用 `knowledge_points.title` 的 `ILIKE` 前缀匹配（`title ILIKE 'query%'`）
   - 限制返回 10 条
   - 200ms 防抖减少请求频率
4. **渲染性能**：
   - remark 插件在预览渲染时同步执行（轻量正则替换，无需 Web Worker）
   - 缓存解析结果（key = content hash），避免重复解析

## Impact

### Affected specs
- 无现有 spec 直接受影响（B1 是 Phase 1 第一项，前置依赖无）
- 后续 B3（双链与图谱边同步）将基于 B1 的 `backlinkService` 扩展
- 后续 B6（Daily Notes）将复用 `[[节点名]]` 语法和 `NodeLinkSelector` 组件

### Affected code
- **Schema**：`supabase/migrations/04_graph_structure.sql`（新增 2 个索引）
- **后端**：
  - 新增 `api/routes/backlinks.ts`
  - 新增 `api/services/graph/backlinkService.ts`
  - 修改 `api/services/graph/knowledgePointService.ts`（保存时触发同步）
  - 修改 `api/services/graph/index.ts`（导出新服务）
  - 修改 `api/routes/index.ts` 或 `api/app.ts`（注册新路由）
- **前端**：
  - 新增 `src/components/GraphEditor/sidebar/BacklinksPanel.tsx`
  - 新增 `src/components/GraphEditor/sidebar/NodeLinkSelector.tsx`
  - 新增 `src/utils/wikiLinkRemarkPlugin.ts`
  - 新增 `src/hooks/useBacklinks.ts`
  - 新增 `src/services/api/backlinks.ts`
  - 新增 `src/services/api/contracts/IBacklinksApi.ts`
  - 修改 `src/components/GraphEditor/sidebar/NodeEditSidebar.tsx`
  - 修改 `src/services/api/contracts/IApi.ts`、`index.ts`、`createApiClient.ts`
  - 修改 `src/services/api/index.ts`
- **Shared**：
  - 新增 `shared/utils/wikiLink.ts`
- **i18n**：`zh-CN/graphEditor.json`、`en-US/graphEditor.json`
- **类型生成**：schema 变更后需运行 `npm run db:gen-types`

## ADDED Requirements

### Requirement: Wiki Link Syntax
The system SHALL support `[[节点标题]]` syntax in knowledge point content for referencing other knowledge points.

#### Scenario: User types wiki link
- **WHEN** user types `[[` in the node content editor
- **THEN** a node selector popover appears at cursor position with search input
- **WHEN** user selects a node from the selector
- **THEN** `[[节点标题]]` is inserted at cursor position and cursor moves after `]]`

#### Scenario: Wiki link with non-existent target
- **WHEN** user manually types `[[不存在的节点]]` and saves
- **THEN** the link is rendered as a clickable link but clicking shows "节点不存在" toast
- **AND** no edge is created in the edges table

### Requirement: Wiki Link Rendering
The system SHALL render `[[节点标题]]` as clickable internal links in markdown preview.

#### Scenario: Render wiki link in preview
- **WHEN** node content containing `[[React Hooks]]` is rendered in preview mode
- **THEN** `[[React Hooks]]` is rendered as a styled clickable link showing "React Hooks"
- **WHEN** user clicks the link
- **THEN** the system searches for a knowledge point titled "React Hooks" and navigates to it

### Requirement: Backlinks Panel
The system SHALL display a backlinks panel in the node edit sidebar showing all knowledge points that reference the current node via `[[当前节点标题]]`.

#### Scenario: View backlinks
- **WHEN** user opens a knowledge point that is referenced by 3 other knowledge points
- **THEN** the backlinks panel displays 3 items, each showing:
  - The referencing node's title (clickable to navigate)
  - The graph name containing the referencing node
  - The surrounding context (30 chars before and after the `[[...]]`)
  - The reference timestamp

#### Scenario: Empty backlinks
- **WHEN** user opens a knowledge point with no incoming references
- **THEN** the backlinks panel displays an empty state with "暂无反向链接" message

### Requirement: Bidirectional Link Sync
The system SHALL synchronize `[[节点标题]]` references in knowledge point content with `edges` table entries (relationship_type='relates_to') when the knowledge point is saved.

#### Scenario: Add new wiki link
- **WHEN** user saves a knowledge point with content containing `[[目标节点]]` and no corresponding edge exists
- **THEN** an edge is created in the current graph with source=current KP, target=resolved KP, relationship_type='relates_to'

#### Scenario: Remove wiki link
- **WHEN** user saves a knowledge point with `[[目标节点]]` removed from content
- **THEN** the corresponding `relates_to` edge is soft-deleted (deleted_at set to NOW())

#### Scenario: Preserve manual edges
- **WHEN** user has manually created a `relates_to` edge (custom_label='manual')
- **THEN** the sync process does not delete it even if no `[[...]]` references it in content

### Requirement: Backlinks API
The system SHALL provide a backlinks API following api-naming-conventions.md.

#### Scenario: List backlinks
- **WHEN** client calls `backlinksApi.list(knowledgePointId)`
- **THEN** the API returns an array of `BacklinkItem` objects, each containing:
  - `sourceKnowledgePointId`: the referencing KP's id
  - `sourceKnowledgePointTitle`: the referencing KP's title
  - `graphId`: the graph containing the edge
  - `graphTitle`: the graph's title
  - `context`: surrounding text of the `[[...]]` reference
  - `createdAt`: when the edge was created

#### Scenario: Search knowledge points for picker
- **WHEN** client calls `backlinksApi.search("React", { graphId: "g1", limit: 10 })`
- **THEN** the API returns up to 10 `KnowledgePointSearchHit` objects matching "React" by title prefix, prioritizing KPs in graph "g1"

### Requirement: Cross-graph Backlinks
The system SHALL support backlinks across different graphs since knowledge points can be referenced from any graph.

#### Scenario: Backlink from another graph
- **WHEN** user is viewing KP "A" in graph "G1" and KP "B" in graph "G2" references "A" via `[[A]]`
- **THEN** the backlinks panel of "A" displays an item showing KP "B" from graph "G2"
- **AND** clicking the item navigates to KP "B" in graph "G2"

## MODIFIED Requirements

### Requirement: Knowledge Point Save
The knowledge point save operation SHALL trigger wiki link synchronization after the content is persisted.

#### Scenario: Save triggers sync
- **WHEN** user saves a knowledge point with content containing wiki links
- **THEN** after the content is saved to `knowledge_points.content`, the system calls `backlinkService.syncBacklinks()` to update edges
- **AND** the sync operation is asynchronous and does not block the save response

## REMOVED Requirements
无（B1 是新增功能，不删除现有功能）
