# Notes P1 (AI 辅助 / 搜索 / 模板 / 图片) Spec

## Why
P0 已交付笔记基础结构与块编辑器,但笔记内容尚未参与图谱 AI 检索、缺乏 AI 辅助反思与反向建图、笔记不可被全局搜索、Daily 模板不可自定义、笔记无法插图。P1 在 P0 基础上补齐这些高价值能力,使"图谱 ↔ 笔记"双向闭环真正可用,完成 PRD `PRD-Block-Editor-Daily-Notes.md` 的 **P1 阶段**。

## What Changes
- **AI 上下文参与**:笔记内容建立 embedding 纳入语义检索数据源;图谱 AI 问答/RAG 检索时,挂载在当前节点(及相关节点)的笔记内容作为上下文参与回答
- **当日学习总结**:Daily Note 工具栏提供"生成今日总结"按钮,AI 基于今日复习卡片+完成任务+专注数据生成结构化总结插入"今日反思"段
- **笔记提取要点反向建图**:任意笔记工具栏提供"提取要点建图"按钮,AI 从笔记正文提取知识点候选,用户确认后创建新节点或合并到现有节点,并自动建立 note_node_links
- **笔记搜索**:笔记内容纳入全局搜索(扩展 search 服务数据源);笔记列表页支持按标题/标签本地筛选
- **自定义模板**:用户可创建/编辑/删除自定义 Daily 模板,可指定默认模板(同时只能一个),系统默认模板不可删
- **图片上传**:块编辑器支持图片上传(本地存储或对象存储,复用现有图片能力)
- **BREAKING**:无(纯新增 + 扩展,不破坏既有 API 契约)

## Impact
- **Affected specs**:`add-notes-block-editor-daily`(P0 笔记基础),本 spec 为其后续阶段,共享同一套笔记数据模型与 notesApi
- **Affected code**:
  - 后端:
    - `api/services/ai/ragService.ts`、`ragSearchService.ts`、`rerankingService.ts`(扩展,纳入 notes 数据源)
    - `api/services/ai/embeddingOps.ts`、`aiService.ts`(扩展,笔记 embedding 生成)
    - `api/routes/search.ts`(扩展,纳入 notes 数据源)
    - `api/routes/rag.ts`(扩展,挂载笔记上下文)
    - `api/services/notes/notesService.ts`(扩展:templates CRUD、AI 总结、反向建图、图片上传元数据)
    - `api/routes/notes.ts`(新增端点:templates CRUD、AI 总结、反向建图、图片上传)
    - 新增 Prompt:`api/services/ai/`(notes_daily_summary、notes_extract_concepts 等通过 promptService 三层管理)
    - 数据库:`supabase/migrations/`(新增 33_notes_embedding.sql:document_chunks 扩展或独立 note_embeddings 表 + 触发器自动生成 embedding)
  - 共享类型:`shared/types/note.ts`(扩展 Template CRUD Input、AI 总结/反向建图请求响应类型)
  - 前端:
    - `src/services/api/notes.ts` + `contracts/INotesApi.ts`(新增方法:templates CRUD、generateDailySummary、extractConceptsToGraph、uploadImage)
    - `src/components/Notes/BlockEditor.tsx` + `BlockEditorToolbar.tsx`(新增工具栏按钮:生成今日总结、提取要点建图、图片上传)
    - `src/components/Notes/NotesListPage.tsx`(标题/标签本地筛选)
    - `src/pages/Notes/NoteEditorPage.tsx`(集成 AI 工具栏)
    - `src/pages/Notes/TemplatesPage.tsx`(新增模板管理页,或集成到 Settings)
    - 新增组件:`src/components/Notes/ExtractConceptsDialog.tsx`(反向建图候选确认对话框)、`SummaryInsertPopover.tsx`(总结插入位置选择)
  - 复用资产:`promptService`(三层 Prompt)、`aiService`、`chatService`、`ragSearchService`、`rerankingService`、`embeddingOps`、`performanceMonitor`、现有 search 路由、现有图片上传能力(若有)

## ADDED Requirements

### Requirement: 笔记内容 Embedding 与语义检索
系统 SHALL 为笔记内容生成 embedding,纳入语义检索数据源,使全局搜索能命中笔记内容。

#### Scenario: 笔记创建/更新时生成 embedding
- **WHEN** 笔记创建或 content 更新
- **THEN** 系统异步生成 embedding 并存入笔记 embedding 表
- **AND** 不阻塞笔记保存主流程(失败仅日志告警)

