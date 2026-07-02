# Tasks

- [x] Task 1: Schema 变更与索引
  - [x] SubTask 1.1: 在 `supabase/migrations/04_graph_structure.sql` 中新增 `idx_edges_backlinks` 索引（on `target_knowledge_point_id, relationship_type, deleted_at`）
  - [x] SubTask 1.2: 在 `supabase/migrations/04_graph_structure.sql` 中新增 `idx_edges_outlinks` 索引（on `source_knowledge_point_id, relationship_type, deleted_at`）
  - [ ] SubTask 1.3: 运行 `npm run db:gen-types` 重新生成 `shared/types/database.generated.ts`（环境问题待用户手动执行：Supabase CLI 二进制缺失）
  - [ ] SubTask 1.4: 本地 `npx supabase db reset` 验证索引创建成功（待用户手动验证）

- [x] Task 2: Shared 层双链解析工具
  - [x] SubTask 2.1: 新增 `shared/utils/wikiLink.ts`，实现 `extractWikiLinks(content: string): string[]`（提取所有 `[[标题]]`）
  - [x] SubTask 2.2: 在 `shared/utils/wikiLink.ts` 中实现 `WIKI_LINK_REGEX` 常量并导出，供前后端复用
  - [x] SubTask 2.3: 重构 `shared/utils/markdownParser.ts` 中已有的 `[[]]` 解析逻辑，改为复用 `wikiLink.ts`（保持向后兼容）

- [x] Task 3: 后端反向链接服务
  - [x] SubTask 3.1: 新增 `api/services/graph/backlinkService.ts`，实现 `getBacklinks(supabase, userId, knowledgePointId): Promise<BacklinkItem[]>`
  - [x] SubTask 3.2: 在 `backlinkService.ts` 中实现 `searchKnowledgePoints(supabase, userId, query, options): Promise<KnowledgePointSearchHit[]>`（优先同图谱，ILIKE 前缀匹配，limit 10）
  - [x] SubTask 3.3: 在 `backlinkService.ts` 中实现 `syncBacklinks(supabase, userId, graphId, knowledgePointId, content): Promise<void>`（解析 `[[]]`、对比 edges、增删 edge）
  - [x] SubTask 3.4: 在 `api/services/graph/index.ts` 导出 `backlinkService`

- [x] Task 4: 后端反向链接路由
  - [x] SubTask 4.1: 新增 `api/routes/backlinks.ts`，定义 3 个路由：
    - `GET /backlinks/:knowledgePointId` → `backlinkService.getBacklinks`
    - `GET /backlinks/search?q=xxx&graphId=xxx&limit=10` → `backlinkService.searchKnowledgePoints`
    - `GET /backlinks/:knowledgePointId/outlinks` → `backlinkService.getOutlinks`（正向链接查询）
  - [x] SubTask 4.2: 在 `api/services/plugins/GraphPlugin.ts` 的 `onInstall` 中注册 `/api/backlinks` 路由
  - [x] SubTask 4.3: 所有路由使用 `requireAuth` 中间件，确保 `req.user.id` 可用

- [x] Task 5: 知识点保存时触发双链同步
  - [x] SubTask 5.1: 在 `api/services/graph/knowledgePointService.ts` 的 `update` 方法中（签名扩展为 `(supabase, id, data, userId?, graphId?)`），content 字段变更后调用 `backlinkService.syncBacklinks()`
  - [x] SubTask 5.2: 同步调用使用 `try/catch` 包装，失败时记录 `logger.warn` 但不阻断保存
  - [x] SubTask 5.3: 同步操作异步执行（使用 `Promise.resolve().then(async () => {...})`），不阻塞保存响应

