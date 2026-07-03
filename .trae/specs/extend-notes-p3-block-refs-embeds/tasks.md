# Tasks

## P3 任务清单

### 第一组:数据库与共享类型(其他组依赖)

- [x] Task 1: 块引用关系表迁移
  - [x] SubTask 1.1: 新增 `supabase/migrations/35_note_block_refs.sql`:
    - 表 `note_block_refs`:id / source_note_id / source_block_id / target_note_id / target_block_id / type(`ref`|`embed`)/ created_at
    - UNIQUE(source_note_id, source_block_id, target_note_id, target_block_id) 防重复
    - 索引:idx_note_block_refs_source(source_note_id) / idx_note_block_refs_target(target_note_id) / idx_note_block_refs_block(target_block_id)
    - RLS:用户只能 CRUD source_note_id 属于自己 + target_note_id 属于自己的记录(双向校验)
    - 外键:source_note_id/target_note_id → notes(id) ON DELETE CASCADE
  - [x] SubTask 1.2: 文件头注释提醒运行 `npx supabase db reset` 与 `npm run db:gen-types`

- [x] Task 2: 共享类型与解析工具
  - [x] SubTask 2.1: 扩展 `shared/types/note.ts`:
    - `BlockId = string`(类型别名,便于语义化)
    - `BlockRefType = "ref" | "embed"`
    - `BlockRef { id: string; sourceNoteId: string; sourceBlockId: BlockId; targetNoteId: string; targetBlockId: BlockId; type: BlockRefType; createdAt: string }`
    - `BlockRefTarget { noteId: string; noteTitle: string; blockId: BlockId; blockSummary: string; blockType: BlockTypeId; updatedAt: string }`
    - `BlockContent { noteId: string; blockId: BlockId; content: string; noteTitle: string; isStale: boolean }`
  - [x] SubTask 2.2: 新增 `shared/utils/blockRef.ts`:
    - `BLOCK_REF_REGEX = /\(\(([a-z0-9]{10})\)\)/g`(匹配 `((blockId))`)
    - `BLOCK_EMBED_REGEX = /!\(\(([a-z0-9]{10})\)\)/g`(匹配 `!((blockId))`)
    - `BLOCK_ID_TRAILING_REGEX = /\^[a-z0-9]{10}$/`(块尾 `^block-id` 标记)
    - `generateBlockId(): BlockId` 生成 10 位 [a-z0-9] 随机串
    - `extractBlockRefs(content: string): { blockId: BlockId; type: BlockRefType }[]`(解析所有引用)
    - `extractBlockIds(content: string): BlockId[]`(解析块自身的所有 blockId)
    - `ensureBlockId(blockContent: string): { content: string; blockId: BlockId }`(若块尾无 `^id`,追加生成;否则返回已有)
    - `removeBlockId(blockContent: string): string`(剥离 `^id` 尾部,用于显示)
  - [x] SubTask 2.3: 单元测试 `shared/utils/__tests__/blockRef.test.ts` 覆盖:生成/解析/剥离/边界(空字符串/无 id 的块)

### 第二组:后端服务(依赖第一组)

- [x] Task 3: 块引用服务
  - [x] SubTask 3.1: 新增 `api/services/notes/blockRefService.ts`:
    - `syncBlockRefs(supabase, userId, noteId, content)`:解析 `((id))` 与 `!((id))` 全部引用,与现有 note_block_refs diff 后 DELETE/INSERT,失败 logger.warn 不阻塞
    - `getBlockContent(supabase, userId, targetNoteId, targetBlockId)`:查目标笔记(校验属主与未软删除),解析 content 找到 targetBlockId 对应块,返回 BlockContent
    - `getInboundRefs(supabase, userId, noteId)`:查 note_block_refs WHERE target_note_id=X,JOIN notes 拿 source 笔记标题,返回 BlockRef[]
    - `getOutboundRefs(supabase, userId, noteId)`:查 note_block_refs WHERE source_note_id=X,JOIN notes 拿 target 笔记标题,返回 BlockRef[]
    - `getBlocksForSearch(supabase, userId, query, limit)`:供前端 BlockRefPopover 补全使用,查最近编辑笔记 + 当前笔记的所有块(解析 `^block-id` 标记),按 updated_at 倒序
  - [x] SubTask 3.2: 扩展 `api/services/notes/notesService.ts`:
    - `create()` 第 372-374 行附近追加 `await this.syncBlockRefs(...)` 异步,失败 logger.warn
    - `update()` 仅当 `data.content !== undefined` 时调用 syncBlockRefs(对齐 syncNodeLinks 模式)
    - `softDelete()` 显式 DELETE note_block_refs WHERE source_note_id=X 或 target_note_id=X(软删除不触发 CASCADE)
    - `restore()` 不自动恢复引用关系(对齐 P0 链接恢复策略,提示 `blockRefsRestored: false`)
  - [x] SubTask 3.3: 单元测试 `api/__tests__/services/blockRefService.test.ts` 覆盖:syncBlockRefs 三场景(新增/消失/混合)、getBlockContent(命中/未命中/跨用户被拒)、getInbound/getOutbound、软删除级联

