# Tasks

- [x] Task 1: 在 graphCalculator.worker.ts 中实现 `calculateMindMapLayout` 方法
  - [x] 1.1 导入 d3-force 依赖（确认 Worker 环境兼容性）
  - [x] 1.2 定义 MindMapLayoutNode / MindMapLayoutEdge / MindMapLayoutOptions / MindMapLayoutResult 类型
  - [x] 1.3 实现完整的力导向布局算法，包含：层级电荷、域分组、碰撞检测、中心力、X/Y 定位力
  - [x] 1.4 实现动态参数调整逻辑（按节点数量调整迭代次数/距离/电荷）
  - [x] 1.5 将 calculateMindMapLayout 添加到 expose 的 graphWorker 对象中

- [x] Task 2: 扩展 useGraphWorker Hook 类型和方法
  - [x] 2.1 在 GraphWorkerApi 接口中新增 `calculateMindMapLayout` 类型签名
  - [x] 2.2 在 useGraphWorker hook 中新增 `calculateMindMapLayout` 方法实现
  - [x] 2.3 导出新类型供外部使用

- [x] Task 3: 改造 MindMapCanvas 为异步布局计算模式
  - [x] 3.1 引入 useGraphWorker hook，替换 createMindMapLayout 的同步调用
  - [x] 3.2 将 layout 状态从 useMemo 改为 useState + useEffect 异步加载模式
  - [x] 3.3 添加 300ms 防抖，避免频繁重算
  - [x] 3.4 添加布局计算中的 loading 状态显示（使用现有 Skeleton 组件）
  - [x] 3.5 实现 Worker 不可用时降级为主线程同步计算的 fallback 逻辑
  - [x] 3.6 确保 layout 变更时平滑过渡（非突变）

# Task Dependencies
- [Task 2] depends on [Task 1] — Hook 类型依赖 Worker 端接口定义
- [Task 3] depends on [Task 2] — Canvas 改造依赖 Hook API
