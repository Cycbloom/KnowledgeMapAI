# Notes Block Editor + Daily Notes (P0 MVP) Spec

## Why
KnowledgeMap 当前所有知识沉淀在"图节点"中,缺少承载长文本学习产出(读书笔记、复盘、反思)的空间。本 spec 实现 PRD `PRD-Block-Editor-Daily-Notes.md` 的 **P0 阶段**:为个人学习场景补齐"反思/笔记空间",形成"图谱(结构化) ↔ 笔记(线性)"的双向闭环。

## What Changes
- 新增 `notes` / `note_node_links` / `note_templates` 三张数据库表(RLS + 软删除)
- 新增后端 `notesService` + `/api/notes` 路由(笔记 CRUD、挂载关系维护、Daily 自动创建、模板渲染)
- 新增前端 `/notes` 路由 + Kernel 插件注册(笔记列表页 + 编辑器页)
- 新增基础块编辑器(10 种块类型 + 斜杠命令 + Markdown 快捷输入 + wiki 链接补全 + 自动保存 + 撤销重做)
- 新增 Daily Notes 自动创建(系统默认三段式模板 + 4 个聚合变量渲染)
- 新增节点详情侧边栏"关联笔记"区块(复用 BacklinksPanel 模式)
- 笔记软删除接入现有回收站机制
- 节点重命名时同步更新笔记中 `[[节点名]]` 引用(扩展 backlinks 机制)
- **BREAKING**:无(纯新增,不修改既有 API 契约)

## Impact
- **Affected specs**: 无(项目首个 spec)
- **Affected code**:
  - 数据库:`supabase/migrations/`(新增模块化 schema 文件)
  - 共享类型:`shared/types/`(新增 note.ts)、`shared/types/database.generated.ts`(类型重生成)
  - 后端:`api/services/notes/`(新建)、`api/routes/notes.ts`(新建)、`api/services/plugins/`(注册新插件或在现有插件注册)、`api/services/graph/backlinkService.ts`(扩展节点重命名同步)
  - 前端:`src/services/api/notes.ts`、`src/pages/Notes/`、`src/pages/NoteEditor/`、`src/components/Notes/`(新建)、`src/services/kernel/plugins.ts`(注册路由/导航)、节点详情侧边栏组件(新增 NotesPanel)
  - 复用资产:`shared/utils/wikiLink.ts`、`src/utils/wikiLinkRemarkPlugin.tsx`、`shared/utils/markdownParser.ts`、`api/routes/backlinks.ts`、`src/components/common/TagSystem.tsx`、回收站软删除机制、Kernel 插件系统

## ADDED Requirements

### Requirement: 笔记数据模型
系统 SHALL 提供 `notes`、`note_node_links`、`note_templates` 三张表,支持 RLS 行级安全、软删除,且 `type='daily'` 时 `(user_id, date)` 唯一,`note_node_links` 的 `(note_id, node_id)` 唯一。

#### Scenario: 软删除级联
- **WHEN** 用户软删除一篇笔记
- **THEN** 笔记进入回收站,`note_node_links` 中该笔记的挂载关系同步清理
- **AND** 笔记恢复后,挂载关系不自动恢复(需提示用户)

#### Scenario: 跨用户隔离
- **WHEN** 用户 A 请求访问用户 B 的笔记
- **THEN** 返回 403 Forbidden

### Requirement: 笔记 CRUD API
系统 SHALL 提供 `/api/notes` RESTful API,支持创建、查询(列表/单个)、更新、删除(软删除),并支持按 type、date、tag、is_archived、is_pinned 过滤与分页。

#### Scenario: 创建笔记
- **WHEN** 客户端 POST `/api/notes` 携带合法 body
- **THEN** 返回创建的笔记完整对象,含 id、created_at

#### Scenario: Daily 唯一约束
- **WHEN** 同一用户同一天创建第二篇 type='daily' 笔记
- **THEN** 返回 409 Conflict

### Requirement: 挂载关系维护(wiki 链接即挂载)
系统 SHALL 在笔记保存时,解析正文中的 `[[节点名]]`,自动同步 `note_node_links`:新增的链接创建挂载,删除的链接移除挂载。

#### Scenario: 新增 wiki 链接
- **WHEN** 用户保存笔记,正文中新出现 `[[节点X]]`
- **THEN** 创建 `note_node_links` 记录(若不存在),节点X 详情页"关联笔记"出现该笔记

