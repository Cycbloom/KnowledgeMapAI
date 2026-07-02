# Tasks

> 以下任务按 Tier 排列。Tier 内任务无依赖，可并行。

## Tier 1 — 极小工作量（6 项）

- [x] Task UX3-01: 批量替换 window.confirm（第 1 批：GraphEditor 相关）
  - [x] SubTask UX3-01.1: 替换 `VersionHistoryModal.tsx` 中的 confirm
  - [x] SubTask UX3-01.2: 替换 `ShareModal.tsx` 中的 confirm
  - [x] SubTask UX3-01.3: 替换 `RelationshipTypeSettings.tsx` 中的 confirm
  - [x] SubTask UX3-01.4: 替换 `AIActionSettingsPanel.tsx` 中的 confirm
  - [x] SubTask UX3-01.5: 替换 `GraphMap.tsx` 页面中的 confirm
  - [x] SubTask UX3-01.6: `npm run check` 通过

- [x] Task UX3-02: 批量替换 window.confirm（第 2 批：Scheduler/Study/Console 相关）
  - [x] SubTask UX3-02.1: 替换 `TaskWorkbench.tsx` 中的 confirm
  - [x] SubTask UX3-02.2: 替换 `ProgressDetail.tsx` 中的 confirm
  - [x] SubTask UX3-02.3: 替换 `QuestionBank.tsx` 中的 confirm（2 处）
  - [x] SubTask UX3-02.4: 替换 `ConsoleHistory.tsx` 中的 confirm
  - [x] SubTask UX3-02.5: 替换 `PerformanceTab.tsx` 中的 confirm
  - [x] SubTask UX3-02.6: `npm run check` 通过

- [x] Task UX3-03: 批量替换 window.confirm（第 3 批：Pages/Quiz/Templates 相关）
  - [x] SubTask UX3-03.1: 替换 `QuizPreview.tsx` 中的 confirm
  - [x] SubTask UX3-03.2: 替换 `LearningPaths.tsx` 中的 confirm
  - [x] SubTask UX3-03.3: 替换 `LearningPathDetail.tsx` 中的 confirm
  - [x] SubTask UX3-03.4: 替换 `Profile.tsx` 中的 confirm（2 处）
  - [x] SubTask UX3-03.5: 替换 `QuizList.tsx` 和 `QuizGenerationModal.tsx` 中的 confirm
  - [x] SubTask UX3-03.6: 替换 `QuestionList.tsx` 和 `TaskTemplates.tsx` 和 `Templates.tsx` 中的 confirm
  - [x] SubTask UX3-03.7: `npm run check` 通过

- [x] Task UX3-04: 通知中心 Esc 关闭
  - [x] SubTask UX3-04.1: `NotificationCenter.tsx` 添加 useEffect 监听 Escape 键关闭
  - [x] SubTask UX3-04.2: `npm run check` 通过

- [x] Task UX3-05: TaskDetail Esc 关闭
  - [x] SubTask UX3-05.1: `TaskDetail.tsx` 添加 useEffect 监听 Escape 键触发 onClose
  - [x] SubTask UX3-05.2: `npm run check` 通过

- [x] Task UX3-06: 回收站自动清理天数提示
  - [x] SubTask UX3-06.1: `RecycleBin.tsx` 空状态和头部添加 30 天自动清理提示
  - [x] SubTask UX3-06.2: 添加 i18n 文本

## Tier 2 — 小工作量（9 项）

- [x] Task UX3-07: Dashboard 加载态骨架屏
  - [x] SubTask UX3-07.1: `Dashboard.tsx` 用 SkeletonCard 替代纯文本加载态
  - [x] SubTask UX3-07.2: `npm run check` 通过

- [x] Task UX3-08: Study 页面加载态骨架屏
  - [x] SubTask UX3-08.1: `Study.tsx` 添加统计卡片和列表骨架屏
  - [x] SubTask UX3-08.2: `npm run check` 通过

- [x] Task UX3-09: Dashboard 卡片双击进入编辑
  - [x] SubTask UX3-09.1: `DashboardGraphCard.tsx` 添加 onDoubleClick 导航到编辑模式
  - [x] SubTask UX3-09.2: `npm run check` 通过