#### Scenario: 全局搜索命中笔记
- **WHEN** 用户在全局搜索输入关键词
- **THEN** 命中的笔记出现在结果中(标题/摘要/链接),与图谱节点结果并列展示

### Requirement: 图谱 AI 上下文纳入笔记
系统 SHALL 在图谱 AI 问答 / RAG 检索时,将挂载在当前节点(及相关节点)的笔记内容作为上下文参与回答。

#### Scenario: AI 问答引用笔记
- **WHEN** 用户在节点X 向 AI 提问相关问题
- **AND** 笔记A 含 `[[节点X]]` 已挂载
- **THEN** AI 回答的上下文包含笔记A 的内容
- **AND** 回答可引用笔记A 的论述

### Requirement: 当日学习总结
系统 SHALL 在 Daily Note 工具栏提供"生成今日总结"按钮,AI 基于今日复习卡片(内容+掌握度)、完成任务、专注数据生成结构化总结,插入"今日反思"段。

#### Scenario: 生成今日总结
- **WHEN** 用户在 Daily Note 点击"生成今日总结"按钮
- **THEN** AI 基于今日学习数据生成一段结构化总结
- **AND** 总结插入到"今日反思"段(或用户指定位置)
- **AND** 总结可二次编辑

#### Scenario: 复用 Prompt 三层管理
- **WHEN** AI 生成总结
- **THEN** 使用 promptService.getRenderedPrompt("notes_daily_summary", vars) 读取模板
- **AND** 支持 System < User < Graph 三层覆盖

### Requirement: 笔记提取要点反向建图
系统 SHALL 在任意笔记工具栏提供"提取要点建图"按钮,AI 从笔记正文提取知识点候选,用户确认后创建新节点或合并到现有节点,并自动建立 note_node_links。

#### Scenario: 提取候选知识点
- **WHEN** 用户点击"提取要点建图"
- **THEN** AI 返回候选知识点列表(含建议关系)
- **AND** 弹出确认对话框,用户选择要创建/合并的节点及目标图谱

#### Scenario: 创建新节点并挂载
- **WHEN** 用户确认创建新节点
- **THEN** 在目标图谱创建新 graph_node + knowledge_point
- **AND** 自动在新节点与本笔记间建立 note_node_links
- **AND** 笔记正文相应位置插入 `[[新节点名]]`(可选)

#### Scenario: 合并到现有节点
- **WHEN** 用户选择合并到现有节点
- **THEN** 将知识点作为现有 knowledge_point 的补充内容(可追加到 content 或作为子节点)
- **AND** 在该节点与本笔记间建立 note_node_links

### Requirement: 笔记列表本地筛选
系统 SHALL 在笔记列表页支持按标题/标签本地筛选(客户端过滤,不额外请求)。

#### Scenario: 标题筛选
- **WHEN** 用户在列表页搜索框输入关键词
- **THEN** 列表实时按标题包含关键词过滤(客户端)

#### Scenario: 标签筛选
- **WHEN** 用户点击某个标签
- **THEN** 列表过滤为含该标签的笔记

### Requirement: 自定义 Daily 模板
系统 SHALL 允许用户创建/编辑/删除自定义 Daily 模板,可指定默认模板(同时只能一个),系统默认模板不可删。

#### Scenario: 创建自定义模板
- **WHEN** 用户在模板管理页提交新模板(name + content 含变量占位)
- **THEN** 模板创建成功,出现在模板列表
- **AND** 模板支持 `{{date}}`/`{{today_reviewed_cards}}`/`{{today_completed_tasks}}`/`{{today_focus_time}}` 变量

#### Scenario: 指定默认模板
- **WHEN** 用户将某自定义模板设为默认
- **THEN** 同时只能一个模板为默认(原默认取消)
- **AND** 次日新建 daily note 使用该默认模板

#### Scenario: 系统模板保护
- **WHEN** 用户尝试删除系统默认模板
- **THEN** 返回 403 或 400 错误,系统模板保留

### Requirement: 块编辑器图片上传
系统 SHALL 在块编辑器支持图片上传,图片存储到本地或对象存储(复用现有图片能力),插入为 `![](url)`。

#### Scenario: 上传图片插入
- **WHEN** 用户在编辑器粘贴/选择/拖入图片
- **THEN** 图片上传到存储,返回 URL
- **AND** 在光标处插入 `![](url)` 图片块

#### Scenario: 外链图片
- **WHEN** 用户输入外链图片 URL
- **THEN** 直接插入为 `![](url)`,不下载存储

## MODIFIED Requirements
(无,本 spec 为 P0 之后的纯新增能力)

## REMOVED Requirements
(无)
