# Notes P3 (块引用 / 块嵌入) Spec

## Why
P0/P1/P2 已交付完整笔记能力(块编辑器、AI 辅助、模板、搜索、写作辅助),但笔记间的"块级双向链接"仍缺失。当前只能整篇引用笔记,无法精确引用某个段落/列表项/代码块。用户写长文时无法将分散在多篇笔记中的块聚合到一个"动态页面",失去 Obsidian/Roam 式的"块级思考"能力。本 spec 补齐 `^block-id` 语法与 `((block-id))` 块引用/块嵌入,完成 PRD `PRD-Block-Editor-Daily-Notes.md` §9.1 的后续迭代方向。

## What Changes
- **块 ID 机制**:为顶层块按需生成(Lazy)`^block-id` 标记,用户主动触发"复制块引用"时为该块生成稳定 ID 并写入正文尾部
- **块引用语法**:采用 `((block-id))` inline 语法(Logseq/Roam 风格),与现有 `[[节点名]]` 零冲突,通过自研 TipTap inline Node 承载
- **块嵌入(Live Transclusion)**:采用 `!((block-id))` 语法嵌入源块只读视图,源块更新时实时同步(SSE 推送 + 编辑器订阅)
- **跨笔记范围**:仅同用户跨笔记(RLS 自动隔离),不引入跨用户共享模型
- **反向链接扩展**:节点详情页"关联笔记"区块增加"引用此节点的块"列表;笔记详情页增加"被引用的块"反向面板
- **块级语义检索**(可选,降级方案):若不新增 `note_block_embeddings` 表,引用展开后由源笔记 embedding 覆盖;若新增则单块单 embedding
- **BREAKING**:无(纯新增语法 + 扩展,Markdown 文本中无 `^block-id` 的旧笔记完全兼容)

## Impact
- **Affected specs**:
  - `add-notes-block-editor-daily`(P0 笔记基础)
  - `add-notes-p1-ai-search-templates`(P1 AI/搜索)
  - `extend-notes-p2-writing-refresh-search`(P2 写作辅助)
  - 本 spec 为这三份的后续阶段,共享同一套笔记数据模型、notesApi、BlockEditor 编辑器栈
- **Affected code**:
  - 数据库:`supabase/migrations/35_note_block_refs.sql`(新增 `note_block_refs` 表:source_note_id / source_block_id / target_note_id / target_block_id / type(ref|embed) / created_at,UNIQUE(source_note_id, source_block_id, target_note_id, target_block_id))
  - 共享类型:`shared/types/note.ts`(新增 BlockId、BlockRef、BlockEmbed、BlockRefTarget 等类型);`shared/utils/blockRef.ts`(新增,块引用解析工具,风格对齐 `shared/utils/wikiLink.ts`)
  - 后端:
    - `api/services/notes/blockRefService.ts`(新增:CRUD + syncBlockRefs + getBlockContent + 节点重命名/块删除时同步)
    - `api/services/notes/notesService.ts`(扩展 create/update 触发 syncBlockRefs,软删除时清理引用关系)
    - `api/services/ai/ragSearchService.ts`(扩展:回答上下文包含引用了当前节点相关块的笔记)
    - `api/routes/notes.ts`(新增端点:`GET /api/notes/:id/blocks/:blockId`、`POST /api/notes/:id/blocks/:blockId/ref`、`DELETE /api/notes/:id/blocks/:blockId/ref`、`GET /api/notes/:id/block-refs/inbound`、`GET /api/notes/:id/block-refs/outbound`)
    - `api/services/graph/backlinkService.ts`(扩展:节点详情页"关联笔记"区块返回引用此节点相关块的笔记)
  - 前端:
    - `src/components/Notes/markdownSerializer.ts`(扩展:preprocessBlockRefs 解析 `((id))` / `!((id))` 为 ProseMirror inline node;tiptapToMarkdown 序列化时还原)
    - `src/components/Notes/editorExtensions.ts`(新增 `BlockReference` 自研 TipTap inline Node + `BlockEmbed` 自研 block Node,NodeView 渲染只读嵌入)
    - `src/components/Notes/BlockEditor.tsx`(集成选区右键菜单"复制块引用"、块菜单新增"嵌入此块"项)
    - `src/components/Notes/BlockRefPopover.tsx`(新增:输入 `((` 时唤起块搜索补全,对齐 `WikiLinkPopover.tsx`)
    - `src/components/Notes/BlockEmbedNodeView.tsx`(新增:BlockEmbed 的 NodeView 组件,展示源块只读内容 + "源块已删除/软删除"占位)
    - `src/services/api/notes.ts` + `contracts/INotesApi.ts`(新增 5 个块引用方法)
    - `src/services/api/mobile/notes.ts` + `contracts/IMobileNotesApi.ts`(新增 mobileNotesApi,补齐 P0/P1/P2 遗漏的 mobile 层,见 api-naming-conventions §6.1)
    - `src/hooks/queries/useNoteQueries.ts` + `useNoteMutations.ts`(新增块引用 query/mutation)
    - `src/components/Notes/BacklinksPanel.tsx` 或 `NotesPanel.tsx`(扩展:显示引用此节点相关块的笔记)
    - `src/i18n/locales/{zh-CN,en-US}/notes.json`(新增 notes.editor.blockRef.* 与 notes.editor.blockEmbed.* 命名空间)
  - 复用资产:`wikiLink.ts` 解析模式、`WikiLinkPopover.tsx` 浮层模式、`backlinkService.syncNotesWikiLinks` 节点重命名同步模式、`sseService` 实时推送、`promptService`(若涉及 AI 自动建议引用目标)、`performanceMonitor`、`notDeleted` 软删除过滤、`AppError` 错误处理

