# Tasks

> 以下任务按 Tier 排列，用户可选择执行哪些 Tier。Tier 内任务无依赖，可并行。

## Tier 1 — 极小工作量（6 项）

- [x] Task UX2-01: AI 消息复制按钮
  - [x] SubTask UX2-01.1: `ChatMessage.tsx` 在 AI 消息操作区添加 Copy 按钮，复用 `CodeBlock.tsx` 的 clipboard 逻辑
  - [x] SubTask UX2-01.2: 复制后按钮短暂显示"已复制"状态（2秒后恢复）
  - [x] SubTask UX2-01.3: `npm run check` 通过

- [x] Task UX2-02: FSRS 评分键盘快捷键
  - [x] SubTask UX2-02.1: `useCardReviewLogic.ts` 添加 keydown 监听（`1/2/3/4` 映射 Again/Hard/Good/Easy，`Space/Enter` 映射 Good）
  - [x] SubTask UX2-02.2: `QuizView.tsx` 评分按钮显示对应数字键提示
  - [x] SubTask UX2-02.3: `npm run check` 通过

- [x] Task UX2-03: 测验选项键盘快捷键
  - [x] SubTask UX2-03.1: `useQuizLogic.ts` 添加 keydown 监听（`A/B/C/D` 或 `1/2/3/4` 选择对应选项）
  - [x] SubTask UX2-03.2: `QuizPractice.tsx` 选项按钮显示对应字母/数字键提示
  - [x] SubTask UX2-03.3: `npm run check` 通过

- [x] Task UX2-04: 测验会话计时器
  - [x] SubTask UX2-04.1: 在 quiz/study 会话开始时记录 startTime，useEffect 启动每秒 tick
  - [x] SubTask UX2-04.2: `QuizProgressBar.tsx` 显示 mm:ss 计时器
  - [x] SubTask UX2-04.3: `npm run check` 通过

- [x] Task UX2-05: AI 重新生成回复
  - [x] SubTask UX2-05.1: `ChatMessage.tsx` 最近一条 AI 消息添加 Regenerate 按钮
  - [x] SubTask UX2-05.2: `index.tsx` 实现 regenerate：移除该 AI 消息，用上一条用户消息重新触发 send
  - [x] SubTask UX2-05.3: `npm run check` 通过

- [x] Task UX2-06: 适应选区快捷键
  - [x] SubTask UX2-06.1: `src/config/shortcuts.ts` 新增 `Shift+F` 快捷键绑定 `fitSelection`（避免与 toggleFocusMode 的 `f` 冲突）
  - [x] SubTask UX2-06.2: `MindMapCanvas.tsx` 实现 `fitSelection`（useImperativeHandle）：计算选中节点 bbox 并居中缩放
  - [x] SubTask UX2-06.3: `GraphEditor.tsx` 通过 useGlobalShortcuts 接入 `fitSelection`
  - [x] SubTask UX2-06.4: `npm run check` 通过

## Tier 2 — 小工作量（9 项）

- [x] Task UX2-07: 画布缩放级别指示与按钮
  - [x] SubTask UX2-07.1: `GraphToolbar.tsx` 添加 +/- 缩放按钮和当前缩放百分比显示
  - [x] SubTask UX2-07.2: 百分比显示支持点击重置为 100%
  - [x] SubTask UX2-07.3: `npm run check` 通过

- [x] Task UX2-08: 边显示快速切换
  - [x] SubTask UX2-08.1: 工具栏添加"简化边/隐藏边标签"切换按钮
  - [x] SubTask UX2-08.2: `MindMapLink.tsx` 根据全局切换状态渲染（简化模式隐藏标签/降低透明度/减细描边）
  - [x] SubTask UX2-08.3: `npm run check` 通过

- [x] Task UX2-09: 复习会话完成摘要
  - [x] SubTask UX2-09.1: `useCardReviewLogic.ts` 跟踪 sessionStartTime、reviewedCount、correctCount
  - [x] SubTask UX2-09.2: `QuizView.tsx` 完成页显示卡片数/耗时/准确率统计卡片
  - [x] SubTask UX2-09.3: `npm run check` 通过

- [x] Task UX2-10: 下次复习预测
  - [x] SubTask UX2-10.1: `useStudyQueries.ts` 查询未来 7 日 due 卡片数（按 due_date 分组）
  - [x] SubTask UX2-10.2: `CardReviewView.tsx` 显示"明日 N 张 / 本周 M 张"预测条
  - [x] SubTask UX2-10.3: `npm run check` 通过

- [x] Task UX2-11: 测验标记待复查
  - [x] SubTask UX2-11.1: `QuizCard.tsx` 添加旗帜按钮，切换 flagged 状态
  - [x] SubTask UX2-11.2: quiz session state 维护 flaggedIds 集合
  - [x] SubTask UX2-11.3: `QuizProgressBar.tsx` 显示已标记数，支持跳转到标记题目
  - [x] SubTask UX2-11.4: `npm run check` 通过

- [x] Task UX2-12: 测验结果时间统计
  - [x] SubTask UX2-12.1: quiz session 跟踪每题 startTime/endTime
  - [x] SubTask UX2-12.2: `QuizResult.tsx` 显示总耗时/平均耗时/最快最慢题
  - [x] SubTask UX2-12.3: `npm run check` 通过

