# Checklist

- [x] `normalizeTitle` 函数已增强：支持移除非字母数字的尾部标点符号、Unicode NFC 规范化、全角转半角
- [x] `graphNodeService.addToGraph()` 在插入前查询已有节点，存在则返回已有记录而非创建重复
- [x] `autoGraphService.processAINodes()` 中新增 `deduplicateNodes()` 私有方法，执行标题去重+向量相似去重
- [x] `autoGraphService.processAINodes()` 中批量内部去重生效：同一批次中相似概念合并
- [x] `/auto-graph/save-nodes` 路由保存相同模板节点两次时，第二次不会创建重复节点（通过 processAINodes 内置去重）
- [x] `/literature/apply` 路由中冗余的批量内部去重已移除（由 processAINodes 统一处理）
- [x] `/literature/apply` 路由保留独有的 fuzzy title match 去重逻辑
- [x] `CONCEPT_MERGE_THRESHOLD` 环境变量可在 `.env.example` 中查阅
- [x] 所有去重操作有清晰的 logger.info 日志记录（合并了什么、合并到哪个节点）
- [x] TypeScript 类型检查通过（`npm run check`）
- [x] ESLint 检查通过（`npm run lint`）
- [ ] 手动测试：同一文献提取结果连续保存两次，第二次 addedCount=0，mergedCount=提取概念总数
- [ ] 手动测试：两次不同文献提取出相似概念后分别保存，相似概念被正确合并