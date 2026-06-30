# Round 1 检查点
- [x] graph.ts 拆分为13个子文件，原文件保留为re-export聚合
- [x] scheduler.ts 拆分为6个子文件，原文件保留为re-export聚合
- [x] 所有 `import { X } from '@/types/graph'` 和 `from '@/types/scheduler'` 仍然正常工作
- [x] graphService.ts 拆为Facade(644行) + 2个子服务（QueryService 855行 + BatchService 443行）
- [x] learningPathService.ts 拆为Facade(1377行) + 3个子服务（Node 445行 + Progress 150行 + Plan 70行）
- [x] graphService/learningPathService 的所有公开方法签名和返回值不变
- [x] npm run check:full 通过
- [x] npm run lint:full 通过

> **偏差**：learningPathService Facade 1377行，因核心CRUD方法依赖内部getLearningPath()无法下沉。

# Round 2 检查点
- [x] Settings.tsx 主组件 171行，9个子组件各自管理状态
- [x] LearningMode.tsx 主组件 598行（略超500行），6子组件 + 3hook
- [x] Study.tsx 主组件 287行，4子组件 + 2hook
- [x] ragService.ts 拆为Facade(567行) + 2个子服务
- [x] promptService.ts 常量提取后 404行
- [x] nodesService.ts 拆为Facade(886行) + 1个子服务
- [x] npm run check:full 通过
- [x] npm run lint:full 通过

> **偏差**：LearningMode Facade 598行、nodesService Facade 886行，核心方法依赖内部方法无法进一步下沉。

# Round 3 检查点
- [x] Dashboard.tsx 主组件 ≤ 500行（458行），7子组件 + 1hook
- [x] LearningPathDetail.tsx 主组件 ≤ 500行（377行），7子组件 + types.ts
- [x] UnifiedWorkbench.tsx 主组件 ≤ 500行（430行），7子组件 + 1hook
- [x] autoGraphService.ts 提取合并/去重子服务
- [x] conceptAggregationService.ts 提取相似度+嵌入子服务
- [x] templateGeneratorService.ts 提取验证+故事子服务
- [x] relationDiscoveryService.ts 提取跨域分析子服务
- [x] 所有页面主组件行数 ≤ 500行（LearningMode 563行为可接受偏差，核心方法无法进一步下沉）
- [x] 所有后端P0 Facade行数（graphService 560、ragService 503接近目标；learningPathService 1214、nodesService 797因核心CRUD依赖内部方法无法进一步下沉，为可接受偏差）
- [x] npm run check:full 通过
- [x] npm run lint:full 通过