## ADDED Requirements

### Requirement: 块 ID 与块引用语法
系统 SHALL 允许用户为笔记中任意顶层块生成稳定的 `^block-id`,并通过 `((block-id))` 语法在其他位置引用该块,引用以可点击 inline 元素呈现。

#### Scenario: Lazy 生成块 ID
- **WHEN** 用户对某个顶层块(段落/标题/列表项/引用/代码块)执行"复制块引用"操作(右键菜单或块菜单)
- **THEN** 系统检查该块是否已有 `^block-id`
- **AND** 若无,生成唯一 blockId(格式 `^[a-z0-9]{10}`,对齐 Obsidian 风格),追加到块尾(代码块/分割线除外,在块上方单独一行追加)
- **AND** 触发自动保存
- **AND** 复制 `((blockId))` 到剪贴板

#### Scenario: 块引用渲染
- **WHEN** 笔记 Markdown 含 `((blockId))`
- **THEN** BlockEditor 渲染为 inline BlockReference 节点,显示为带图标 + 块标题摘要的胶囊
- **AND** 点击胶囊跳转到源块所在笔记并滚动到该块(若源块在本文内,直接滚动)
- **AND** 胶囊 hover 显示源块完整内容预览(tooltip)

#### Scenario: 块引用输入补全
- **WHEN** 用户在编辑器输入 `((`
- **THEN** 唤起 BlockRefPopover,显示当前笔记 + 最近编辑笔记中的块列表(按 updated_at 倒序)
- **AND** 用户输入关键词时实时过滤
- **AND** 选择后插入 `((blockId))` 并在后台创建/更新 note_block_refs 记录

#### Scenario: 块引用同步维护
- **WHEN** 笔记保存(content 变更)
- **THEN** 后端 syncBlockRefs 解析 `((block-id))` 与 `!((block-id))` 全部引用
- **AND** 与现有 note_block_refs 做 diff:消失的引用 DELETE、新增的引用 INSERT(UNIQUE 冲突忽略)
- **AND** 失败仅 logger.warn,不阻塞保存主流程

#### Scenario: 源块不存在或已删除
- **WHEN** 引用目标的源块已被删除(笔记软删除或块内容修改后 blockId 消失)
- **THEN** BlockReference 节点渲染为"块已失效"灰色胶囊
- **AND** 点击不跳转,显示 tooltip "源块已删除,可点击移除引用"

### Requirement: 块嵌入(Live Transclusion)
系统 SHALL 支持 `!((block-id))` 语法将源块以只读视图嵌入当前笔记,源块更新时实时同步显示。