- [x] Task 4: 块引用路由扩展
  - [x] SubTask 4.1: `api/routes/notes.ts` 新增端点:
    - `GET /api/notes/:id/blocks/:blockId`(获取块内容,走 read 限流)
    - `GET /api/notes/:id/block-refs/inbound`(被引用列表,走 read 限流)
    - `GET /api/notes/:id/block-refs/outbound`(引用他人列表,走 read 限流)
    - `GET /api/notes/block-search?q=&limit=`(块搜索补全,走 read 限流,需定义在 `/:id` 路由前避免冲突)
    - SSE 订阅 `block_updated` 事件复用现有 `/api/sse` 端点,无需新增路由
  - [x] SubTask 4.2: 扩展 `api/services/graph/backlinkService.ts`:
    - 新增独立方法 `getBlockRefBacklinksForNode`(避免修改 `getBacklinksForNode` 签名风险,返回结构为 `Array<{ noteId: string; noteTitle: string; blockId: BlockId; blockSummary: string }>`):
    - 实现:查知识点标题 → 查含 `[[title]]` 的笔记 → 对每块提取 `^id` → JOIN note_block_refs WHERE target_block_id IN → JOIN source_note 拿标题 → 过滤软删除 → 去重
  - [x] SubTask 4.3: 路由级集成测试(可选,主要靠服务层单测)

- [x] Task 5: SSE 实时推送块更新
  - [x] SubTask 5.1: `api/services/notes/notesService.ts` 的 `update()` 保存成功后:
    - 解析新旧 content 中所有 `^block-id` 块
    - 对比找出"内容变化"的块(简化:用块文本相等比较)
    - 对每个变化的 blockId:`sseService.sendToUser(userId, { type: "block_updated", blockId, noteId, newContent })`(简化为推送给当前用户,跨用户在 RLS 层限制)
  - [x] SubTask 5.2: 软删除时:`sseService.sendToUser(userId, { type: "block_removed", noteId })` 推送给所有引用方
  - [x] SubTask 5.3: 单元测试覆盖 SSE 推送触发逻辑(不测真实 SSE 通道)— 2 个测试用例:块变化推送 / 块未变化不推送

### 第三组:前端 API 与编辑器扩展(依赖第二组)

- [x] Task 6: 前端 API 客户端扩展
  - [x] SubTask 6.1: `src/services/api/notes.ts` + `contracts/INotesApi.ts` 新增方法(对象式导出,方法名不重复资源名):
    - `notesApi.getBlock(noteId, blockId): Promise<BlockContent>`
    - `notesApi.getInboundBlockRefs(noteId): Promise<BlockRef[]>`
    - `notesApi.getOutboundBlockRefs(noteId): Promise<BlockRef[]>`
    - `notesApi.searchBlocks(query, limit?): Promise<BlockRefTarget[]>`
  - [x] SubTask 6.2: 新增 `src/services/api/mobile/notes.ts` + `contracts/IMobileNotesApi.ts`(补齐 mobileNotesApi,对齐 api-naming-conventions §6.1):
    - 复用 read 端点,提供只读 mobileNotesApi.getBlock / getInboundBlockRefs / getOutboundBlockRefs / searchBlocks
  - [x] SubTask 6.3: `src/hooks/queries/useNoteQueries.ts` 新增 useBlockContent / useInboundBlockRefs / useOutboundBlockRefs / useBlockSearch

- [x] Task 7: BlockReference 与 BlockEmbed TipTap 扩展
  - [x] SubTask 7.1: 新增 `src/components/Notes/extensions/BlockReference.ts`(TipTap v3 inline Node):
    - schema:`inline: true, group: 'inline', atom: true, attrs: { blockId: { default: null } }`
    - `parseHTML` 解析 `<span data-block-ref="blockId">`
    - `renderHTML` 输出 `<span class="block-ref" data-block-ref="blockId">📌{summary}</span>`
    - 添加 NodeView(可选,先用 renderHTML 的简单胶囊)
  - [x] SubTask 7.2: 新增 `src/components/Notes/extensions/BlockEmbed.ts`(TipTap v3 block Node):
    - schema:`inline: false, group: 'block', atom: true, attrs: { blockId: { default: null } }`
    - `parseHTML` 解析 `<div data-block-embed="blockId">`
    - 添加 NodeView:React 组件渲染源块只读内容 + 加载中/已删除占位 + "跳转源块"/"解除嵌入"按钮
  - [x] SubTask 7.3: `src/components/Notes/editorExtensions.ts` 追加 BlockReference + BlockEmbed 到 buildEditorExtensions 返回值
  - [x] SubTask 7.4: `src/components/Notes/markdownSerializer.ts` 扩展:
    - `preprocessBlockRefs(markdown)`:把 `!((id))` 替换为 `<div data-block-embed="id"></div>`、`((id))` 替换为 `<span data-block-ref="id"></span>`,交给 tiptap-markdown 解析
    - `tiptapToMarkdown(html)`:把 `<span data-block-ref>` 还原为 `((id))`、`<div data-block-embed>` 还原为 `!((id))`
    - 注意保留代码块/行内代码内的字面量(不解析,沿用 preprocessWikiLinks 的 split 模式)