- [x] Task UX2-13: AI 停止生成按钮
  - [x] SubTask UX2-13.1: `useChatState.ts` 暴露 abortController 引用和 `stopGeneration` 方法
  - [x] SubTask UX2-13.2: `ChatInput.tsx` 在 loading 时将发送按钮切换为 Stop 按钮
  - [x] SubTask UX2-13.3: `index.tsx` 接入 stopGeneration 调用
  - [x] SubTask UX2-13.4: `npm run check` 通过

- [x] Task UX2-14: Dashboard 排序选项
  - [x] SubTask UX2-14.1: `useDashboardFilters.ts` 扩展 sortBy 状态（title/createdAt/updatedAt/nodeCount），保持收藏优先
  - [x] SubTask UX2-14.2: `DashboardHeader.tsx` 添加排序下拉选择器
  - [x] SubTask UX2-14.3: `npm run check` 通过

- [x] Task UX2-15: Dashboard 状态筛选 chips
  - [x] SubTask UX2-15.1: `useDashboardFilters.ts` 扩展 status / timeRange 筛选状态
  - [x] SubTask UX2-15.2: `DashboardHeader.tsx` 添加状态与时间范围筛选 chips（参考 GlobalSearch 样式）
  - [x] SubTask UX2-15.3: `npm run check` 通过

## Tier 3 — 中等工作量（5 项）

- [x] Task UX2-16: 框选多节点
  - [x] SubTask UX2-16.1: `useCanvasInteraction.ts` 监听 Shift+空白处 mousedown→mousemove→mouseup，绘制 marquee 矩形（canvas 坐标）
  - [x] SubTask UX2-16.2: `MindMapCanvas.tsx` 计算 marquee 与节点 bbox 交集，渲染半透明蓝色矩形 + 传递 multiSelected 到 MindMapNode
  - [x] SubTask UX2-16.3: `useSelectionState.ts` 暴露 `setMultiSelectedByIds` 方法
  - [x] SubTask UX2-16.4: `npm run check` 通过

- [x] Task UX2-17: 节点编辑器 Markdown 预览/工具栏
  - [x] SubTask UX2-17.1: `NodeEditSidebar.tsx` 添加"编辑/预览"切换 toggle
  - [x] SubTask UX2-17.2: 预览模式使用 ReactMarkdown（remarkGfm/remarkMath/rehypeKatex + preprocessMarkdown）渲染内容
  - [x] SubTask UX2-17.3: 编辑模式添加轻量格式工具栏（加粗/斜体/标题/链接/代码块），插入 markdown 语法到 textarea
  - [x] SubTask UX2-17.4: `npm run check` 通过

- [x] Task UX2-18: AI 编辑并重发用户消息
  - [x] SubTask UX2-18.1: `ChatMessage.tsx` 用户消息添加 Edit 按钮，点击进入 inline 编辑
  - [x] SubTask UX2-18.2: `useChatState.ts` 实现 `editAndResend(messageId, newContent)`：截断该消息之后所有消息，更新内容，重新 send
  - [x] SubTask UX2-18.3: `index.tsx` 接入 editAndResend
  - [x] SubTask UX2-18.4: `npm run check` 通过

- [x] Task UX2-19: 图谱编辑器偏好设置
  - [x] SubTask UX2-19.1: 新增 `GraphEditorSettings.tsx`，提供默认视图模式/默认缩放/自动布局开关
  - [x] SubTask UX2-19.2: 偏好持久化到 localStorage，图谱编辑器读取偏好作为初始值
  - [x] SubTask UX2-19.3: `Settings/index.ts` 和 `Settings.tsx` 注册新区块
  - [x] SubTask UX2-19.4: `npm run check` 通过

- [x] Task UX2-20: 通知偏好设置
  - [x] SubTask UX2-20.1: 新增 `NotificationSettings.tsx`，按 `NotificationType` 列出开关
  - [x] SubTask UX2-20.2: 偏好持久化到 localStorage，`NotificationCenter.tsx` 读取后过滤已静音类型
  - [x] SubTask UX2-20.3: `Settings/index.ts` 和 `Settings.tsx` 注册新区块
  - [x] SubTask UX2-20.4: `npm run check` 通过

## 全局验证

- [x] Task V1: `npm run check:full` 通过
- [x] Task V2: `npm run lint:full` 通过

# Task Dependencies

## Tier 内依赖
- [Tier 1: UX2-01 ~ UX2-06] 无依赖，可并行
- [Tier 2: UX2-07 ~ UX2-15] 无依赖，可并行
- [Tier 3: UX2-16 ~ UX2-20] 无依赖，可并行

## Tier 间依赖
- 无强制依赖，但建议按 Tier 1 → 2 → 3 顺序执行

## 建议分组（同场景可一起实现）
- AI 对话组：UX2-01 + UX2-05 + UX2-13 + UX2-18（建议同一轮完成，涉及 ChatMessage/ChatInput/useChatState）
- 键盘快捷键组：UX2-02 + UX2-03（均为 keydown 监听，可共用工具函数）
- 测验统计组：UX2-04 + UX2-09 + UX2-12（均涉及时长跟踪，可共用 session timing 工具）
- Dashboard 组：UX2-14 + UX2-15（均修改 useDashboardFilters/DashboardHeader）