#### Scenario: 删除 wiki 链接
- **WHEN** 用户保存笔记,正文中 `[[节点X]]` 被移除
- **THEN** 删除对应 `note_node_links` 记录,节点X 详情页不再显示该笔记

#### Scenario: 节点重命名同步
- **WHEN** 图节点 X 被重命名为 Y
- **THEN** 所有引用 `[[X]]` 的笔记正文同步更新为 `[[Y]]`(扩展现有 backlinks 重命名机制)

### Requirement: Daily Notes 自动创建
系统 SHALL 在用户当日首次进入笔记模块时,若当天 daily note 不存在,自动创建,使用用户默认模板(无自定义则用系统默认三段式模板)。

#### Scenario: 首次进入自动创建
- **WHEN** 用户在 2026-07-03 首次访问 `/notes`
- **AND** 当天无 daily note
- **THEN** 自动创建 daily note,title="2026-07-03 学习日志"
- **AND** 正文按模板渲染,聚合数据(复习卡数/完成任务/专注时长)写入静态快照
- **AND** 跳转到该 daily note 编辑器

#### Scenario: 已存在则跳转
- **WHEN** 当天 daily note 已存在
- **THEN** 不重复创建,直接跳转

### Requirement: 系统默认模板
系统 SHALL 提供不可删除的系统默认模板,结构为三段式(今日学习/今日复习/今日反思),顶部含"今日数据"聚合区,支持 4 个变量:`{{date}}`、`{{today_reviewed_cards}}`、`{{today_completed_tasks}}`、`{{today_focus_time}}`。

#### Scenario: 模板变量渲染
- **WHEN** 创建 daily note 时
- **THEN** 模板变量被替换为当日实际值(如 `{{today_reviewed_cards}}` → "12")
- **AND** 聚合数据作为静态快照写入正文,不随时间变化

### Requirement: 块编辑器(基础版)
系统 SHALL 提供基础块编辑器,支持 10 种块类型(段落/H1-H3/无序/有序/待办/引用/代码块/分割线/图片/表格)、斜杠命令 `/`、Markdown 快捷输入、wiki 链接 `[[节点名]]` 自动补全、块拖拽排序、自动保存(失焦或定时 3 秒)、撤销/重做、暗色模式。

#### Scenario: 斜杠命令
- **WHEN** 用户在空行输入 `/`
- **THEN** 弹出块菜单,可选 10 种块类型,选择后插入对应块

#### Scenario: wiki 链接补全
- **WHEN** 用户输入 `[[`
- **THEN** 弹出图节点补全(按图谱/节点名模糊匹配),选择后插入 `[[节点名]]` 并在保存时创建挂载关系

#### Scenario: 自动保存
- **WHEN** 编辑器失焦或距上次保存超过 3 秒
- **THEN** 自动落盘,内容以 Markdown 存储

#### Scenario: 撤销重做
- **WHEN** 用户按 Ctrl+Z / Ctrl+Shift+Z
- **THEN** 撤销/重做最近的编辑操作

### Requirement: 笔记列表页与基础操作
系统 SHALL 在 `/notes` 提供笔记列表页,按 updated_at 倒序、置顶优先,支持视图切换(全部/Daily/普通/收藏/归档)、新建(普通/Daily)、置顶、归档、删除、标签管理(复用 TagSystem)。

#### Scenario: 列表展示
- **WHEN** 用户访问 `/notes`
- **THEN** 显示笔记列表,每项含标题、类型徽章、更新时间、标签、挂载节点数

#### Scenario: 视图切换
- **WHEN** 用户切换到"Daily"视图
- **THEN** 列表仅显示 type='daily' 的笔记

### Requirement: 节点详情关联笔记面板
系统 SHALL 在节点详情侧边栏新增"关联笔记"区块,列出挂载到该节点的所有笔记,点击可打开笔记编辑器。

#### Scenario: 关联笔记展示
- **WHEN** 笔记 A 含 `[[节点X]]` 且已保存
- **THEN** 节点X 详情侧边栏"关联笔记"区块显示笔记 A
- **AND** 点击笔记 A 打开编辑器

## MODIFIED Requirements
(无,本 spec 为纯新增)

## REMOVED Requirements
(无)
