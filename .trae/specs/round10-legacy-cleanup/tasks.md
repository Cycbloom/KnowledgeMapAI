# Tasks

## Task 1: 修复 AgentService.ts `finalSession!` 非空断言

- [x] SubTask 1.1: 读取 `api/services/agent/AgentService.ts` 第 655-671 行 `finalizeSession` 方法
- [x] SubTask 1.2: 将 L670 `return { session: finalSession! };` 改为空值检查 + 抛错（`if (!finalSession) throw new Error("Session not found after update")`）
- [x] SubTask 1.3: 运行 `npm run check` 与 `npm run lint` 验证（均退出码 0）

## Task 2: P2-17 i18n 迁移 SchedulerStats.tsx + CombinedViewPage.tsx

- [x] SubTask 2.1: 读取 `src/pages/SchedulerStats.tsx` 识别硬编码中文（实际 74 处，含 JSX 文本、属性值、formatter 回调、tickFormatter、name 属性等）
- [x] SubTask 2.2: 读取 `src/pages/CombinedViewPage.tsx` 识别硬编码中文（实际 20 处）
- [x] SubTask 2.3: 设计 i18n key 命名空间（schedulerStats.* / combinedViewPage.*）
- [x] SubTask 2.4: 在 `src/i18n/locales/zh-CN.json` 添加中文键值（84 个 key：schedulerStats 64 + combinedViewPage 20）
- [x] SubTask 2.5: 在 `src/i18n/locales/en-US.json` 添加英文翻译（84 个 key）
- [x] SubTask 2.6: 修改 `SchedulerStats.tsx`（74 处迁移，含 7 个子组件）与 `CombinedViewPage.tsx`（20 处迁移，含 2 个组件），替换硬编码为 `t()` 调用；额外修复 SchedulerHeatmap 的 reduce<number> 类型错误
- [x] SubTask 2.7: 运行 `npm run check` 与 `npm run lint` 验证（均退出码 0）

## Task 3: P2-02 autoGraph.ts 路由拆分

- [x] SubTask 3.1: 读取 `api/routes/autoGraph.ts`（17588 字符，660 行）完整内容，分析路由分组（init/expand/save-nodes/generate-templates/apply-template/optimize-prompt/generate-embeddings/embedding-status）
- [x] SubTask 3.2: 参照 `api/routes/graphs/` 与 `api/routes/ai/config/` 拆分模式
- [x] SubTask 3.3: 新建 `api/routes/autoGraph/` 目录及 5 个文件：index.ts（16 行）、graph.ts（331 行）、templates.ts（187 行）、prompt.ts（108 行）、embeddings.ts（58 行）
- [x] SubTask 3.4: 迁移路由处理器到对应子文件，保持路由路径与行为不变；无需 shared.ts（schema 各自路由专用）
- [x] SubTask 3.5: 删除原 `api/routes/autoGraph.ts`（660 行）；`api/services/plugins/GraphPlugin.ts` 的 `import autoGraphRoutes from "../../routes/autoGraph"` 自动解析到 `./autoGraph/index`，无需修改
- [x] SubTask 3.6: 运行 `npm run check` 与 `npm run lint` 验证（均退出码 0）

# Task Dependencies

- Task 1, 2, 3 相互独立，可并行
- SubTask 1.2 依赖 1.1
- SubTask 1.3 依赖 1.2
- SubTask 2.4, 2.5 依赖 2.3
- SubTask 2.6 依赖 2.4, 2.5
- SubTask 2.7 依赖 2.6
- SubTask 3.3 依赖 3.1, 3.2
- SubTask 3.4 依赖 3.3
- SubTask 3.5 依赖 3.4
- SubTask 3.6 依赖 3.5