- [x] Task UX3-10: 子任务/链接删除确认
  - [x] SubTask UX3-10.1: `SubtaskList.tsx` 删除子任务添加 ConfirmationModal
  - [x] SubTask UX3-10.2: `TaskLinks.tsx` 删除链接添加 ConfirmationModal
  - [x] SubTask UX3-10.3: `npm run check` 通过

- [x] Task UX3-11: TaskDetail 删除确认
  - [x] SubTask UX3-11.1: `TaskDetail.tsx` 删除按钮添加 ConfirmationModal
  - [x] SubTask UX3-11.2: `npm run check` 通过

- [x] Task UX3-12: 回收站恢复成功后引导
  - [x] SubTask UX3-12.1: `RecycleBin.tsx` 恢复成功 toast 添加"查看"链接
  - [x] SubTask UX3-12.2: `npm run check` 通过

- [x] Task UX3-13: CardReviewView 空状态操作引导
  - [x] SubTask UX3-13.1: `CardReviewView.tsx` 搜索无结果时添加"清除搜索"和"切换到全部卡片"按钮
  - [x] SubTask UX3-13.2: `npm run check` 通过

- [x] Task UX3-14: 通知中心删除已读通知
  - [x] SubTask UX3-14.1: `NotificationCenter.tsx` 添加"删除所有已读通知"按钮 + 确认
  - [x] SubTask UX3-14.2: `npm run check` 通过

- [x] Task UX3-15: Tasks 页面搜索
  - [x] SubTask UX3-15.1: `Tasks.tsx` 添加关键词搜索输入框
  - [x] SubTask UX3-15.2: `npm run check` 通过

## Tier 3 — 中等工作量（3 项）

- [x] Task UX3-16: ShareDialog 样式统一
  - [x] SubTask UX3-16.1: `ShareDialog.tsx` 统一为项目标准模态框风格（rounded-2xl/backdrop-blur）
  - [x] SubTask UX3-16.2: `npm run check` 通过

- [x] Task UX3-17: QuizList 图谱筛选显示名称
  - [x] SubTask UX3-17.1: `QuizList.tsx` 图谱筛选下拉框显示图谱名称而非 ID
  - [x] SubTask UX3-17.2: `npm run check` 通过

- [x] Task UX3-18: Tasks 页面批量操作
  - [x] SubTask UX3-18.1: `Tasks.tsx` 添加多选模式和批量操作栏（批量删除/批量重试）
  - [x] SubTask UX3-18.2: `npm run check` 通过

## 额外补充

- [x] Task UX3-extra: 替换遗漏的 5 个 window.confirm
  - [x] `StructurePanel.tsx` 中的 confirm
  - [x] `CharacterPanel.tsx` 中的 confirm
  - [x] `ShareDialog.tsx` 中的 confirm（遗漏）
  - [x] `LearningPathPanel.tsx` 中的 confirm
  - [x] `PromptSettingsPanel.tsx` 中的 confirm

## 全局验证

- [x] Task V1: `npm run check` 通过
- [x] Task V2: `npm run lint` 通过
- [x] 项目中不再存在 `window.confirm` / `confirm()` 调用

# Task Dependencies

## Tier 内依赖
- [Tier 1: UX3-01 ~ UX3-06] UX3-01/02/03 可并行，UX3-04/05/06 可并行
- [Tier 2: UX3-07 ~ UX3-15] 无依赖，可并行
- [Tier 3: UX3-16 ~ UX3-18] 无依赖，可并行

## Tier 间依赖
- UX3-01/02/03 与其他任务无依赖，但同一文件的 confirm 替换不应与其他任务冲突

## 建议分组
- confirm 替换组：UX3-01 + UX3-02 + UX3-03 + UX3-extra（统一模式，可复用替换模板）
- Esc 关闭组：UX3-04 + UX3-05（同一模式：useEffect 监听 Escape）
- 加载态组：UX3-07 + UX3-08（均为骨架屏替换纯文本）
- 删除确认组：UX3-10 + UX3-11 + UX3-14（均为添加 ConfirmationModal）
