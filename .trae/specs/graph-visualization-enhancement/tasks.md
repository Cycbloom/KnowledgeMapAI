# Tasks

- [x] Task 1: 知识热力图颜色模式
  - [x] SubTask 1.1: 在 `src/config/graphConfig.ts` 中新增热力图配色配置（色温渐变 stops、热度计算权重、发光强度范围）
  - [x] SubTask 1.2: 扩展 `GraphColorMode` 类型为 `"level" | "status" | "heatmap"`，更新颜色模式选择器 UI
  - [x] SubTask 1.3: 在 `useGraphComputed.ts` 中新增热度值计算逻辑（复习次数×0.3 + 掌握状态×0.4 + 最近活跃度×0.3，归一化到 [0,1]）
  - [x] SubTask 1.4: 在 `MindMapNode.tsx` 中新增热力图渲染分支：根据热度值映射色温渐变，动态调整发光强度
  - [x] SubTask 1.5: 新增热力图图例组件 `HeatmapLegend.tsx`（渐变色条 + 低/高标签），在热力图模式激活时显示在画布右下角
  - [x] SubTask 1.6: 处理无学习数据节点的降级显示（中性灰色 #9CA3AF）

- [x] Task 2: 缩放语义系统
  - [x] SubTask 2.1: 在 `graphConfig.ts` 中定义缩放语义级别配置（概览 <0.3 / 集群 0.3~0.7 / 节点 0.7~1.5 / 详情 >=1.5）及各级别显示规则
  - [x] SubTask 2.2: 在 `MindMapCanvas.tsx` 中新增 `useSemanticZoom` hook，根据当前 zoom 级别计算语义级别和各层级节点的显示策略
  - [x] SubTask 2.3: 实现概览级别渲染：仅显示 root/core 节点，以聚合圆点形式呈现（含子节点数量），隐藏文字和边，相同领域同色分组
  - [x] SubTask 2.4: 实现集群级别渲染：显示 root/core/sub 节点，核心节点标题截断至 8 字符，leaf 节点聚合到父节点旁
  - [x] SubTask 2.5: 实现详情级别渲染：节点下方显示内容预览（前 50 字符）、学习状态标签、复习次数
  - [x] SubTask 2.6: 缩放级别间过渡动画（CSS transition 0.3s），避免信息粒度跳变
  - [x] SubTask 2.7: 左下角缩放百分比旁显示当前语义级别标签（概览/集群/节点/详情）

- [x] Task 3: 力导向图动画叙事
  - [x] SubTask 3.1: 扩展 `usePresentationState.ts` 为 `useNarrativeState.ts`，支持多种遍历策略（DFS/学习路径），新增播放控制状态（isPlaying/playSpeed/currentStep/totalSteps）
  - [x] SubTask 3.2: 在 `useViewState.ts` 中新增 `isNarrativeMode` 状态和叙事模式切换逻辑
  - [x] SubTask 3.3: 实现叙事播放控制器：按学习路径顺序逐步展开节点，每个节点出现时触发缩放淡入动画（0.3s）+ 父到子的边流动动画
  - [x] SubTask 3.4: 实现叙事模式相机跟随：每步展开新节点时调用 `animateCamera` 平滑移动到新节点位置
  - [x] SubTask 3.5: 实现叙事模式视觉聚焦：当前节点高亮放大（1.2x），已展开路径节点正常显示，未展开节点隐藏，非路径节点始终隐藏
  - [x] SubTask 3.6: 新增叙事播放控制栏 UI 组件 `NarrativeControls.tsx`（播放/暂停、步进/步退、重置、速度调节 0.5x/1x/2x）
  - [x] SubTask 3.7: 叙事完成处理：自动暂停 + "叙事完成"提示 + fitView 展示完整路径
  - [x] SubTask 3.8: 退出叙事模式：恢复所有节点可见性，清除叙事状态，相机回到进入前位置

- [x] Task 4: 集成与测试
  - [x] SubTask 4.1: 在 `GraphEditor.tsx` 中集成叙事模式 UI（入口按钮 + 控制栏 + 图例）
  - [x] SubTask 4.2: 确保热力图与叙事模式兼容（叙事模式下已展开节点按热力图渲染）
  - [x] SubTask 4.3: 确保缩放语义与叙事模式兼容（叙事模式下禁用缩放语义，使用叙事模式的节点可见性控制）
  - [x] SubTask 4.4: 运行 `npm run check:incremental` 和 `npm run lint` 确保类型安全和代码规范

# Task Dependencies

- [Task 2] depends on [Task 1] — 缩放语义的详情级别需要热力图数据（热度值、学习状态标签）
- [Task 3] depends on [Task 1] — 叙事模式需要与热力图颜色模式兼容
- [Task 4] depends on [Task 1, Task 2, Task 3] — 集成测试依赖三个功能完成
- [Task 1 SubTasks] 可并行执行内部无依赖
- [Task 2 SubTasks] 2.1 → 2.2 → 2.3/2.4/2.5（可并行） → 2.6 → 2.7
- [Task 3 SubTasks] 3.1 → 3.2 → 3.3 → 3.4/3.5（可并行） → 3.6 → 3.7/3.8（可并行）
