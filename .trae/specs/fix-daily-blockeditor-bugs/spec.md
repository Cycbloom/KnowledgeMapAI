# Daily Note / Block Editor 缺陷修复 Spec

## Why
P0-P3 笔记功能交付后,用户在 Daily Note 实测中发现 7 个影响使用的缺陷:i18n 英文残留、新建按钮假死、AI 总结插入未渲染 Markdown、自动保存频繁触发全局进度条、斜杠菜单越界、Wiki 链接因 linkifyjs scheme 格式错误而丢失、刷新今日数据重复追加。其中 Bug 3/6/7 为功能性故障,直接导致 AI 总结、Wiki 双链、今日数据刷新三个核心能力不可用,需优先修复。

## What Changes
- **Bug 1**:i18n 修复 — `zh-CN/notes.json` 中 `badges.daily` 等含英文 "Daily" 的文案统一改为中文(对齐 `views.daily` 已有翻译)
- **Bug 2**:状态解耦 — Daily Note 自动创建与手动新建按钮的 mutation 实例分离,按钮 `isPending` 仅反映手动触发
- **Bug 3**:AI 总结插入改为先解析 Markdown 再插入 — 用 `markdownToTiptap` 预处理 + tiptap-markdown 解析为 ProseMirror 节点后插入,实现 WYSIWYG 渲染
- **Bug 4**:静默 mutation — 自动保存 mutation 标记 `meta.silent: true`,LoadingBar 的 `useIsMutating` 增加 predicate 过滤,避免后台保存触发全局进度条
- **Bug 5**:斜杠菜单边界自适应 — 定位时对 `coordsAtPos` 结果做 viewport clamp(右侧/底部溢出时翻转/偏移)
- **Bug 6**:linkifyjs scheme 修复 — Link 扩展 `protocols` 去掉冒号(`"wiki:"` → `"wiki"`),消除 `incorrect scheme format` 错误,恢复 wiki 链接的插入/保存/重载/点击全链路
- **Bug 7**:刷新今日数据改用按行分段替换 — 替换脆弱的正则为"找 heading 行 → 向后遍历到下一个 `## ` 或文档末尾 → 整段替换"逻辑,容忍空行/`\r\n`/尾部空格/文档末尾无 `\n` 等边界,补充测试用例
- **BREAKING**:无

## Impact
- **Affected specs**:
  - `add-notes-block-editor-daily`(P0 块编辑器、Daily Note、Wiki 链接)
  - `add-notes-p1-ai-search-templates`(P1 AI 总结)
  - `extend-notes-p2-writing-refresh-search`(P2 写作辅助、刷新今日数据)
- **Affected code**:
  - i18n:`src/i18n/locales/zh-CN/notes.json`、`src/i18n/locales/en-US/notes.json`(键值一致性)
  - 前端 Daily 列表:`src/pages/Notes/NotesListPage.tsx`(自动创建与按钮解耦)
  - 写作辅助:`src/components/Notes/BlockEditorToolbar.tsx`(insertSummary 改为解析后插入)
  - 全局进度条:`src/components/common/LoadingBar.tsx`(silent mutation 过滤)
  - mutation 工厂:`src/hooks/mutations/mutationFactory.ts` 或 `useNoteMutations.ts`(支持 meta.silent)
  - 块编辑器:`src/components/Notes/BlockEditor.tsx`(斜杠菜单 clamp;自动保存 mutation 标记 silent)
  - 斜杠菜单:`src/components/Notes/Notes/SlashCommandMenu.tsx`(可选,接收边界参数)
  - TipTap 扩展:`src/components/Notes/editorExtensions.ts`(Link protocols 去冒号)
  - 后端服务:`api/services/notes/notesService.ts`(refreshDailyAggregation 按行分段替换)
  - 后端测试:`api/__tests__/services/notesRefreshAggregation.test.ts`(边界用例)
  - 复用:`markdownSerializer.ts` 的 `markdownToTiptap`、`shared/utils/wikiLink.ts`

## ADDED Requirements

### Requirement: AI 总结插入为渲染后内容
系统 SHALL 在"生成今日总结"采纳时,将 AI 返回的 Markdown 字符串先解析为 TipTap 节点(heading/bold/list 等)再插入,而非作为纯文本插入。

