# UX 微改进 Round 3 Checklist

## Tier 1 — 极小工作量

- [x] UX3-01: GraphEditor 相关 5 个文件的 `window.confirm` 已替换为 `ConfirmationModal`
- [x] UX3-02: Scheduler/Study/Console 相关 5 个文件的 `window.confirm` 已替换为 `ConfirmationModal`
- [x] UX3-03: Pages/Quiz/Templates 相关文件的 `window.confirm` 已替换为 `ConfirmationModal`
- [x] UX3-04: 通知中心支持 Escape 键关闭
- [x] UX3-05: TaskDetail 面板支持 Escape 键关闭
- [x] UX3-06: 回收站页面显示 30 天自动清理提示

## Tier 2 — 小工作量

- [x] UX3-07: Dashboard 加载时显示骨架屏卡片而非纯文本
- [x] UX3-08: Study 页面加载时显示骨架屏而非纯文本
- [x] UX3-09: 双击 Dashboard 图谱卡片可进入编辑模式
- [x] UX3-10: SubtaskList 和 TaskLinks 删除操作前显示确认对话框
- [x] UX3-11: TaskDetail 删除操作前显示确认对话框
- [x] UX3-12: 回收站恢复成功后的 toast 提供"查看"链接
- [x] UX3-13: CardReviewView 搜索无结果时提供"清除搜索"和"切换到全部卡片"按钮
- [x] UX3-14: 通知中心提供"删除所有已读通知"按钮（带确认）
- [x] UX3-15: Tasks 页面提供关键词搜索功能

## Tier 3 — 中等工作量

- [x] UX3-16: ShareDialog 样式统一为项目标准模态框风格
- [x] UX3-17: QuizList 图谱筛选下拉框显示图谱名称而非 ID
- [x] UX3-18: Tasks 页面支持多选和批量删除/重试

## 全局验证

- [x] `npm run check` 通过
- [x] `npm run lint` 通过
- [x] 项目中不再存在 `window.confirm` / `confirm()` 调用
