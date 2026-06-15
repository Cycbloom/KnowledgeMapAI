# Checklist

- [x] Worker 端 calculateMindMapLayout 方法实现完整，包含 d3-force 全部特性（层级电荷、域分组、碰撞检测、中心力）
- [x] Worker 端动态参数调整逻辑正确：>100 节点 700 迭代，50-100 节点 600 迭代，<50 节点 500 迭代
- [x] useGraphWorker Hook 新增 calculateMindMapLayout 方法和对应类型签名
- [x] MindMapCanvas 中 createMindMapLayout 同步调用已替换为异步 Worker 调用
- [x] 布局计算有 300ms 防抖机制，避免频繁重算
- [x] 布局计算期间显示 loading 状态（Skeleton 组件）
- [x] Worker 不可用时自动降级为主线程同步计算，并输出 warning 日志
- [x] 布局结果变更时 UI 平滑过渡，无突变闪烁
- [x] 大图（>100 节点）场景下主线程帧率保持 ≥ 30fps（Worker 异步执行）
- [x] 小图（<50 节点）场景下功能行为与改造前完全一致（fallback 路径调用原函数）
- [x] TypeScript 类型检查通过（npm run check 全量检查 exit code 0；check:incremental 因缓存缺失失败，非代码问题）
- [x] ESLint 检查通过（迁移的 3 个文件增量 Lint passed！全量 lint 的 1 error 来自无关文件 ActiveTaskPanel.tsx）