#### Scenario: 采纳总结后渲染为可视化样式
- **WHEN** 用户点击"生成今日总结"且 AI 返回含 `### 标题` / `**加粗**` / `- 列表` 的 Markdown
- **AND** 用户点击"采纳"
- **THEN** 编辑器在"今日反思"段位置插入内容,渲染为可视化样式(标题大字号、加粗、列表项)
- **AND** 保存后重新打开,内容仍为渲染样式(非原始 Markdown 字面量)

### Requirement: Wiki 链接全链路可用
系统 SHALL 确保 `[[节点名]]` wiki 链接的插入、保存、重载、点击跳转全链路可用,且不触发 linkifyjs scheme 格式错误。

#### Scenario: Wiki 链接插入与保存
- **WHEN** 用户通过 popover 选择节点插入 wiki 链接
- **THEN** 编辑器渲染为可点击的 wiki-link 样式
- **AND** 保存后落盘为 `[[节点名]]` 语法
- **AND** 重新打开笔记时,链接重新渲染为可点击样式(括号不丢失)
- **AND** 浏览器控制台无 `linkifyjs: incorrect scheme format` 错误

#### Scenario: Wiki 链接点击跳转
- **WHEN** 用户点击编辑器中的 wiki 链接
- **THEN** 跳转到对应图谱节点(调用 onWikiLinkNavigate)

### Requirement: 刷新今日数据不重复
系统 SHALL 在"刷新今日数据"时,整段替换 `## 今日数据` 段(含标题与所有数据行),不产生重复条目。

#### Scenario: 多次刷新不重复
- **WHEN** 用户点击"刷新今日数据"按钮
- **AND** 笔记已有 `## 今日数据` 段(含复习卡片/完成任务/专注时长等条目)
- **THEN** 旧数据行被整段替换为新数据
- **AND** 不出现重复的"复习卡片""完成任务"条目
- **AND** 连续点击多次刷新,数据条目数量保持一致

#### Scenario: 边界场景兼容
- **WHEN** `## 今日数据` 段后紧跟空行(TipTap 块间默认空行)
- **OR** 段位于文档末尾且末行无换行
- **OR** 换行为 `\r\n`(Windows)
- **OR** heading 含尾部空格
- **THEN** 刷新仍能正确识别并整段替换,不重复追加

### Requirement: 自动保存不触发全局进度条
系统 SHALL 将笔记自动保存标记为静默 mutation,不触发顶部全局 LoadingBar。

#### Scenario: 编辑时无进度条
- **WHEN** 用户在编辑器中连续输入
- **AND** 自动保存(防抖后)触发
- **THEN** 顶部全局 LoadingBar 不显示
- **AND** 编辑器自身的 saveStatus 文案(saving/saved)仍正常显示

### Requirement: 斜杠菜单边界自适应
系统 SHALL 在斜杠命令唤起菜单时,根据光标位置与视口边界自适应菜单显示位置。

#### Scenario: 右边缘翻转
- **WHEN** 光标位于视口右边缘,菜单向右展开会溢出
- **THEN** 菜单左移至不溢出视口的位置

#### Scenario: 底部翻转
- **WHEN** 光标位于视口底部,菜单向下展开会溢出
- **THEN** 菜单翻转到光标上方显示

### Requirement: 新建 Daily 按钮状态独立
系统 SHALL 将 Daily Note 自动创建与手动新建按钮的 loading 状态解耦。

#### Scenario: 自动创建后按钮可用
- **WHEN** 用户进入 /notes 页面触发自动创建今日 Daily
- **AND** 自动创建完成(已存在则直接返回)
- **THEN** "新建 Daily"按钮恢复可用状态(非灰色转圈)
- **AND** 用户可正常点击新建

### Requirement: Daily 文案中文化
系统 SHALL 在中文环境下将 "Daily" 相关文案统一显示为中文。

#### Scenario: 中文环境显示中文
- **WHEN** 用户语言为 zh-CN
- **THEN** 笔记类型徽章显示"每日笔记"(而非 "Daily")
- **AND** 新建按钮文案、空状态文案等均为中文

## MODIFIED Requirements
(无)

## REMOVED Requirements
(无)