- [x] Task 6: 前端 API 契约与实现
  - [x] SubTask 6.1: 新增 `src/services/api/contracts/IBacklinksApi.ts`，定义 `IBacklinksApi` 接口（list, getOutlinks, search 三个方法）
  - [x] SubTask 6.2: 在 `src/services/api/contracts/IApi.ts` 中注册 `backlinks: IBacklinksApi`
  - [x] SubTask 6.3: 在 `src/services/api/contracts/index.ts` 导出 `IBacklinksApi`
  - [x] SubTask 6.4: 新增 `src/services/api/backlinks.ts`，实现 `backlinksApi: IBacklinksApi`（基于 `request` 函数）
  - [x] SubTask 6.5: 在 `src/services/api/index.ts` 导出 `backlinksApi`
  - [x] SubTask 6.6: 在 `src/services/api/createApiClient.ts` 注册 `backlinks` 字段（注：实际在 `src/services/api/index.ts` 的 api 对象中注册，createApiClient.ts 不含 api 对象）
  - [x] SubTask 6.7: 新增 `src/services/mobile/backlinks.ts`，实现 `mobileBacklinksApi`（thin wrapper，复用 contracts）

- [x] Task 7: Shared 类型定义
  - [x] SubTask 7.1: 在 `shared/types/` 下新增 `backlink.ts`，定义 `BacklinkItem`、`KnowledgePointSearchHit`、`OutlinkItem` 类型
  - [x] SubTask 7.2: 在 `shared/types/index.ts` 中导出新类型

- [x] Task 8: 前端反向链接 Hook
  - [x] SubTask 8.1: 新增 `src/hooks/useBacklinks.ts`，封装 `backlinksApi.list()` 调用
  - [x] SubTask 8.2: hook 返回 `{ backlinks, loading, error, refresh }`，使用 `@tanstack/react-query` 的 `useQuery`
  - [x] SubTask 8.3: hook 接受 `knowledgePointId` 参数，id 变化时重新查询（`enabled: !!knowledgePointId`，`staleTime: 30_000`）

- [x] Task 9: 双链 remark 插件
  - [x] SubTask 9.1: 新增 `src/utils/wikiLinkRemarkPlugin.tsx`，实现 remark 插件将 `[[标题]]` 转换为 `link` 节点（url 为 `wiki://标题`）（注：扩展名为 .tsx 因含 JSX）
  - [x] SubTask 9.2: 提供 `WikiLinkRenderer` React 组件，在 ReactMarkdown 的 `components.a` 中拦截 `wiki://` 协议链接，渲染为带样式的可点击 span
  - [x] SubTask 9.3: 点击 `wiki://` 链接时调用 `onWikiLinkClick(title)` 回调

- [x] Task 10: 节点链接选择器组件
  - [x] SubTask 10.1: 新增 `src/components/GraphEditor/sidebar/NodeLinkSelector.tsx`，实现浮层 UI（搜索框 + 结果列表）
  - [x] SubTask 10.2: 使用 `backlinksApi.search()` 查询，200ms 防抖
  - [x] SubTask 10.3: 实现键盘导航（ArrowUp/Down 选择、Enter 选中、Esc 关闭）
  - [x] SubTask 10.4: 选中后调用 `onSelect(nodeTitle)` 回调，关闭浮层
  - [x] SubTask 10.5: i18n 改造，硬编码中文替换为 `t("graphEditor:backlinks.*")` 调用

