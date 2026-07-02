# Checklist

## Schema 与索引
- [x] `supabase/migrations/04_graph_structure.sql` 中新增 `idx_edges_backlinks` 索引
- [x] `supabase/migrations/04_graph_structure.sql` 中新增 `idx_edges_outlinks` 索引
- [ ] 运行 `npm run db:gen-types` 后 `shared/types/database.generated.ts` 已更新（待用户手动执行：需本地 Supabase 运行）
- [ ] 本地 `npx supabase db reset` 后索引存在（待用户手动验证）

## Shared 层
- [x] `shared/utils/wikiLink.ts` 存在并导出 `extractWikiLinks`、`WIKI_LINK_REGEX`
- [x] `shared/types/backlink.ts` 存在并导出 `BacklinkItem`、`KnowledgePointSearchHit`、`OutlinkItem`
- [x] `shared/types/index.ts` 导出新类型
- [x] `shared/utils/markdownParser.ts` 重构为复用 `wikiLink.ts`，原有 `parseMarkdownToGraph` 行为不变

## 后端 API
- [x] `api/routes/backlinks.ts` 存在，定义 3 个路由（list / search / outlinks），/search 在 /:knowledgePointId 之前
- [x] `api/services/graph/backlinkService.ts` 存在，实现 `getBacklinks`、`getOutlinks`、`searchKnowledgePoints`、`syncBacklinks` 四个方法
- [x] `api/services/graph/index.ts` 导出 `backlinkService`
- [x] 路由已在 `api/services/plugins/GraphPlugin.ts` 的 onInstall 中注册 `/api/backlinks`
- [x] 所有路由使用 `requireAuth` 中间件
- [x] `knowledgePointService.update` 在 content 变更后调用 `backlinkService.syncBacklinks`
- [x] 同步调用异步执行（`Promise.resolve().then(...)`），不阻塞保存响应
- [x] 同步调用 `try/catch` 包装，失败时 `logger.warn` 不抛错

## 后端 API 命名规范
- [x] 前端 API 对象命名为 `backlinksApi`（非 `backlinkApi`）
- [x] 移动层命名为 `mobileBacklinksApi`
- [x] 方法名遵循：`list`、`search`、`getOutlinks`（不重复资源名）
- [x] 导出为命名导出对象（`export const backlinksApi = {...}`），非独立函数

## 前端 API 契约与实现
- [x] `src/services/api/contracts/IBacklinksApi.ts` 存在并定义 `IBacklinksApi` 接口
- [x] `src/services/api/contracts/IApi.ts` 注册 `backlinks: IBacklinksApi`
- [x] `src/services/api/contracts/index.ts` 导出 `IBacklinksApi`
- [x] `src/services/api/backlinks.ts` 实现 `backlinksApi: IBacklinksApi`
- [x] `src/services/api/index.ts` 导出 `backlinksApi` 且在 `api` 对象注册 `backlinks` 字段
- [x] `src/services/mobile/backlinks.ts` 实现 `mobileBacklinksApi`（注：createApiClient.ts 不含 api 对象，实际在 index.ts 注册）
- [x] `src/services/mobile/backlinks.ts` 实现 `mobileBacklinksApi`

## 前端组件
- [x] `src/components/GraphEditor/sidebar/BacklinksPanel.tsx` 存在并使用 `useBacklinks` hook
- [x] `src/components/GraphEditor/sidebar/NodeLinkSelector.tsx` 存在并实现搜索 + 键盘导航
- [x] `src/utils/wikiLinkRemarkPlugin.tsx` 存在并实现 remark 插件（注：扩展名 .tsx 因含 JSX）
- [x] `src/hooks/useBacklinks.ts` 存在并返回 `{ backlinks, loading, error, refresh }`

## NodeEditSidebar 集成
- [x] 内容编辑器监听 `[[` 触发 `NodeLinkSelector` 浮层（`handleContentChange` + `isInsideCodeBlock`）
- [x] 浮层定位基于光标坐标（mirror div 技术，`getCaretCoordinates`）
- [x] 选中节点后在光标位置插入 `[[title]]`（`handleLinkSelect`，光标移到 `]]` 后）
- [x] 预览模式 `ReactMarkdown` 接入 `preprocessWikiLinks` + `WikiLinkRenderer`
- [x] 预览中 `[[节点名]]` 渲染为可点击链接
- [x] 点击链接调用 `backlinksApi.search(title, {limit:1})` 解析并跳转
- [x] 顶部新增 Tab 切换（"内容" / "反向链接"），pill 风格
- [x] "反向链接" Tab 渲染 `BacklinksPanel`

## 功能验证（待用户运行时手动测试）
- [ ] 输入 `[[` 触发节点选择器浮层
- [ ] 选择器支持搜索过滤（200ms 防抖）
- [ ] 选择器支持键盘上下方向键、Enter、Esc
- [ ] 选中后插入 `[[节点标题]]` 格式正确
- [ ] 预览模式 `[[节点标题]]` 渲染为带样式的可点击链接
- [ ] 点击链接跳转目标节点（同图谱聚焦，跨图谱切换）
- [ ] 节点保存后 `edges` 表自动新增/删除 `relates_to` 边
- [ ] 反向链接面板显示所有引用当前节点的节点
- [ ] 反向链接列表项显示节点标题、图谱名、引用上下文、时间
- [ ] 点击反向链接项跳转到引用节点
- [ ] 反向链接面板空状态显示"暂无反向链接"
- [ ] 反向链接面板加载态显示骨架屏

## 类型安全与代码规范
- [x] 无 `any` 类型（已修复 NodeEditSidebar.tsx:835 的 `as any` → `as NodeLevel`）
- [x] 无非空断言 `!`
- [x] 前端无 `console.log/info`（允许 `warn/error`，NodeEditSidebar 用 `console.warn` 提示未命中节点）
- [x] 后端无 `console.*`（使用 `logger`）
- [x] 使用可选链 `?.` 和空值合并 `??`
- [x] `api/` 和 `src/` 不互相依赖，仅依赖 `shared/`
- [x] 导入语句顺序一致（第三方库 → 同路径本地导入）

## i18n
- [x] `zh-CN/graphEditor.json` 包含双链相关文案（11 个键）
- [x] `en-US/graphEditor.json` 包含对应英文文案（11 个键）
- [x] 无硬编码中文 UI 字符串（B1 新增代码全部走 i18n；既有非 B1 代码不在本次范围）

## 验证命令
- [x] `npm run check` 通过（退出码 0）
- [x] `npm run lint` 通过（退出码 0）
