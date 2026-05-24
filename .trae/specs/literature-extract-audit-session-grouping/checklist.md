# Checklist

- [x] `withAIPerformanceTracking` 函数支持 sessionId 参数并能正确传递给 performanceMonitor
- [x] `extractMetadata` 调用时携带 sessionId，审计日志中 sessionId 字段值与文献提取 session 一致
- [x] `extractConcepts` 调用时携带 sessionId，审计日志中 sessionId 字段值与文献提取 session 一致
- [x] `classifyConcept` 和 `locateBackboneModule`（如适用）调用时也携带 sessionId
- [x] `/extract` 路由中所有 AI 子调用共享同一个 sessionId
- [x] 外层 `withLiteratureTracking` 不再产生 0 token 的重复空记录（totalTokens=0 时跳过记录）
- [x] 前端审计面板中文献提取的 session 组名称显示为"文献提取"
- [x] Session 组汇总行正确显示总 tokens、总费用、总时长（前端已有聚合逻辑）
- [x] 各子请求在 session 组内展开后显示正确的独立 tokens/cost/时长信息
- [x] TypeScript 类型检查通过 (`npm run check`)
- [x] ESLint 检查通过 (`npm run lint`) — 唯一错误在未修改的 useCanvasInteraction.ts 中，属预存问题