#### Scenario: 嵌入块
- **WHEN** 用户在块菜单选择"嵌入此块"(对源块操作),或在编辑器输入 `!((`
- **THEN** 在当前位置插入 BlockEmbed 节点(NodeView 渲染源块只读内容)
- **AND** 后台创建 note_block_refs 记录(type="embed")

#### Scenario: 实时同步
- **WHEN** 源块所在笔记被保存(content 变更)
- **THEN** 后端通过 sseService 推送 `block_updated` 事件到所有引用该块的笔记编辑器(包含 blockId + 新内容)
- **AND** 前端 BlockEmbedNodeView 收到事件后重新渲染
- **AND** 用户当前编辑器若有未保存草稿,延迟同步直到用户保存或确认覆盖

#### Scenario: 源块删除
- **WHEN** 源块所在笔记被软删除
- **THEN** 后端 DELETE note_block_refs 中 target 涉及该笔记所有块的记录
- **AND** 推送 `block_removed` 事件
- **AND** 前端 BlockEmbedNodeView 渲染为"源笔记已删除"占位

#### Scenario: 嵌入块不可编辑
- **WHEN** 用户点击 BlockEmbed 节点内的内容
- **THEN** 内容不可编辑(contenteditable=false)
- **AND** 显示"跳转到源块"按钮与"解除嵌入"按钮
- **AND** "解除嵌入"将节点转为源块的 Markdown 静态快照(脱离引用关系)

### Requirement: 跨笔记块引用
系统 SHALL 允许用户在笔记 A 中引用笔记 B 的块,跨笔记引用仅限同一用户(RLS 隔离)。

#### Scenario: 跨笔记引用语法
- **WHEN** 用户在笔记 A 输入 `((blockId))`,blockId 属于笔记 B
- **THEN** BlockReference 节点显示笔记 B 的标题 + 块摘要
- **AND** 点击跳转到 `/notes/{noteBId}?block={blockId}`
- **AND** note_block_refs 记录 source_note_id=A, target_note_id=B, target_block_id=blockId

#### Scenario: 跨用户引用被拒绝
- **WHEN** 用户尝试引用不属于自己的笔记的块(blockId 不存在或属主非本人)
- **THEN** 渲染为"块已失效"胶囊
- **AND** 后端 syncBlockRefs 解析时跳过无效引用,仅记录有效引用到 note_block_refs

### Requirement: 反向链接面板扩展
系统 SHALL 在节点详情页与笔记详情页扩展反向链接,展示块级引用关系。

#### Scenario: 节点详情页"引用此节点的块"
- **WHEN** 用户打开节点 X 的详情侧边栏
- **THEN** "关联笔记"区块下新增"引用此节点的块"子区块
- **AND** 列出所有 `[[节点X]]` 所在块被其他笔记引用的条目(显示:源笔记标题 + 块摘要 + 引用此块的笔记列表)
- **AND** 点击条目跳转到引用方笔记

#### Scenario: 笔记详情页"被引用的块"
- **WHEN** 用户打开笔记 A
- **THEN** 侧边栏显示"被引用的块"面板
- **AND** 列出笔记 A 中所有被其他笔记引用的块(显示:块摘要 + 引用方笔记列表)
- **AND** 点击引用方跳转到对应笔记

### Requirement: 块引用与 AI 上下文
系统 SHALL 在图谱 AI 问答 / RAG 检索时,将引用了当前节点相关块的笔记内容作为上下文参与回答。

#### Scenario: AI 问答引用块上下文
- **WHEN** 用户在节点 X 向 AI 提问相关问题
- **AND** 笔记 A 的某块通过 `((blockId))` 被笔记 B 引用,笔记 A 该块含 `[[节点X]]`
- **THEN** AI 回答上下文包含笔记 A 该块的内容
- **AND** 回答可引用笔记 A 该块的论述

## MODIFIED Requirements

### Requirement: 全局搜索结果类型
(P0/P1/P2 已实现 keyword + semantic 模式返回 graphs/nodes/notes。本 spec 不修改搜索结果类型,仅扩展 AI RAG 上下文来源。)

## REMOVED Requirements
(无)