- [x] Task 11: NodeEditSidebar 集成 `[[` 触发逻辑
  - [x] SubTask 11.1: 在 `NodeEditSidebar.tsx` 的 content textarea 上监听 `onChange` 事件（`handleContentChange`）
  - [x] SubTask 11.2: 检测光标前是否为 `[[`（且不在代码块内，用 `isInsideCodeBlock` 统计 ``` 次数），若是则显示 `NodeLinkSelector` 浮层
  - [x] SubTask 11.3: 计算光标坐标（mirror div 技术，`getCaretCoordinates`），定位浮层
  - [x] SubTask 11.4: `NodeLinkSelector.onSelect(title)` 时，在光标位置插入 `[[title]]` 并移动光标到 `]]` 后
  - [x] SubTask 11.5: 用户按 Esc 时关闭浮层（NodeLinkSelector 内部已处理）

- [x] Task 12: NodeEditSidebar 预览模式接入双链渲染
  - [x] SubTask 12.1: 在 `NodeEditSidebar.tsx` 预览模式的 `ReactMarkdown` children 中先用 `preprocessWikiLinks` 处理
  - [x] SubTask 12.2: 在 `ReactMarkdown` 的 `components.a` 中处理 `wiki://` 链接，使用 `WikiLinkRenderer`
  - [x] SubTask 12.3: 点击 `wiki://` 链接时调用 `backlinksApi.search(title, {limit:1})` 解析目标节点，命中则跳转，未命中用 `console.warn` 提示

- [x] Task 13: 反向链接面板组件
  - [x] SubTask 13.1: 新增 `src/components/GraphEditor/sidebar/BacklinksPanel.tsx`，使用 `useBacklinks` hook
  - [x] SubTask 13.2: 列表项渲染：节点标题（加粗）、图谱名（badge，同图谱标记"当前图谱"）、引用上下文（斜体 line-clamp-2）、时间（toLocaleDateString）
  - [x] SubTask 13.3: 加载态使用 `Skeleton`（3 个 rectangular 卡片），空态/错误态使用 `EmptyState`
  - [x] SubTask 13.4: 点击列表项调用 `onNavigateToNode?.(sourceKnowledgePointId, graphId)`

- [x] Task 14: NodeEditSidebar 新增 Tab 切换
  - [x] SubTask 14.1: 在 `NodeEditSidebar.tsx` 顶部新增 Tab 切换器（"内容" / "反向链接"），pill 风格
  - [x] SubTask 14.2: "反向链接" Tab 渲染 `BacklinksPanel`，传入 `currentNodeId` 作为 `knowledgePointId`
  - [x] SubTask 14.3: Tab 切换保持各自状态（用 `<>...</>` 包裹原表单，state 不丢失）
  - [x] SubTask 14.4: `mode === "create"` 时不显示 Tab 切换器（新节点无反向链接）

- [x] Task 15: i18n 文案
  - [x] SubTask 15.1: 在 `src/i18n/locales/zh-CN/graphEditor.json` 新增 `backlinks` 字段（11 个文案键）
  - [x] SubTask 15.2: 在 `src/i18n/locales/en-US/graphEditor.json` 同步新增对应英文 `backlinks` 字段

- [x] Task 16: 类型检查与代码检查
  - [x] SubTask 16.1: 运行 `npm run check`，修复所有类型错误（退出码 0）
  - [x] SubTask 16.2: 运行 `npm run lint`，修复所有 lint 错误（退出码 0）
  - [x] SubTask 16.3: 验证无 `any` 类型、无非空断言 `!`、前端无 `console.log/info`、后端无 `console.*`（前端仅 NodeEditSidebar 的 handleWikiLinkClick 用 `console.warn` 提示未命中节点，符合规则）

# Task Dependencies
- Task 1 (Schema) → Task 3 (后端服务，依赖索引)
- Task 2 (Shared 解析工具) → Task 3 (后端同步逻辑使用 extractWikiLinks) + Task 9 (remark 插件)
- Task 3 (后端服务) → Task 4 (路由) + Task 5 (保存触发)
- Task 7 (Shared 类型) → Task 6 (前端 API 契约)
- Task 6 (前端 API) → Task 8 (hook) + Task 10 (选择器组件)
- Task 8 (hook) → Task 13 (反向链接面板)
- Task 9 (remark 插件) → Task 12 (预览接入)
- Task 10 (选择器组件) → Task 11 (NodeEditSidebar 集成)
- Task 13 (反向链接面板) → Task 14 (Tab 切换)
- Task 12 + Task 14 → Task 15 (i18n)
- 所有任务 → Task 16 (检查)
