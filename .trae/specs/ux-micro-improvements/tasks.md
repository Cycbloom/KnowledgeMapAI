# Tasks

> 以下任务按 Tier 排列。用户可选择执行哪些 Tier。

## Tier 1 — 极小工作量

- [x] Task UX-01: 节点编辑自动保存
  - [x] SubTask UX-01.1: 3秒 debounced auto-save 逻辑
  - [x] SubTask UX-01.2: "已自动保存"指示器
  - [x] SubTask UX-01.3: `npm run check` 通过

- [x] Task UX-02: 收藏图谱置顶排序
  - [x] SubTask UX-02.1: `is_favorite` desc → `updated_at` desc
  - [x] SubTask UX-02.2: 验证收藏图谱排在顶部

- [x] Task UX-03: 画布空白处右键菜单
  - [x] SubTask UX-03.1: 创建 `CanvasContextMenu.tsx`
  - [x] SubTask UX-03.2: 新建节点、粘贴、全选、适应画布
  - [x] SubTask UX-03.3: `npm run check` 通过

- [x] Task UX-04: Dashboard 图谱卡片右键菜单
  - [x] SubTask UX-04.1: 创建 `DashboardCardContextMenu.tsx`
  - [x] SubTask UX-04.2: 复制ID、新窗口打开、切换收藏、移至回收站
  - [x] SubTask UX-04.3: DashboardGraphCard/ListItem 绑定 onContextMenu
  - [x] SubTask UX-04.4: `npm run check` 通过

## Tier 2 — 小工作量

- [x] Task UX-05: 最近图谱快捷入口
  - [x] SubTask UX-05.1: 创建 `useRecentGraphs.ts` hook
  - [x] SubTask UX-05.2: GraphEditor mount 时记录 lastAccessedAt
  - [x] SubTask UX-05.3: Dashboard 顶部"最近编辑"横向卡片条
  - [x] SubTask UX-05.4: `npm run check` 通过

- [x] Task UX-06: 图谱导出为图片
  - [x] SubTask UX-06.1: 增强 `captureScreenshot` 支持透明/适应/隐藏网格
  - [x] SubTask UX-06.2: 导出弹窗 i18n + 加载状态
  - [x] SubTask UX-06.3: `npm run check` 通过

- [x] Task UX-07: 全局文件拖入创建图谱
  - [x] SubTask UX-07.1: Layout.tsx 全局 drag-over 监听 + 覆盖层
  - [x] SubTask UX-07.2: 文件拖入后解析并导入
  - [x] SubTask UX-07.3: `npm run check` 通过

## Tier 3 — 中等工作量

- [x] Task UX-08: 图谱编辑器首次引导
  - [x] SubTask UX-08.1: 4步引导组件 OnboardingGuide.tsx
  - [x] SubTask UX-08.2: localStorage 记录完成状态

- [x] Task UX-09: 节点搜索高亮跳转
  - [x] SubTask UX-09.1: searchHighlightNodeId 状态 + SVG 脉冲动画
  - [x] SubTask UX-09.2: 3秒后自动消失

- [x] Task UX-10: 快速切换最近图谱
  - [x] SubTask UX-10.1: GraphSwitcher.tsx 下拉选择器
  - [x] SubTask UX-10.2: 集成到 GraphToolbar

## 全局验证

- [x] Task V1: `npm run check:full` 通过
- [x] Task V2: `npm run lint:full` 通过

# Task Dependencies

## Tier 内依赖
- [UX-01 ~ UX-04] 无依赖，可并行
- [UX-05 ~ UX-07] 无依赖，可并行
- [UX-08 ~ UX-10] 无依赖，可并行

## Tier 间依赖
- 无强制依赖，但建议按 Tier 1 → 2 → 3 顺序执行
