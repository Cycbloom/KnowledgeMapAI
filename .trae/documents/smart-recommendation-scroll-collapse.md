# 智能推荐模块滚动收起/展开交互优化

## 问题分析

当前 `Scheduler.tsx` 页面布局为 flex 纵向排列：
- **Header**（固定，`flex-shrink-0`）
- **SmartRecommendationBar**（`flex-shrink-0`）— 智能推荐模块，包含推荐任务、效率分析、时段建议、备选任务等多个 UI 元素，展开时占据大量屏幕空间
- **HorizontalQueueView**（`flex-1 min-h-0`）— 队列/看板/时间轴/列表等核心功能组件

**核心问题**：SmartRecommendationBar 展开时高度较大（约 300-500px），严重压缩了下方核心功能组件的显示区域。

## 现有代码分析

1. **SmartRecommendationBar.tsx** 已有 `isExpanded` 状态和手动切换按钮（第 96 行、353-359 行），使用 `AnimatePresence` + `motion.div` 实现展开/收起动画
2. **Scheduler.tsx** 的根元素使用 `overflow-hidden`，页面本身不产生滚动，滚动发生在 HorizontalQueueView 内部的队列列中
3. 因此需要监听 `wheel` 事件（而非 scroll 事件）来检测用户的滚动意图

## 实施方案

### Step 1: 创建 `useScrollDirection` hook

创建 `src/hooks/useScrollDirection.ts`：

- 接收一个 React ref，监听该元素上的 `wheel` 事件
- 通过 `wheel` 事件的 `deltaY` 判断滚动方向
- 使用防抖（debounce）避免频繁切换
- 返回 `"up" | "down" | null` 方向状态
- 支持配置阈值（threshold），只有超过一定滚动量才触发方向切换

### Step 2: 修改 `Scheduler.tsx`

- 引入 `useScrollDirection` hook
- 在 `main` 元素上添加 ref，监听 wheel 事件
- 根据滚动方向控制 SmartRecommendationBar 的 `isCollapsed` 状态：
  - 向下滚动 → `isCollapsed = true`（收起推荐栏）
  - 向上滚动 → `isCollapsed = false`（展开推荐栏）
- 将 `isCollapsed` 作为 prop 传递给 `SmartRecommendationBar`
- 为 SmartRecommendationBar 的容器添加 `motion.div` 包裹，实现平滑高度过渡动画

### Step 3: 修改 `SmartRecommendationBar.tsx`

- 新增 `isCollapsed` 可选 prop
- 当 `isCollapsed` 为 true 时，覆盖内部 `isExpanded` 状态，强制收起
- 当 `isCollapsed` 为 false（或未传递）时，恢复内部 `isExpanded` 状态的自主控制
- 收起时只显示标题栏（header），隐藏内容区域
- 确保收起/展开动画流畅（使用 framer-motion 的 `animate` 控制 `height` 和 `opacity`）

### Step 4: 动画细节优化

- 收起动画：`height: auto → 0`，`opacity: 1 → 0`，duration 0.25s，ease "easeInOut"
- 展开动画：`height: 0 → auto`，`opacity: 0 → 1`，duration 0.3s，ease "easeOut"
- 收起状态下标题栏保持可见，显示推荐任务标题摘要和展开按钮
- 添加 `layout` 动画让下方内容区域平滑上移填充空间

## 涉及文件

| 文件 | 操作 |
|------|------|
| `src/hooks/useScrollDirection.ts` | 新建 |
| `src/hooks/index.ts` | 修改：导出新 hook |
| `src/pages/Scheduler.tsx` | 修改：添加滚动方向检测和收起/展开控制 |
| `src/components/Scheduler/SmartRecommendationBar.tsx` | 修改：支持外部 `isCollapsed` prop 控制 |
