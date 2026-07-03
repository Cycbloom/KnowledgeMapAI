# P3 验收检查清单

## 数据库与共享类型
- [x] `35_note_block_refs.sql` 已创建,含 note_block_refs 表与全部字段
- [x] UNIQUE(source_note_id, source_block_id, target_note_id, target_block_id) 防重复
- [x] 索引齐全:source / target / target_block_id
- [x] RLS 双向校验(source 与 target 均属当前用户)
- [x] 外键 source_note_id/target_note_id → notes(id) ON DELETE CASCADE
- [x] 文件头注释提醒运行 `npx supabase db reset` 与 `npm run db:gen-types`
- [x] `shared/types/note.ts` 扩展 BlockId / BlockRef / BlockRefTarget / BlockContent / BlockRefType 类型
- [x] 类型导出完整,无 any
- [x] `shared/utils/blockRef.ts` 实现:BLOCK_REF_REGEX / BLOCK_EMBED_REGEX / BLOCK_ID_TRAILING_REGEX / generateBlockId / extractBlockRefs / extractBlockIds / ensureBlockId / removeBlockId
- [x] 单元测试覆盖 blockRef 工具(生成/解析/剥离/边界)

## 后端服务
- [x] blockRefService.syncBlockRefs 实现(diff DELETE/INSERT,失败不阻塞)
- [x] blockRefService.getBlockContent 实现(校验属主/未软删除,解析 blockId 对应块)
- [x] blockRefService.getInboundRefs / getOutboundRefs 实现
- [x] blockRefService.getBlocksForSearch 实现(BlockRefPopover 补全用)
- [x] notesService.create 触发 syncBlockRefs 异步
- [x] notesService.update 仅当 content 变更时触发 syncBlockRefs
- [x] notesService.softDelete 显式 DELETE note_block_refs(双向)
- [x] notesService.restore 不自动恢复引用关系(返回 blockRefsRestored: false)
- [x] SSE 推送:block_updated 事件(含 blockId / noteId / newContent)
- [x] SSE 推送:block_removed 事件(源笔记软删除时)
- [x] 单元测试覆盖 syncBlockRefs 三场景、getBlockContent 命中/未命中/跨用户、getInbound/getOutbound、SSE 触发逻辑

## 后端路由
- [x] `GET /api/notes/:id/blocks/:blockId` 实现(read 限流)
- [x] `GET /api/notes/:id/block-refs/inbound` 实现(read 限流)
- [x] `GET /api/notes/:id/block-refs/outbound` 实现(read 限流)
- [x] `GET /api/notes/block-search?q=&limit=` 实现(定义在 /:id 之前避免冲突,read 限流)
- [x] backlinkService 新增独立方法 getBlockRefBacklinksForNode(避免修改 getBacklinksForNode 签名)
- [x] 端点响应符合 contracts 类型
- [x] 命名遵循 api-naming-conventions

## 前端 API 客户端
- [x] notesApi.getBlock(noteId, blockId) 实现
- [x] notesApi.getInboundBlockRefs(noteId) 实现
- [x] notesApi.getOutboundBlockRefs(noteId) 实现
- [x] notesApi.searchBlocks(query, limit?) 实现
- [x] 新增 mobileNotesApi(补齐 P0/P1/P2 遗漏的 mobile 层,对齐 api-naming-conventions §6.1)
- [x] mobileNotesApi 与 notesApi 方法命名对齐
- [x] useBlockContent / useInboundBlockRefs / useOutboundBlockRefs / useBlockSearch hooks 实现

## TipTap 扩展与编辑器
- [x] BlockReference 自研 TipTap v3 inline Node 实现(inline: true, group: 'inline', atom: true)
- [x] BlockEmbed 自研 TipTap v3 block Node 实现(inline: false, group: 'block', atom: true)
- [x] BlockEmbedNodeView React 组件实现(加载中/源块内容/已删除占位 + 跳转/解除嵌入按钮)
- [x] editorExtensions.ts 追加 BlockReference + BlockEmbed
- [x] markdownSerializer.preprocessBlockRefs 解析 `((id))` / `!((id))` 为 span/div,保留代码块字面量
- [x] markdownSerializer.tiptapToMarkdown 还原 span→`((id))` / div→`!((id))`
- [x] BlockRefPopover 组件实现(anchorRect 定位 + 搜索 + 上下键 + scroll 监听)
- [x] BlockEditor 监听 `((` / `!((` 输入唤起 BlockRefPopover
- [x] BlockEditorToolbar 或块菜单新增"复制块引用"按钮(ensureBlockId + clipboard)
- [x] 块菜单新增"嵌入此块"项
- [x] 暗色模式 + i18n

## 实时同步
- [x] useSSESubscription 或现有 SSE hook 监听 block_updated 事件
- [x] BlockEmbedNodeView 收到 block_updated 重新渲染
- [x] BlockEmbedNodeView 收到 block_removed 渲染为"源块已删除"占位
- [x] 用户有未保存草稿时延迟同步(显示"源块已更新,点击刷新")
- [x] 嵌入块不可编辑(contenteditable=false)
- [x] "解除嵌入"将节点转为源块 Markdown 静态快照

## 反向链接面板
- [x] 节点详情侧边栏"关联笔记"下新增"引用此节点的块"子区块
- [x] 笔记详情侧边栏新增"被引用的块"面板
- [x] 渲染:块摘要 + 引用方笔记列表(可点击跳转)
- [x] 空状态文案("暂无引用")
- [x] 暗色模式 + i18n

## 跨笔记引用与权限
- [x] 跨笔记引用 note_block_refs 记录 source_note_id=A, target_note_id=B
- [x] 跨用户引用被 RLS 拒绝(syncBlockRefs 跳过无效引用)
- [x]  源块不存在/已软删除时 BlockReference 渲染为"块已失效"灰色胶囊
- [x]  点击"块已失效"胶囊显示 tooltip,不跳转

## 国际化与质量
- [x] notes.json 补充 P3 key:editor.blockRef.* / editor.blockEmbed.* / editor.blockMenu.* / blockRefsPanel.*
- [x] zh-CN / en-US key 集合一致
- [x] 无 any 类型、无非空断言 !
- [x] 前端无 console.log/info,后端无 console.*
- [x] `npm run check` 通过
- [x] `npm run lint` 通过
- [x] mobileNotesApi 与 notesApi 方法命名对齐 api-naming-conventions

## AI 上下文(可选,降级方案)
- [x] ragSearchService 上下文构建包含引用了当前节点相关块的笔记(采用降级方案,引用展开后由源笔记 embedding 覆盖)
- [x] 或文档化降级方案:引用展开后由源笔记 embedding 覆盖(若不新增 note_block_embeddings 表)