- [x] Task 8: 块引用补全与"复制块引用"交互
  - [x] SubTask 8.1: 新增 `src/components/Notes/BlockRefPopover.tsx`(对齐 WikiLinkPopover.tsx 风格):
    - 接收 `anchorRect: DOMRect` + `onSelect(blockId)` + `onClose`
    - 内部 useBlockSearch query,输入框 + 列表 + 上下键导航
    - position: fixed + scroll/resize 监听关闭
  - [x] SubTask 8.2: `src/components/Notes/BlockEditor.tsx` 集成:
    - 监听 editor `update` 事件,检测输入 `((` 时唤起 BlockRefPopover(用 coordsAtPos 计算锚点)
    - 选择后 `editor.chain().focus().deleteRange().insertBlockReference(blockId).run()`
    - 监听输入 `!((` 时也唤起,选择后插入 `insertBlockEmbed(blockId)`
  - [x] SubTask 8.3: `src/components/Notes/BlockEditorToolbar.tsx` 新增"复制块引用"按钮:
    - 找当前选区所在顶层块,调用 ensureBlockId(若需生成,触发保存)
    - 复制 `((blockId))` 到剪贴板(navigator.clipboard.writeText)
    - toast 提示"块引用已复制"
  - [x] SubTask 8.4: 工具栏新增"嵌入此块"按钮:复制 blockId 后,在当前光标位置插入 `!((blockId))`

### 第四组:实时同步、反向面板与质量收口

- [x] Task 9: SSE 订阅 BlockEmbed 实时更新
  - [x] SubTask 9.1: `src/hooks/useSSESubscription.ts`(若无则新增,复用现有 SSE hook 模式):
    - 监听 `block_updated` 事件,匹配当前编辑器内的 BlockEmbed 节点,触发重新渲染(更新 NodeView state)
    - 监听 `block_removed` 事件,标记对应 BlockEmbed 为"源块已删除"
  - [x] SubTask 9.2: BlockEmbedNodeView 组件订阅事件,显示加载中/已更新/已删除三种状态
  - [x] SubTask 9.3: 用户当前编辑器有未保存草稿时,延迟同步(显示"源块已更新,点击刷新"提示,用户主动点击才更新)

- [x] Task 10: 反向链接面板扩展
  - [x] SubTask 10.1: `src/components/Notes/NotesPanel.tsx`(节点详情侧边栏的"关联笔记"面板)扩展:
    - 在现有关联笔记列表下,新增"引用此节点的块"子区块
    - 调用扩展后的 backlinkService.getBacklinksForNode,渲染 blockRefNotes 条目
  - [x] SubTask 10.2: 笔记详情侧边栏新增"被引用的块"面板:
    - 调用 notesApi.getInboundBlockRefs
    - 渲染:块摘要 + 引用方笔记列表(每条可点击跳转)
  - [x] SubTask 10.3: 暗色模式 + i18n + 空状态(无引用时显示"暂无引用")

- [x] Task 11: 国际化与质量收口
  - [x] SubTask 11.1: i18n 补充 `src/i18n/locales/{zh-CN,en-US}/notes.json`:
    - `notes.editor.blockRef.*`(placeholder / noMatch / searching / tooltip / stale / removed)
    - `notes.editor.blockEmbed.*`(loading / removed / jumpToSource / unembed / refreshPrompt)
    - `notes.editor.blockMenu.copyBlockRef` / `embedBlock`
    - `notes.blockRefsPanel.*`(title / empty / inboundEmpty / outboundEmpty)
  - [x] SubTask 11.2: zh-CN/en-US key 集合一致性验证
  - [x] SubTask 11.3: 运行 `npm run check` 与 `npm run lint` 通过
  - [x] SubTask 11.4: 代码规范扫描(无 any / 无 ! / 前端无 console.log/info / 后端无 console.*)
  - [x] SubTask 11.5: 验证 mobileNotesApi 与 notesApi 的方法命名对齐 api-naming-conventions

# Task Dependencies
- Task 2 依赖 Task 1
- Task 3 依赖 Task 1、Task 2
- Task 4 依赖 Task 3
- Task 5 依赖 Task 3(notesService.update 扩展)
- Task 6 依赖 Task 4
- Task 7 依赖 Task 2(共享类型与工具)
- Task 8 依赖 Task 6、Task 7
- Task 9 依赖 Task 5、Task 7
- Task 10 依赖 Task 4、Task 6
- Task 11 贯穿最后收口

# 可并行任务
- Task 5(SSE 推送) 与 Task 4(路由扩展) 在 Task 3 完成后可并行
- Task 7(TipTap 扩展) 与 Task 6(前端 API) 在 Task 2 完成后可并行(7 不依赖 6)
- Task 10(反向面板) 在 Task 4 + Task 6 完成后可与 Task 8/9 并行
